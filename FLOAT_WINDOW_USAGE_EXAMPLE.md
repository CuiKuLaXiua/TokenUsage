# 靠边隐藏功能 - 使用示例

## 渲染进程中的使用方法

在 Vue 组件或任何渲染进程代码中，可以通过 `window.electronAPI` 调用这些新方法：

### 1. 手动触发靠边隐藏

```typescript
// 靠左边隐藏
await window.electronAPI.dockFloatWindow('left')

// 靠右边隐藏
await window.electronWindow.dockFloatWindow('right')

// 靠上边隐藏
await window.electronAPI.dockFloatWindow('top')
```

### 2. 取消靠边隐藏（弹出窗口）

```typescript
await window.electronAPI.undockFloatWindow()
```

### 3. 获取当前靠边状态

```typescript
const state = await window.electronAPI.getEdgeDockState()

if (state?.isDocked) {
  console.log('窗口已靠边隐藏')
  console.log('靠边方向:', state.edge)  // 'left' | 'right' | 'top'
  console.log('原始位置:', state.originalX, state.originalY)
} else {
  console.log('窗口未靠边')
}
```

---

## 完整的悬浮窗组件示例

```vue
<template>
  <div
    class="float-window"
    @mousedown="startDrag"
    @mousemove="onDrag"
    @mouseup="stopDrag"
  >
    <div class="content">
      <!-- 窗口内容 -->
    </div>

    <div class="controls">
      <button @click="dockLeft">靠左</button>
      <button @click="dockRight">靠右</button>
      <button @click="dockTop">靠上</button>
      <button @click="undock" v-if="isDocked">弹出</button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const isDocked = ref(false)
const isDragging = ref(false)

// 拖拽相关
function startDrag(e: MouseEvent) {
  isDragging.value = true
  window.electronAPI.startWindowDrag({
    mouseX: e.screenX,
    mouseY: e.screenY
  })
}

function onDrag(e: MouseEvent) {
  if (!isDragging.value) return
  window.electronAPI.windowDragMove({
    mouseX: e.screenX,
    mouseY: e.screenY
  })
}

function stopDrag() {
  isDragging.value = false
  window.electronAPI.stopWindowDrag()
}

// 靠边隐藏相关
async function dockLeft() {
  await window.electronAPI.dockFloatWindow('left')
  isDocked.value = true
}

async function dockRight() {
  await window.electronAPI.dockFloatWindow('right')
  isDocked.value = true
}

async function dockTop() {
  await window.electronAPI.dockFloatWindow('top')
  isDocked.value = true
}

async function undock() {
  await window.electronAPI.undockFloatWindow()
  isDocked.value = false
}

// 定期检查靠边状态（可选）
let stateCheckTimer: ReturnType<typeof setInterval>

onMounted(async () => {
  // 初始化状态
  const state = await window.electronAPI.getEdgeDockState()
  isDocked.value = state?.isDocked ?? false

  // 定期同步状态（主进程会自动处理鼠标移入弹出，这里只是同步 UI 状态）
  stateCheckTimer = setInterval(async () => {
    const state = await window.electronAPI.getEdgeDockState()
    isDocked.value = state?.isDocked ?? false
  }, 500)
})

onUnmounted(() => {
  if (stateCheckTimer) {
    clearInterval(stateCheckTimer)
  }
})
</script>
```

---

## 工作流程说明

### 自动工作流程（推荐）

1. **用户拖拽窗口到边缘**
   - `startWindowDrag()` → `windowDragMove()` → `stopWindowDrag()`
   - 主进程自动检测到靠近边缘（< 20px）
   - 自动调用 `animateWindowPosition()` 隐藏到边缘
   - 自动启动鼠标轮询检测

2. **鼠标移动到边缘附近**
   - 主进程 200ms 轮询检测鼠标位置
   - 当鼠标距离窗口 5px 以内时
   - 自动调用 `animateWindowPosition()` 弹出窗口
   - 自动更新靠边状态

### 手动工作流程

1. **手动触发靠边**
   - 调用 `dockFloatWindow('left' | 'right' | 'top')`
   - 主进程执行动画隐藏

2. **手动取消靠边**
   - 调用 `undockFloatWindow()`
   - 主进程执行动画弹出

---

## 事件监听（可选）

如果你想在靠边/弹出时执行某些操作，可以监听相关事件：

```typescript
// 监听配置更新（已有）
window.electronAPI.onConfigUpdated(() => {
  console.log('配置已更新')
})

// 注意：当前没有专门的靠边/弹出事件
// 可以通过定期轮询 getEdgeDockState() 来同步状态
// 或者可以在后续版本中添加事件支持
```

---

## 注意事项

1. **鼠标轮询由主进程管理**
   - 不需要在渲染进程中实现鼠标检测
   - 靠边后自动启动 200ms 轮询
   - 窗口关闭时自动停止轮询

2. **动画由主进程处理**
   - 所有窗口位置变化都有动画效果
   - 使用 ease-out cubic 缓动
   - 动画时长 200ms

3. **多显示器支持**
   - 自动检测窗口所在的显示器
   - 使用该显示器的工作区（排除任务栏）

4. **状态同步**
   - 靠边状态保存在主进程的 `edgeDockState` Map 中
   - 渲染进程可以通过 `getEdgeDockState()` 查询
   - 建议定期轮询以保持 UI 状态同步
