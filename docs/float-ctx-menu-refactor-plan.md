# TokenUsage 悬浮窗与右键菜单重构方案

## 一、Electron 优秀设计分析

### 1.1 悬浮窗（Floating Window / Overlay）设计

Electron 悬浮窗通常用于**系统小部件、画中画、截图工具、游戏 overlay、实时通知**。优秀案例在实现上具有共性，但也根据平台差异做了不同取舍。

#### 核心配置模式

| 配置项 | 推荐值 | 原因 |
|--------|--------|------|
| `frame` | `false` | 去除系统边框，实现自定义样式 |
| `transparent` | `true` | 支持透明/圆角/阴影自定义 |
| `backgroundColor` | `#00000000` | 避免创建时的黑屏闪烁 |
| `alwaysOnTop` | `true` | 保证浮窗始终可见 |
| `skipTaskbar` | `true` | 浮窗不应出现在任务栏 |
| `resizable` | `false` | 保持固定尺寸，避免用户误操作 |
| `show` | `false` | 创建时不显示，ready 后再 show，避免白屏 |
| `focusable` | 视情况而定 | 右键菜单需要 focus；纯 widget 可关闭 |

**平台差异**：

- **Windows**：`frame: false` 是透明的前提；多 DPI 场景下位置计算需使用 DIP（Device Independent Pixels）。
- **macOS**：透明窗口会丢失原生阴影，需要时用 `titleBarStyle: 'hidden'` 或 `customButtonsOnHover`；全屏场景需要 `setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })`。
- **Linux**：透明依赖合成器，可能需要 `--enable-transparent-visuals`。

#### 层级管理

Electron 的 `setAlwaysOnTop` 支持 `level` 参数：

```js
// macOS
win.setAlwaysOnTop(true, 'floating')       // 普通 overlay
win.setAlwaysOnTop(true, 'pop-up-menu')    // 菜单级
win.setAlwaysOnTop(true, 'screen-saver')   // 最高级，可覆盖全屏

// Windows/Linux
win.setAlwaysOnTop(true, 'normal', 1)
```

优秀实践：

- **Discord / 游戏 overlay**：使用 `screen-saver` 级确保覆盖全屏游戏，配合 `setIgnoreMouseEvents(true, { forward: true })` 实现点击穿透+hover 检测。
- **Daily.co 视频浮窗**：`setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })` + `setAlwaysOnTop(true, 'floating')`。
- **Slack / VS Code**：使用 WCO（Window Controls Overlay）自定义标题栏，保留原生控制按钮。

#### 多显示器 / DPI 适配

Electron 使用 **DIP 坐标**，但 `screen` API 同时暴露 `bounds`（物理像素）和 `workArea`（工作区）。关键 API：

```js
const display = screen.getDisplayMatching(win.getBounds())
const scaleFactor = display.scaleFactor

// 物理像素 ↔ DIP 转换
screen.dipToScreenPoint(point)
screen.screenToDipPoint(point)
screen.dipToScreenRect(window, rect)
```

最佳实践：

1. 使用 `workArea` 而非 `bounds` 计算可用区域。
2. 恢复窗口位置时验证是否仍落在某个可用显示器内。
3. 监听 `display-metrics-changed`、`display-added`、`display-removed`，动态调整位置。
4. 跨显示器拖拽时，根据目标显示器的 `scaleFactor` 重新计算尺寸/位置。

#### 边缘吸附与 hover 揭示

常见两种模式：

| 模式 | 优点 | 缺点 |
|------|------|------|
| 单窗口滑动（浮窗本身移入/移出边缘） | 逻辑简单 | 动画期间占用 CPU，复杂 |
| 双窗口（strip 指示条 + 浮窗本体） | hover 检测轻量，体验好 | 状态同步复杂，生命周期管理难 |

优秀做法：

- 使用 `setIgnoreMouseEvents(true, { forward: true })` 让 strip 窗口既能监听 hover，又不阻挡下层操作。
- hover 揭示使用**全局鼠标位置监听**或 **strip 窗口 hover 事件**，避免高频轮询。
- 吸附状态持久化到磁盘，重启后可恢复。

### 1.2 右键菜单（Context Menu）设计

Electron 右键菜单有两种主流实现：

#### 原生 `Menu.buildFromTemplate`

