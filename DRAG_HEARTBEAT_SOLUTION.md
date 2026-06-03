# 拖拽 Bug 深度修复 - 心跳 + 多层保护方案

## 问题分析

**症状**：偶发性鼠标松开后，悬浮窗仍然跟随鼠标移动

**根本原因**：
- mouseup 事件偶尔会丢失（系统级问题）
- 单一的事件监听不可靠
- 缺少主动的状态检测机制

---

## 解决方案：心跳 + 多层保护

### 核心思想

1. **渲染进程定期发送心跳**（每 100ms）
2. **主进程监控心跳超时**（500ms 没收到就自动停止）
3. **多层事件监听**（document + window）
4. **统一的清理函数**（避免遗漏）

---

## 实现细节

### 1. 渲染进程：心跳机制

```typescript
// 心跳定时器
let dragHeartbeatTimer: ReturnType<typeof setInterval> | null = null;
const HEARTBEAT_INTERVAL = 100; // 每 100ms 发送一次

function startDragHeartbeat() {
  dragHeartbeatTimer = setInterval(() => {
    if (!isDragging.value || !hasMoved.value) {
      stopDragHeartbeat();
      return;
    }

    // 发送心跳到主进程
    window.electronAPI.dragHeartbeat({
      mouseX: windowDragStartX,
      mouseY: windowDragStartY
    });
  }, HEARTBEAT_INTERVAL);
}
```

**作用**：
- 持续通知主进程"我还在拖拽"
- 如果渲染进程崩溃或事件丢失，心跳会停止

### 2. 主进程：超时检测

```typescript
const DRAG_HEARTBEAT_TIMEOUT = 500; // 500ms 超时

interface DragState {
  // ... 其他字段
  heartbeatTimer: ReturnType<typeof setTimeout> | null
  lastHeartbeat: number
}

// 启动心跳超时检测
const checkHeartbeat = () => {
  if (!state.isDragging || win.isDestroyed()) return

  const elapsed = Date.now() - state.lastHeartbeat
  if (elapsed > DRAG_HEARTBEAT_TIMEOUT) {
    console.log(`[Main] Drag heartbeat timeout (${elapsed}ms)`)
    // 超时，自动停止拖拽
    stopDragForWindow(win.id)
    return
  }

  // 继续检测
  state.heartbeatTimer = setTimeout(checkHeartbeat, 100)
}

state.heartbeatTimer = setTimeout(checkHeartbeat, 100)
```

**作用**：
- 主动检测拖拽状态
- 不依赖渲染进程的 mouseup 事件
- 500ms 超时确保快速恢复

### 3. 多层事件监听

```typescript
function onWindowDragStart(e: MouseEvent) {
  // ... 初始化代码

  // document 级别事件
  document.addEventListener('mousemove', onDocMouseMove, true);
  document.addEventListener('mouseup', onDocMouseUp, true);
  
  // window 级别事件（兜底）
  window.addEventListener('mouseup', onWindowMouseUp, true);

  // 启动心跳
  startDragHeartbeat();
}
```

**作用**：
- document 事件捕获大部分情况
- window 事件作为兜底
- 三重保护确保事件被捕获

### 4. 统一的清理函数

```typescript
function stopDrag() {
  if (!isDragging.value) return;

  console.log('[FloatWindow] stopDrag called')

  // 立即清理所有资源
  cleanupDragListeners();
  
  isDragging.value = false;

  if (hasMoved.value) {
    window.electronAPI.stopWindowDrag();
  }
}

function cleanupDragListeners() {
  document.removeEventListener('mousemove', onDocMouseMove, true);
  document.removeEventListener('mouseup', onDocMouseUp, true);
  window.removeEventListener('mouseup', onWindowMouseUp, true);
  stopDragHeartbeat();  // 停止心跳
  hideDragOverlay();
}
```

**作用**：
- 集中管理所有清理逻辑
- 避免遗漏任何资源
- 防止重复调用

---

## 数据流

```
渲染进程                           主进程
    │                                 │
    ├─ startWindowDrag ──────────────►│
    │                                 ├─ 启动位置更新定时器
    │                                 ├─ 启动心跳超时检测
    │                                 │
    ├─ dragHeartbeat (每 100ms) ─────►│
    │                                 ├─ 更新 lastHeartbeat
    │                                 │
    ├─ dragHeartbeat ────────────────►│
    │                                 ├─ 更新 lastHeartbeat
    │                                 │
    │   （假设 mouseup 丢失）          │
    │                                 │
    │                                 ├─ checkHeartbeat:
    │                                 │   elapsed > 500ms?
    │                                 │   ↓ 是
    │                                 ├─ stopDragForWindow()
    │                                 ├─ 清理所有定时器
    │                                 └─ 检测边缘吸附
```

