# 拖拽 Bug 修复

## 问题描述

**症状**：鼠标左键松开后，悬浮窗仍然跟随鼠标移动

**根本原因**：
1. 全屏遮罩有 `@mouseup` 事件处理器，与 document 的事件监听器冲突
2. `stopWindowDrag` 只在 `hasMoved` 为 true 时调用，导致定时器未清理
3. 缺少安全机制，鼠标在窗口外释放时事件可能丢失

---

## 修复方案

### 1. 移除遮罩的 @mouseup 事件

**问题**：遮罩的 `@mouseup` 和 document 的 `addEventListener('mouseup', ..., true)` 冲突，导致事件可能触发两次或在错误时机触发

**修复**：
```vue
<!-- 修复前 -->
<div ref="dragOverlayRef" class="drag-overlay" @mouseup="onDocMouseUp"></div>

<!-- 修复后 -->
<div ref="dragOverlayRef" class="drag-overlay"></div>
```

**原理**：只依赖 document 级别的事件监听器，避免冲突

### 2. 总是调用 stopWindowDrag

**问题**：原代码只有在 `hasMoved` 为 true 时才调用 `stopWindowDrag`，如果用户点击但未移动，主进程的定时器不会被清理

**修复**：
```typescript
// 修复前
function onDocMouseUp() {
  cleanupDragListeners();
  if (!isDragging.value) return;
  isDragging.value = false;
  if (hasMoved.value) {  // ← 问题：只有移动过才调用
    window.electronAPI.stopWindowDrag();
  }
}

// 修复后
function onDocMouseUp(e: MouseEvent) {
  if (e.button !== 0) return;

  cleanupDragListeners();
  if (!isDragging.value) return;

  isDragging.value = false;

  // 总是调用 stopWindowDrag，无论是否移动过
  window.electronAPI.stopWindowDrag();
}
```

**原理**：确保主进程总是能清理定时器

### 3. 添加安全定时器

**问题**：如果鼠标在窗口外释放，或事件被系统截断，拖拽状态可能永远无法结束

**修复**：
```typescript
let dragSafetyTimer: ReturnType<typeof setInterval> | null = null;

function onWindowDragStart(e: MouseEvent) {
  // ... 其他代码 ...

  // 安全机制：如果 5 秒后仍在拖拽状态，强制停止
  dragSafetyTimer = setTimeout(() => {
    if (isDragging.value) {
      console.warn('[FloatWindow] Drag safety timeout, forcing stop')
      onDocMouseUp(new MouseEvent('mouseup', { button: 0 }));
    }
  }, 5000);
}

function cleanupDragListeners() {
  // ... 其他清理代码 ...

  // 清理安全定时器
  if (dragSafetyTimer) {
    clearTimeout(dragSafetyTimer);
    dragSafetyTimer = null;
  }
}
```

**原理**：5 秒超时强制停止，防止拖拽状态永久卡住

### 4. 窗口关闭时清理拖拽状态

**问题**：窗口关闭时，主进程的定时器可能仍在运行

**修复**：
```typescript
floatWindow.on('closed', () => {
  // 清理拖拽状态和定时器
  const dragState = dragStateMap.get(floatWindow?.id || -1)
  if (dragState?.intervalId) {
    clearInterval(dragState.intervalId)
  }
  dragStateMap.delete(floatWindow?.id || -1)

  // ... 其他清理代码 ...
})
```

**原理**：窗口关闭时立即清理，防止内存泄漏

---

## 修改的文件

### 渲染进程：`src/pages/FloatWindow.vue`

1. **模板** - 移除遮罩的 `@mouseup` 事件
2. **onDocMouseUp 函数**
   - 添加 `e.button` 检查
   - 移除 `hasMoved` 条件，总是调用 `stopWindowDrag`
   - 添加日志输出
3. **onWindowDragStart 函数** - 添加安全定时器（5 秒超时）
4. **cleanupDragListeners 函数** - 清理安全定时器

### 主进程：`electron/main.ts`

1. **floatWindow.on('closed') 处理器** - 添加拖拽状态清理逻辑

---

## 测试场景

### 场景 1：正常拖拽停止
1. 按住悬浮窗左键
2. 移动鼠标拖拽
3. 松开左键
4. ✅ 验证：窗口立即停止移动

### 场景 2：点击但未移动
1. 按住悬浮窗左键
2. 不移动鼠标
3. 松开左键
4. ✅ 验证：窗口无移动，主进程定时器被清理

### 场景 3：快速拖拽后释放
1. 快速移动鼠标拖拽
2. 在窗口外松开左键
3. ✅ 验证：窗口停止移动（依赖 document 事件）

### 场景 4：拖拽时窗口关闭
1. 拖拽悬浮窗
2. 在拖拽过程中关闭窗口
3. ✅ 验证：主进程定时器被清理，无内存泄漏

### 场景 5：异常情况
1. 拖拽时失去焦点
2. 等待 5 秒
3. ✅ 验证：安全定时器触发，拖拽自动停止

---

## 调试日志

修复后，可以在控制台看到以下日志：

```
[FloatWindow] mouseup detected, stopping drag
[FloatWindow] Calling stopWindowDrag
```

如果 5 秒超时触发：
```
[FloatWindow] Drag safety timeout, forcing stop
[FloatWindow] mouseup detected, stopping drag
[FloatWindow] Calling stopWindowDrag
```

---

## 关键改进点

1. **事件处理简化**
   - 只依赖 document 级别的 mouseup 事件
   - 移除遮罩的 @mouseup，避免冲突

2. **状态清理保证**
   - 总是调用 stopWindowDrag，确保主进程清理定时器
   - 不依赖 hasMoved 状态

3. **安全机制**
   - 5 秒超时强制停止
   - 窗口关闭时清理状态

4. **调试支持**
   - 添加 console.log 输出
   - 便于追踪拖拽状态

---

## 预防措施

1. **避免事件冲突**
   - 不要在多个元素上监听同一事件
   - 优先使用 document/window 级别监听器

2. **确保状态清理**
   - 每个 start 都要有对应的 stop
   - 添加超时安全机制

3. **及时清理资源**
   - 窗口/组件销毁时清理定时器
   - 使用 try-finally 确保清理执行

4. **添加日志**
   - 关键状态变化时输出日志
   - 便于调试和追踪问题