```js
const { Menu } = require('electron')

const menu = Menu.buildFromTemplate([
  { role: 'copy' },
  { role: 'paste' },
  { type: 'separator' },
  { label: '自定义项', click: () => {} }
])

win.webContents.on('context-menu', (e, params) => {
  menu.popup({ window: win, x: params.x, y: params.y })
})
```

**优点**：

- 原生外观，与 OS 一致。
- 自动支持键盘导航、屏幕阅读器、高对比度。
- 无需处理窗口生命周期、焦点、外部点击关闭。
- 安全性好，菜单在主进程构建。

**缺点**：

- 样式受限，无法自定义复杂 UI（图标、色盘、开关）。
- 跨平台外观差异大。
- 动态高度/复杂布局困难。

#### 自定义 BrowserWindow 菜单

用独立的 `BrowserWindow` 渲染 Vue/React 菜单内容。

**优点**：

- 完全可控的样式、动画、主题。
- 可内嵌图标、色盘、开关、模型状态等复杂 UI。
- 跨平台视觉一致。

**缺点**：

- 需要自己管理焦点、blur 关闭、外部点击检测。
- 需要处理屏幕边界溢出、多显示器、DPI。
- 可访问性需要自己实现。
- 性能开销高于原生菜单。

**选择建议**：

| 场景 | 推荐方案 |
|------|---------|
| 标准文本编辑（copy/paste/inspect） | 原生 `Menu` |
| 需要复杂 UI（色盘、开关、图标动画） | 自定义 BrowserWindow |
| 跨平台视觉一致性优先 | 自定义 BrowserWindow |
| 需要 OS 级可访问性 | 原生 `Menu` |

TokenUsage 的右键菜单和托盘菜单都需要复杂 UI（色盘、开关、模型状态），因此选择自定义 BrowserWindow 是合理的，但需要在**生命周期、焦点、边界、状态同步**上做更严谨的设计。

## 二、当前项目缺陷总结

### 2.1 悬浮窗缺陷

#### H1. 内存泄漏风险：`dragStateMap` 在窗口异常关闭时可能未清理

**位置**：`electron/main.ts:373-402`

```ts
floatWindow.on("closed", () => {
  const dragState = edgeDock.dragStateMap.get(floatWindow?.id || -1)
  if (dragState?.intervalId) clearInterval(dragState.intervalId)
  edgeDock.dragStateMap.delete(floatWindow?.id || -1)
  // ...
  floatWindow = null
})
```

问题：窗口关闭回调中 `floatWindow?.id` 在窗口已销毁后不可靠，可能返回 `undefined`，导致 `dragStateMap` 用 `-1` 查不到真实状态，`setInterval` 定时器继续运行。

影响：内存泄漏、CPU 占用。

#### H2. `floatWindowReady` / `floatWindowReadyResolve` 未在关闭时重置

**位置**：`electron/main.ts:353-355`, `404-414`

窗口关闭时未重置 ready 标志。如果快速重建窗口，新窗口可能错误跳过 ready 等待。

#### H3. `detailWindow` 关闭后未置 null

**位置**：`electron/main.ts:386-390`

```ts
if (detailWindow && !detailWindow.isDestroyed()) {
  detailWindow.close()
}
```

`close()` 后未立即置 `null`，虽然 `WindowManager` 回调会处理，但在 `floatWindow` 的 `closed` 回调中直接调用 `detailWindow.close()` 后仍可能通过旧引用操作。

#### H4. 边缘吸附状态未持久化

**位置**：`electron/features/edge-dock.ts:58-60`

```ts
readonly edgeDockState = new Map<number, EdgeDockState>()
```

吸附状态仅存于内存，应用重启后丢失。用户每次重启都需要重新吸附。

#### M1. 多显示器 / DPI 适配不足

**位置**：`electron/utils/position.ts`

所有位置计算直接使用 `screen.getDisplayNearestPoint()` 返回的 `workArea` / `workAreaSize`，未使用 `display.scaleFactor`。在 125%、150%、200% 缩放的显示器上，坐标计算可能出现偏差。

#### M2. 悬浮窗位置恢复未验证显示器可用性

**位置**：`electron/services/persistence.ts:126-146`

```ts
const visible = displays.some((d) => {
  const { x, y, width, height } = d.workArea
  return raw.x >= x - 50 && raw.x < x + width - 50 && ...
})
```

