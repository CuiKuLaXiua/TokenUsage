# 问题修复总结

## 问题1：拖拽限制不一致（左右可以拖出屏幕）

### 根因分析
原代码的边界计算逻辑有问题：
```typescript
const MIN_VISIBLE = 100
newX = Math.max(workX - winW + MIN_VISIBLE, Math.min(newX, workX + workW - MIN_VISIBLE))
```
这个逻辑允许窗口有 100px 保留在屏幕内，但计算方式导致左右方向的限制不正确。

### 修复方案
改为严格的边界限制，不允许任何部分超出屏幕：
```typescript
// 左边界：窗口左边缘不能小于工作区左边缘
newX = Math.max(workX, newX)
// 右边界：窗口右边缘不能超过工作区右边缘
newX = Math.min(newX, workX + workW - winW)
// 上边界：窗口上边缘不能小于工作区上边缘
newY = Math.max(workY, newY)
// 下边界：窗口下边缘不能超过工作区下边缘
newY = Math.min(newY, workY + workH - winH)
```

**修改文件**：`electron/main.ts` - `window-drag-move` IPC handler

---

## 问题2：拖拽容易中断

### 根因分析
原代码有两个问题导致拖拽中断：

1. **方向判断延迟**：需要移动超过 10px 才启动 IPC 拖拽
2. **方向限制**：只允许水平或垂直拖拽，不支持对角线
```typescript
const DIRECTION_THRESHOLD = 10
if (dragDirection === 'unknown' && ...) {
  dragDirection = absDx > absDy ? 'horizontal' : 'vertical'
  window.electronAPI.startWindowDrag(...)  // 只在方向确定后才启动
}
```

### 修复方案
1. **降低阈值**：从 10px 降低到 3px
2. **移除方向限制**：支持任意方向拖拽
3. **立即启动**：超过阈值后立即启动 IPC 拖拽，无需等待方向判断
```typescript
const DRAG_THRESHOLD = 3
// 超过阈值后立即启动拖拽
if (absDx > DRAG_THRESHOLD || absDy > DRAG_THRESHOLD) {
  if (!hasMoved.value) {
    hasMoved.value = true;
    hideDetailWindow()
    window.electronAPI.startWindowDrag({ mouseX: windowDragStartX, mouseY: windowDragStartY });
  }
  // 立即发送移动事件
  window.electronAPI.windowDragMove({ mouseX: lastDragX, mouseY: lastDragY });
}
```

**修改文件**：`src/pages/FloatWindow.vue` - `onWindowDragStart`, `onDocMouseMove`, `onDocMouseUp`

---

## 问题3：移入弹出后不会自动收起

### 根因分析
原代码只实现了"移入弹出"功能，但没有实现"移出收起"功能：
- 窗口靠边隐藏后，鼠标移入会弹出 ✓
- 窗口弹出后，鼠标移出不会收起 ✗

### 修复方案
在轮询函数中添加两种状态的处理：

1. **靠边隐藏状态**（`isDocked: true`）：
   - 检测鼠标是否在边缘附近（5px 内）
   - 如果是，触发动画弹出

2. **弹出状态**（`isDocked: false`，但仍在 edgeDockState 中）：
   - 检测鼠标是否远离窗口（50px 外）
   - 如果是，触发动画收起

```typescript
hoverPollTimer = setInterval(() => {
  const state = edgeDockState.get(floatWindow.id)
  if (!state) return

  const cursor = screen.getCursorScreenPoint()
  const { x: winX, y: winY, width: winW, height: winH } = floatWindow.getBounds()

  // 情况1：窗口处于靠边隐藏状态，检测是否应该弹出
  if (state.isDocked) {
    let shouldReveal = false
    // ... 检测鼠标是否在边缘附近
    if (shouldReveal) {
      animateWindowPosition(floatWindow, state.originalX, state.originalY, 200)
    }
  }
  // 情况2：窗口处于弹出状态，检测是否应该收起
  else {
    let shouldHide = false
    // ... 检测鼠标是否远离窗口
    if (shouldHide || isMouseOutsideWindow) {
      animateWindowPosition(floatWindow, state.dockX, state.dockY, 200)
    }
  }
}, 200)
```

**修改文件**：`electron/main.ts` - `startHoverPolling()` 函数

---

## 测试验证

### 测试1：拖拽限制
- [x] 左右拖拽不能超出屏幕
- [x] 上下拖拽不能超出屏幕
- [x] 四个角都不能超出屏幕

### 测试2：拖拽流畅性
- [x] 小幅移动（3px）即可启动拖拽
- [x] 支持对角线拖拽
- [x] 快速拖拽不会中断
- [x] 鼠标移出窗口后继续拖拽正常

### 测试3：靠边隐藏交互
- [x] 拖拽到边缘自动隐藏
- [x] 鼠标移入边缘自动弹出
- [x] 鼠标移出窗口 50px 后自动收起
- [x] 动画效果流畅（200ms）

---

## 关键改进点

1. **更严格的边界检查**
   - 完全不允许窗口超出屏幕
   - 使用 workArea 排除任务栏

2. **更灵敏的拖拽响应**
   - 降低启动阈值（10px → 3px）
   - 移除方向限制，支持全方位拖拽
   - 立即启动 IPC 拖拽，减少延迟

3. **更完整的交互逻辑**
   - 同时处理"移入弹出"和"移出收起"
   - 设置合理的检测区域（5px 弹出，50px 收起）
   - 200ms 轮询间隔，平衡性能和响应速度

---

## 后续优化建议

1. **自定义灵敏度**
   - 允许用户调整边缘检测阈值（当前 20px）
   - 允许用户调整弹出/收起检测区域

2. **手势识别**
   - 区分快速甩出和缓慢拖拽
   - 快速甩出时使用惯性动画

3. **多窗口支持**
   - 处理多个悬浮窗的靠边隐藏
   - 避免窗口重叠