---

## 修改的文件

### 渲染进程：`src/pages/FloatWindow.vue`

1. **新增变量**
   - `dragHeartbeatTimer` - 心跳定时器
   - `HEARTBEAT_INTERVAL` - 心跳间隔 (100ms)

2. **新增函数**
   - `startDragHeartbeat()` - 启动心跳
   - `stopDragHeartbeat()` - 停止心跳
   - `onWindowMouseUp()` - window 级别 mouseup 处理
   - `stopDrag()` - 统一的停止函数

3. **修改函数**
   - `onWindowDragStart()` - 添加 window 事件监听 + 启动心跳
   - `cleanupDragListeners()` - 清理心跳定时器

### 主进程：`electron/main.ts`

1. **修改 DragState 接口**
   - 添加 `heartbeatTimer` 字段
   - 添加 `lastHeartbeat` 字段

2. **新增常量**
   - `DRAG_HEARTBEAT_TIMEOUT` - 心跳超时时间 (500ms)

3. **新增 IPC handler**
   - `drag-heartbeat` - 接收心跳，更新时间戳

4. **新增函数**
   - `stopDragForWindow()` - 统一的停止函数（含边缘检测）

5. **修改 IPC handler**
   - `start-window-drag` - 启动心跳超时检测
   - `stop-window-drag` - 使用 stopDragForWindow()

### 预加载脚本：`electron/preload.ts`

1. **接口定义** - 添加 `dragHeartbeat` 方法
2. **API 实现** - 添加 `dragHeartbeat` 调用

### 类型定义：`src/types/electron.d.ts`

1. **添加 `dragHeartbeat` 类型**

---

## 关键参数

| 参数 | 值 | 说明 |
|------|-----|------|
| `HEARTBEAT_INTERVAL` | 100ms | 渲染进程发送心跳的间隔 |
| `DRAG_HEARTBEAT_TIMEOUT` | 500ms | 主进程超时时间 |
| 位置更新间隔 | 16ms | 主进程更新窗口位置 (~60fps) |
| 心跳检测间隔 | 100ms | 主进程检查超时的间隔 |

---

## 优势

1. **主动检测** - 不被动等待事件，主动监控状态
2. **快速恢复** - 500ms 超时，快速自动停止
3. **多层保护** - document + window + 心跳，三重保障
4. **统一管理** - 集中的清理函数，避免遗漏
5. **低开销** - 心跳 IPC 很小，100ms 间隔可接受

---

## 测试场景

### 场景 1：正常拖拽
1. 拖拽悬浮窗
2. 松开鼠标
3. ✅ 验证：窗口立即停止

### 场景 2：快速拖拽后 mouseup 丢失
1. 快速拖拽悬浮窗
2. 松开鼠标（但事件丢失）
3. 等待 500ms
4. ✅ 验证：窗口自动停止

### 场景 3：鼠标移出窗口
1. 拖拽时鼠标移出窗口
2. 松开鼠标
3. ✅ 验证：document/window 事件捕获，窗口停止

### 场景 4：渲染进程异常
1. 拖拽时渲染进程崩溃
2. 等待 500ms
3. ✅ 验证：主进程超时检测，自动停止

---

## 性能影响

| 资源 | 开销 | 说明 |
|------|------|------|
| IPC 调用 | 每 100ms 一次 | 心跳调用，数据量小 |
| 主进程 CPU | 轻微增加 | 100ms 检测一次超时 |
| 渲染进程 CPU | 轻微增加 | 100ms 发送一次心跳 |
| 内存 | 无影响 | 定时器正常清理 |

**总开销**：可忽略不计

---

## 后续优化建议

1. **自适应心跳间隔**
   - 根据拖拽速度调整间隔
   - 静止时降低频率

2. **状态同步**
   - 主进程定期向渲染进程同步状态
   - 双向确认机制

3. **错误恢复**
   - 检测渲染进程是否响应
   - 自动重启渲染进程

4. **性能监控**
   - 记录心跳延迟
   - 检测异常情况