只检查位置是否在屏幕矩形内，未处理：

- 显示器已断开但坐标仍落在旧 bounds 内。
- 多个显示器边界重叠时的歧义。
- 显示器缩放变化导致的位置漂移。

#### M3. 动画使用 `setTimeout(..., 16)` 而非 `requestAnimationFrame` 或 `setImmediate`

**位置**：`electron/features/edge-dock.ts:127-128`, `electron/main.ts:654-655`

```ts
setTimeout(animate, 16)
```

主进程动画使用固定 16ms 的 `setTimeout`，无法与显示器刷新率同步，高刷屏（144Hz）上不够流畅，且可能因事件循环延迟导致跳帧。

#### M4. 平台兼容性处理缺失

**位置**：`electron/main.ts:330-347`

```ts
floatWindow = new BrowserWindow({
  alwaysOnTop: true,
  skipTaskbar: true,
  // ...
})
```

- macOS 上 `skipTaskbar: true` 不会隐藏 dock 图标，需要额外 `app.dock.hide()`。
- `alwaysOnTop` 未指定 level，Windows 上可能被某些全屏窗口覆盖。
- 缺少 `setVisibleOnAllWorkspaces` 处理 macOS 多桌面/全屏。

#### M5. 拖拽使用 `setInterval` 而非 `setImmediate`/事件驱动

**位置**：`electron/features/edge-dock.ts:486-512`

```ts
state.intervalId = setInterval(() => {
  // ...
  win.setPosition(Math.round(newX), Math.round(newY))
}, 16)
```

高频 `setInterval` 在每次 tick 调用原生 API，虽然做了缓存优化，但仍不如 `setImmediate`/消息循环驱动精确，且增加 CPU 占用。

#### M6. `hoverPollTimer` 在窗口 destroyed 后可能残留

**位置**：`electron/features/edge-dock.ts:353-446`

虽然 `startHoverPolling` 开头检查了 `floatWindow.isDestroyed()`，但如果浮窗在 `setTimeout` 回调执行前被销毁，`pollHover` 内部访问 `floatWindow.id` 会抛错。

#### L1. 硬编码尺寸常量

**位置**：`electron/utils/position.ts:1-15`

```ts
export const FLOAT_WIDTH = 240
export const FLOAT_HEIGHT = 82
export const DETAIL_WIDTH = 320
// ...
```

尺寸全部硬编码，没有配置接口，未来需要适配不同布局时很困难。

#### L2. IPC 通道名未集中管理

**位置**：`electron/preload.ts`, `electron/main.ts`, `electron/features/*`

IPC 通道名分散在多个文件中，容易拼写错误，重构困难。

#### L3. 主题同步依赖 localStorage

**位置**：`src/pages/FloatWindow.vue:608-610`, `src/pages/TrayMenu.vue:92-97`

浮窗和托盘菜单首屏先从 `localStorage` 读取主题，再异步从主进程同步。如果两者不一致，会出现闪烁。

### 2.2 右键菜单 / 托盘菜单缺陷

#### H5. 自定义菜单缺少原生可访问性支持

**位置**：`src/pages/CtxMenu.vue`, `src/pages/TrayMenu.vue`

菜单项没有 `role`、`aria-label`、`aria-expanded`、`aria-haspopup` 等属性，屏幕阅读器无法识别。

#### M7. 自定义菜单的 blur 关闭机制存在竞态

**位置**：`electron/features/ctx-menu.ts:108-118`

```ts
onBlur(): void {
  if (this.closing) return
  if (this.showing) return
  if (this.blurTimer) clearTimeout(this.blurTimer)
  this.blurTimer = setTimeout(() => {
    // ...
    this.hide()
  }, 120)
}
```

依赖 `blur` 事件 + 120ms 延迟关闭菜单，在以下场景可能误关或关不掉：

- 菜单内部触发文件选择器、对话框时失去焦点。
- 快速切换显示/隐藏时 `showing` 状态竞争。
- 多显示器间点击，焦点转移时机不确定。

#### M8. 菜单位置计算未完全处理边界

**位置**：`electron/utils/position.ts:72-98`

```ts
if (y + menuH > workY + workH - 10) {
  y = Math.max(workY, anchorY - menuH - 2)
}
if (y < workY) y = workY
```

右键菜单只处理了右侧和底部溢出，顶部溢出时只是 clamp 到 `workY`，没有向下方翻转。

#### M9. 托盘菜单高度硬编码，未考虑内容换行

**位置**：`electron/features/tray-menu.ts:146-155`

```ts
const modelSectionH =
  payload.models.length > 0
    ? 24 + payload.models.length * TRAY_MENU_MODEL_ROW_HEIGHT + 8
    : 0
```

模型名称过长时可能换行，但高度计算按单行算，导致滚动或截断。

#### M10. 托盘菜单位置依赖光标位置，未考虑任务栏方向

**位置**：`electron/features/tray-menu.ts:178-206`

托盘菜单位置基于 `cursorX`/`cursorY`，Windows 任务栏可能在上下左右任意方向。当前代码优先显示在光标上方，但任务栏在顶部时仍可能遮挡。

#### L4. 菜单动画与窗口 show/hide 不同步

**位置**：`src/pages/CtxMenu.vue:131-144`

```css
animation: menuPop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
```

CSS 动画在窗口 show 时播放，但如果主进程 `setPosition`/`setSize` 与 `showInactive` 之间有时间差，可能出现窗口先闪现再动画。

#### L5. 右键菜单与原生 context-menu 事件双路径竞态

**位置**：`electron/main.ts:365-371`, `src/pages/FloatWindow.vue:754-800`

浮窗同时通过 Vue 的 `@contextmenu.prevent` 和主进程 `webContents.on('context-menu')` 两种路径触发菜单。虽然代码做了 `ctxMenuOpen` 标记去重，但双路径增加了复杂度和竞态风险。

### 2.3 架构层面缺陷

#### A1. 窗口生命周期状态分散

主进程中有多个独立变量管理窗口：`floatWindow`, `floatStripWindow`, `detailWindow`, `ctxMenuWindow`，以及 `WindowManager` 中的注册。状态同步靠手动赋值，容易遗漏。

#### A2. 缺乏统一的屏幕/位置抽象

`position.ts` 中多个函数独立调用 `screen` API，重复获取显示器、计算边界。没有统一的 `ScreenManager` 来处理 DPI、workArea、边界校验。

#### A3. 主进程代码臃肿

`electron/main.ts` 接近 1000 行，包含窗口创建、IPC、托盘、主题、登录、调试日志等多种职责，不符合单一职责原则。

#### A4. 缺少单元测试

项目没有针对窗口位置计算、边界检测、菜单状态机的测试，所有交互依赖手动验证。

## 三、优化方案

### 3.1 架构重构：引入窗口状态机与统一管理层

#### 目标

- 将窗口生命周期、位置、显示状态集中管理。
- 消除悬空引用和手动状态同步。
- 便于单元测试。

#### 方案

引入 `WindowLifecycleManager`：

```ts
interface ManagedWindow<TState = unknown> {
  name: string
  ref: BrowserWindow | null
  state: 'creating' | 'ready' | 'showing' | 'visible' | 'hiding' | 'closed'
  metadata: TState
  timers: Set<TimeoutId>
  listeners: Array<{ target: EventEmitter; event: string; handler: (...args: any[]) => void }>
}
```

每个窗口由 `WindowLifecycleManager` 统一创建、注册、销毁。关闭时自动清理：

- 所有 `setTimeout`/`setInterval`。
- 所有 `webContents`/`BrowserWindow` 事件监听。
- 状态机重置。

#### 实施步骤

1. 新建 `electron/core/windowLifecycle.ts`。
2. 将 `floatWindow`, `floatStripWindow`, `detailWindow`, `ctxMenuWindow`, `trayMenuWindow` 迁移到 `WindowLifecycleManager`。
3. 所有窗口创建代码改为 `lifecycle.create(name, factory, options)`。
4. 窗口访问统一通过 `lifecycle.get(name)`，避免直接引用。

### 3.2 悬浮窗专项优化

#### 3.2.1 修复内存泄漏与生命周期

**修改 `floatWindow` 关闭逻辑**：

```ts
floatWindow.on('closed', () => {
  const winId = floatWindow?.id
  if (winId !== undefined) {
    const dragState = edgeDock.dragStateMap.get(winId)
    if (dragState?.intervalId) clearInterval(dragState.intervalId)
    edgeDock.dragStateMap.delete(winId)
    edgeDock.edgeDockState.delete(winId)
  }
  // 同步关闭 detail / strip
  lifecycle.close('detail')
  lifecycle.close('floatStrip')
  ctxMenu.destroy()
  edgeDock.stopHoverPolling()
  floatWindowReady = false
  floatWindowReadyResolve = null
  floatWindow = null
  mainWindow?.webContents.send('float-window-closed')
})
```

#### 3.2.2 持久化边缘吸附状态

在 `electron/services/persistence.ts` 中新增：

```ts
export interface FloatDockState {
  edge: 'left' | 'right' | 'top'
  originalX: number
  originalY: number
}

export function loadFloatDockState(): FloatDockState | null
export function saveFloatDockState(state: FloatDockState | null): void
```

在 `EdgeDockManager.stopDragForWindow` 吸附成功时保存，在 `createFloatWindow` 时恢复。

#### 3.2.3 动画性能优化

将主进程的 `setTimeout(animate, 16)` 替换为 `setImmediate` 驱动（主进程没有 `requestAnimationFrame`）：

```ts
function rafLike(callback: () => void): void {
  if (typeof setImmediate === 'function') {
    setImmediate(callback)
  } else {
    setTimeout(callback, 0)
  }
}
```

在动画循环中使用：

```ts
const animate = () => {
  if (win.isDestroyed()) { resolve(); return }
  const elapsed = performance.now() - startTime
  const progress = Math.min(elapsed / duration, 1)
  // ...
  if (progress < 1) {
    rafLike(animate)
  } else {
    resolve()
  }
}
```

#### 3.2.4 拖拽优化

将 `setInterval` 改为 `setImmediate` 循环，或在鼠标移动事件驱动下更新位置。Windows 上也可以考虑使用 `-webkit-app-region: drag` + 主进程 `will-move` 事件，但跨平台一致性较差，建议保留 IPC 方案但优化轮询。

### 3.3 多显示器与 DPI 适配

#### 3.3.1 统一屏幕管理器

新建 `electron/core/screenManager.ts`：

```ts
export class ScreenManager {
  private displays: Display[] = []

  init() {
    this.refresh()
    screen.on('display-added', this.refresh)
    screen.on('display-removed', this.refresh)
    screen.on('display-metrics-changed', this.refresh)
  }

  refresh = () => { this.displays = screen.getAllDisplays() }

  getDisplayForWindow(win: BrowserWindow): Display {
    return screen.getDisplayMatching(win.getBounds())
  }

  getDisplayAtPoint(point: { x: number; y: number }): Display {
    return screen.getDisplayNearestPoint(point)
  }

  clampRectToWorkArea(rect: Rectangle, display = this.getDisplayAtPoint(rect)): Rectangle {
    const { x, y, width, height } = display.workArea
    return {
      x: Math.max(x, Math.min(rect.x, x + width - rect.width)),
      y: Math.max(y, Math.min(rect.y, y + height - rect.height)),
      width: Math.min(rect.width, width),
      height: Math.min(rect.height, height),
    }
  }

  isVisibleOnAnyDisplay(rect: Rectangle): boolean {
    return this.displays.some(d => this.intersectsWorkArea(rect, d))
  }
}
```

#### 3.3.2 修复位置计算

所有位置函数使用 `ScreenManager`：

```ts
export function computeCtxMenuPosition(
  anchorX: number,
  anchorY: number,
  menuW: number,
  menuH: number,
  screen: ScreenManager,
): Point {
  const display = screen.getDisplayAtPoint({ x: anchorX, y: anchorY })
  const workArea = display.workArea

  let x = anchorX + 2
  let y = anchorY + 2

  // 右侧溢出：翻转到光标左侧
  if (x + menuW > workArea.x + workArea.width - 8) {
    x = anchorX - menuW - 2
  }
  // 左侧溢出
  if (x < workArea.x + 8) x = workArea.x + 8

  // 底部溢出：翻转到光标上方
  if (y + menuH > workArea.y + workArea.height - 8) {
    y = anchorY - menuH - 2
  }
  // 顶部溢出：翻转到光标下方
  if (y < workArea.y + 8) {
    y = anchorY + 2
  }

  return { x: Math.round(x), y: Math.round(y) }
}
```

#### 3.3.3 显示器变化监听

在 `app.whenReady` 中初始化 `ScreenManager`，当显示器变化时：

- 检查浮窗是否仍在有效工作区内，必要时移回主显示器。
- 重新计算 strip 位置。
- 重新计算 detail 位置（如果可见）。

### 3.4 右键菜单与托盘菜单优化

#### 3.4.1 引入统一的 `PopupWindowManager`

为所有自定义弹出菜单（右键菜单、托盘菜单、详情浮窗）抽象统一基类：

```ts
abstract class PopupWindowManager<TPayload> {
  protected abstract readonly width: number
  protected abstract readonly height: number
  protected abstract readonly route: string
  protected abstract buildPayload(): TPayload

  show(anchor: Point): boolean {
    const win = this.ensureWindow()
    const payload = this.buildPayload()
    const { x, y } = this.computePosition(anchor, this.getPreferredSize(payload))
    win.setBounds({ x, y, width: this.width, height: this.height })
    this.sendPayload(win, payload)
    win.showInactive()
    win.focus()
    return true
  }

  hide(): void { /* ... */ }
}
```

#### 3.4.2 修复 blur 关闭竞态

改进关闭策略：

```ts
private scheduleClose() {
  if (this.closeTimer) return
  this.closeTimer = setTimeout(() => {
    this.closeTimer = null
    // 再次检查焦点是否真的离开了菜单
    const win = this.getWindow()
    if (win && !win.isFocused() && !this.isMouseOver(win)) {
      this.hide()
    }
  }, 150)
}
```

同时提供 `keepOpen()` / `release()` API，供打开子对话框时临时禁用关闭。

#### 3.4.3 增强可访问性

为 `CtxMenu.vue` 和 `TrayMenu.vue` 添加 ARIA 属性：

```html
<div role="menu" aria-label="悬浮窗菜单">
  <div role="menuitem" tabindex="0" aria-label="刷新全部" @click="act('refresh-all')">
    ...
  </div>
</div>
```

并支持键盘导航：

- ↑/↓ 切换菜单项。
- Enter/Space 执行。
- Esc 关闭。

#### 3.4.4 简化右键菜单触发路径

建议只保留一种触发路径：

- **方案 A（推荐）**：渲染进程通过 `@contextmenu.prevent` 调用 `showCtxMenu`，并传入正确的 `screenX/screenY`。
- 移除主进程 `webContents.on('context-menu')` 的兜底，因为 Vue 的 `@contextmenu` 已经能捕获。

如果确实需要未聚焦时右键触发，则改用 `webContents.on('context-menu')` 作为唯一路径，渲染进程不再监听 DOM 右键。

### 3.5 主题同步优化

#### 3.5.1 消除 localStorage 首屏闪烁

在主进程创建窗口时，将当前主题通过 `additionalArguments` 或首次 IPC 同步给渲染进程：

```ts
const theme = themeService.get()
win.webContents.on('did-finish-load', () => {
  win.webContents.send('theme:init', theme)
})
```

渲染进程优先使用 `theme:init` 设置初始 CSS 变量，再监听 `theme-changed` 更新。

#### 3.5.2 移除渲染进程 localStorage 读取主题

`FloatWindow.vue` 和 `TrayMenu.vue` 不再从 `localStorage` 读取主题，统一由主进程 `themeService` 作为唯一真相源。

### 3.6 IPC 通道集中管理

新建 `electron/core/ipcChannels.ts`：

```ts
export const IPC = {
  FLOAT: {
    OPEN: 'open-float-window',
    CLOSE: 'close-float-window',
    READY: 'float-ready',
    STATE: 'get-float-window-state',
    BOUNDS: 'get-float-window-bounds',
    SET_POSITION: 'set-float-window-position',
    RESIZE: 'resize-float-window',
    RESIZE_ANIMATED: 'resize-float-window-animated',
    SET_ALWAYS_ON_TOP: 'set-float-always-on-top',
    CLOSED: 'float-window-closed',
    OPENED: 'float-window-opened',
  },
  CTX_MENU: {
    SHOW: 'show-ctx-menu',
    HIDE: 'hide-ctx-menu',
    ACTION: 'ctx-menu-action',
    CONFIG: 'ctx-menu-config',
    CLOSED: 'ctx-menu-closed',
  },
  // ...
} as const
```

所有 `ipcMain.handle`/`ipcRenderer.invoke` 都使用 `IPC.*` 常量。

### 3.7 单元测试

为纯函数和状态机添加测试：

```ts
// electron/__tests__/position.test.ts
import { computeCtxMenuPosition } from '../utils/position'

describe('computeCtxMenuPosition', () => {
  it('flips to left when overflowing right edge', () => {
    // ...
  })
  it('flips upward when overflowing bottom edge', () => {
    // ...
  })
})
```

为 `EdgeDockManager` 的纯逻辑部分（如 `checkEdgeDocking`、`springOvershoot`）添加测试。

### 3.8 平台兼容性补齐

#### Windows

```ts
floatWindow.setAlwaysOnTop(true, 'pop-up-menu')
```

#### macOS

```ts
if (process.platform === 'darwin') {
  app.dock.hide() // 如果希望完全隐藏 dock 图标
  floatWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  floatWindow.setAlwaysOnTop(true, 'floating')
}
```

#### Linux

启动参数添加 `--enable-transparent-visuals` 兜底（可在 `electron-builder.yml` 或代码中处理）。

## 四、实施优先级

| 优先级 | 任务 | 预期收益 |
|--------|------|---------|
| P0 | 修复 `dragStateMap` 内存泄漏 | 避免长期运行后 CPU/内存异常 |
| P0 | 修复 `floatWindowReady` 竞态 | 避免窗口重建后状态混乱 |
| P0 | 持久化边缘吸附状态 | 提升用户体验 |
| P1 | 引入 `WindowLifecycleManager` | 解决悬空引用，统一生命周期 |
| P1 | 引入 `ScreenManager` 处理 DPI/多显示器 | 提升跨设备稳定性 |
| P1 | 修复右键菜单 blur 竞态 | 提升菜单稳定性 |
| P2 | 动画改用 `setImmediate` | 提升流畅度 |
| P2 | 主题同步消除 localStorage 闪烁 | 提升视觉体验 |
| P2 | IPC 通道集中管理 | 提升可维护性 |
| P3 | 添加 ARIA 与键盘导航 | 提升可访问性 |
| P3 | 单元测试 | 提升代码质量 |

## 五、风险与注意事项

1. **透明窗口在 Windows 上的 DWM 要求**：部分旧版 Windows 或远程桌面环境可能不支持透明，需要准备降级方案（实色背景）。
2. **macOS 的 `app.dock.hide()`**：隐藏 dock 图标后，用户无法通过 dock 切换回主窗口，需要确保托盘菜单或快捷键可以唤醒主窗口。
3. **`setAlwaysOnTop` 层级过高**：`screen-saver` 级可能覆盖系统级 UI（如 UAC、锁屏），应谨慎用于普通浮窗。
4. **拖拽方案变更**：从 `setInterval` 改为事件驱动需要充分测试快速拖拽、跨显示器拖拽。
5. **状态持久化格式**：保存吸附状态时注意版本兼容，未来若增加更多状态字段需做迁移。

## 六、总结

TokenUsage 的悬浮窗和右键菜单在功能上已经比较完整，但在**生命周期管理、内存泄漏、多显示器/DPI 适配、焦点/Blur 竞态、架构拆分**方面存在明显改进空间。通过引入 `WindowLifecycleManager`、`ScreenManager`、统一 `PopupWindowManager`，并修复关键竞态和内存泄漏，可以显著提升应用的稳定性、可维护性和跨平台体验。

Sources:
- [Frameless Window | Electron](https://electronjs.org/docs/latest/tutorial/frameless-window)
- [BrowserWindow | Electron](https://electronjs.org/docs/latest/api/browser-window)
- [Context Menu | Electron](https://electronjs.org/docs/latest/tutorial/context-menu)
- [Menu | Electron](https://electronjs.org/docs/latest/api/menu)
- [screen | Electron](https://electronjs.org/docs/latest/api/screen)
- [Building High-Performance Electron Apps - Johnny Le](https://johnnyle.io/read/electron-performance)
- [Your Node is Leaking Memory? setTimeout Could be the Reason](https://lucumr.pocoo.org/2024/6/5/node-timeout/)
- [A Universal Method for Displaying Native and Custom Menus - Innei](https://innei.in/en/posts/tech/a-universal-method-about-show-electron-native-and-web-custom-menus)
- [Menus in Electron apps -- Application, Tray, Context](https://blog.bloomca.me/2025/07/20/menus-in-electron.html)
