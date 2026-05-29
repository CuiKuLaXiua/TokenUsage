# 悬浮窗拖拽修复：IPC 自定义拖拽方案

## TL;DR

> **Quick Summary**: 放弃 Electron 的 `-webkit-app-region: drag`，改用 JavaScript 监听鼠标事件 + IPC 移动窗口，彻底解决拖拽与 hover 的冲突。
> 
> **Deliverables**:
> - 修改 `electron/main.ts`：添加拖拽 IPC 处理器
> - 修改 `electron/preload.ts`：暴露拖拽 API
> - 修改 `src/pages/FloatWindow.vue`：实现拖拽逻辑 + 移除所有 `-webkit-app-region: drag`
> 
> **Estimated Effort**: Quick
> **Parallel Execution**: NO - 顺序执行（文件间有依赖）
> **Critical Path**: main.ts → preload.ts → FloatWindow.vue

---

## Context

### Original Request
悬浮窗存在一个问题：无法鼠标拖拽，但启用 `-webkit-app-region: drag` 又会导致无法触发 hover 弹出其他模型。

### Problem Analysis
- **根因**: `-webkit-app-region: drag` 会让 Electron OS 层拦截所有鼠标事件（click、mousedown、mouseup），导致子元素无法响应交互
- **矛盾**: 在列表模式下，初始只显示概览卡，需要 hover 到窗口触发 `expandList` 展开模型列表。如果概览卡设为 `drag`，hover 事件可能被拦截
- **结论**: 唯一解决方案是完全放弃 `-webkit-app-region: drag`，改用 IPC 自定义拖拽

---

## Work Objectives

### Core Objective
实现悬浮窗的鼠标拖拽功能，同时保持 hover 展开模型列表、click、右键菜单等所有交互正常。

### Concrete Deliverables
- `electron/main.ts`：新增 `start-window-drag`、`window-drag-move`、`stop-window-drag` IPC 处理器
- `electron/preload.ts`：暴露 `startWindowDrag`、`windowDragMove`、`stopWindowDrag` API
- `src/pages/FloatWindow.vue`：实现拖拽逻辑 + 移除所有 `-webkit-app-region` 相关 CSS

### Definition of Done
- [ ] 悬浮窗可通过鼠标拖拽移动位置
- [ ] hover 到悬浮窗可正常展开模型列表
- [ ] 模型卡片的 click 和右键菜单正常工作
- [ ] 轮播模式的滑动切换正常工作
- [ ] 拖拽不会误触发 click 事件

### Must Have
- 鼠标拖拽移动窗口功能
- hover 展开/收起模型列表功能
- 拖拽阈值（5px）防止误触 click

### Must NOT Have (Guardrails)
- 不使用 `-webkit-app-region: drag`
- 不影响主窗口的拖拽逻辑
- 不添加额外的 UI 元素（如拖拽手柄）

---

## Verification Strategy

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: None
- **Framework**: none

### QA Policy
Every task includes agent-executed QA scenarios.
Evidence saved to `.omo/evidence/task-{N}-{scenario-slug}.{ext}`.

---

## Execution Strategy

### Sequential Execution (3 tasks, 文件间有依赖)

```
Task 1: main.ts - 添加 IPC 处理器 [quick]
    ↓
Task 2: preload.ts - 暴露 API [quick]
    ↓
Task 3: FloatWindow.vue - 实现拖拽逻辑 [quick]
```

### Dependency Matrix

| Task | Depends On | Blocks |
|------|------------|--------|
| 1    | None       | 2      |
| 2    | 1          | 3      |
| 3    | 2          | None   |

---

## TODOs

- [ ] 1. electron/main.ts - 添加拖拽 IPC 处理器

  **What to do**:
  - 添加 `start-window-drag` IPC 处理器：接收 `{ mouseX, mouseY }`，记录初始鼠标位置和窗口位置
  - 添加 `window-drag-move` IPC 处理器：接收 `{ mouseX, mouseY }`，计算偏移并调用 `window.setPosition()` 移动窗口
  - 添加 `stop-window-drag` IPC 处理器：清除拖拽状态
  - 使用一个 `Map` 或变量存储每个窗口的拖拽状态（支持多窗口）

  **Must NOT do**:
  - 不修改现有的窗口创建逻辑
  - 不影响主窗口的行为

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 2
  - **Blocked By**: None (can start immediately)

  **References**:
  - `electron/main.ts:97-126` - `createFloatWindow()` 函数，了解 floatWindow 的创建方式
  - `electron/main.ts:24` - `let floatWindow: BrowserWindow | null = null` 变量声明
  - `electron/main.ts:240-245` - `set-float-always-on-top` IPC 处理器，参考 IPC 注册模式
  - `electron/preload.ts:36-84` - 现有 API 暴露模式，参考 `ipcRenderer.invoke` 调用方式

  **Acceptance Criteria**:
  - [ ] `start-window-drag` IPC 处理器已添加
  - [ ] `window-drag-move` IPC 处理器已添加
  - [ ] `stop-window-drag` IPC 处理器已添加
  - [ ] 窗口可通过 IPC 调用移动位置

  **QA Scenarios**:

  ```
  Scenario: IPC 处理器注册成功
    Tool: Bash
    Preconditions: 应用已启动
    Steps:
      1. 检查 electron/main.ts 文件是否包含 `ipcMain.handle('start-window-drag'`
      2. 检查 electron/main.ts 文件是否包含 `ipcMain.handle('window-drag-move'`
      3. 检查 electron/main.ts 文件是否包含 `ipcMain.handle('stop-window-drag'`
    Expected Result: 三个 IPC 处理器都已注册
    Evidence: .omo/evidence/task-1-ipc-handlers.txt

  Scenario: 拖拽逻辑正确性
    Tool: Bash
    Preconditions: 代码已编写
    Steps:
      1. 检查 `start-window-drag` 处理器是否正确记录初始位置
      2. 检查 `window-drag-move` 处理器是否正确计算偏移并调用 `setPosition`
      3. 检查 `stop-window-drag` 处理器是否正确清除状态
    Expected Result: 逻辑正确，支持窗口移动
    Evidence: .omo/evidence/task-1-drag-logic.txt
  ```

  **Commit**: YES
  - Message: `feat(electron): add drag IPC handlers for float window`
  - Files: `electron/main.ts`
  - Pre-commit: None

- [ ] 2. electron/preload.ts - 暴露拖拽 API

  **What to do**:
  - 在 `ElectronAPI` 接口中添加 `startWindowDrag`、`windowDragMove`、`stopWindowDrag` 方法
  - 在 `electronAPI` 对象中实现这三个方法，调用对应的 IPC
  - 参数类型：
    - `startWindowDrag(options: { mouseX: number, mouseY: number }): Promise<void>`
    - `windowDragMove(options: { mouseX: number, mouseY: number }): Promise<void>`
    - `stopWindowDrag(): Promise<void>`

  **Must NOT do**:
  - 不修改现有的 API 方法
  - 不改变现有的接口结构

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:
  - `electron/preload.ts:3-34` - `ElectronAPI` 接口定义，参考现有方法签名
  - `electron/preload.ts:36-84` - `electronAPI` 对象实现，参考 `ipcRenderer.invoke` 调用模式
  - `electron/main.ts` (Task 1) - 确认 IPC 通道名称和参数类型

  **Acceptance Criteria**:
  - [ ] `ElectronAPI` 接口已添加三个新方法
  - [ ] `electronAPI` 对象已实现三个新方法
  - [ ] TypeScript 类型正确

  **QA Scenarios**:

  ```
  Scenario: API 暴露正确
    Tool: Bash
    Preconditions: 代码已编写
    Steps:
      1. 检查 `ElectronAPI` 接口是否包含 `startWindowDrag` 方法
      2. 检查 `ElectronAPI` 接口是否包含 `windowDragMove` 方法
      3. 检查 `ElectronAPI` 接口是否包含 `stopWindowDrag` 方法
      4. 检查 `electronAPI` 对象是否实现了这三个方法
    Expected Result: 接口和实现都已添加
    Evidence: .omo/evidence/task-2-api-exposed.txt

  Scenario: 类型正确性
    Tool: Bash
    Preconditions: 代码已编写
    Steps:
      1. 检查 `startWindowDrag` 参数类型是否为 `{ mouseX: number, mouseY: number }`
      2. 检查 `windowDragMove` 参数类型是否为 `{ mouseX: number, mouseY: number }`
      3. 检查 `stopWindowDrag` 参数是否为空
    Expected Result: 类型定义正确
    Evidence: .omo/evidence/task-2-types.txt
  ```

  **Commit**: YES
  - Message: `feat(preload): expose drag APIs for float window`
  - Files: `electron/preload.ts`
  - Pre-commit: None

- [ ] 3. src/pages/FloatWindow.vue - 实现拖拽逻辑

  **What to do**:
  - 移除 `.float-window` 的 `-webkit-app-region: drag`（第 612 行）
  - 移除 `.float-empty` 的 `-webkit-app-region: no-drag`（第 622 行）
  - 移除 `.list-wrap` 的 `-webkit-app-region: no-drag`（第 629 行）
  - 移除 `.carousel-wrap` 的 `-webkit-app-region: no-drag`（第 825 行）
  - 添加拖拽状态变量：
    - `isDragging` - 是否正在拖拽
    - `dragStartX` / `dragStartY` - 鼠标按下时的屏幕坐标
    - `hasMoved` - 是否移动超过阈值（5px）
  - 实现 `onWindowDragStart(e: MouseEvent)` 方法：
    - 记录 `e.screenX` / `e.screenY` 作为起始位置
    - 设置 `isDragging = true`，`hasMoved = false`
    - 调用 `window.electronAPI.startWindowDrag({ mouseX: e.screenX, mouseY: e.screenY })`
  - 实现 `onWindowDragMove(e: MouseEvent)` 方法：
    - 如果 `!isDragging` 则返回
    - 计算移动距离，如果超过 5px 则设置 `hasMoved = true`
    - 如果 `hasMoved`，调用 `window.electronAPI.windowDragMove({ mouseX: e.screenX, mouseY: e.screenY })`
  - 实现 `onWindowDragEnd()` 方法：
    - 设置 `isDragging = false`
    - 调用 `window.electronAPI.stopWindowDrag()`
  - 在 `.float-window` 上绑定事件：
    - `@mousedown="onWindowDragStart"`
    - `@mousemove="onWindowDragMove"`
    - `@mouseup="onWindowDragEnd"`
    - `@mouseleave="onWindowDragEnd"`
  - 修改 `showMenu` 函数：如果 `hasMoved` 则不显示右键菜单（防止拖拽后误触发）

  **Must NOT do**:
  - 不修改现有的 hover 逻辑（`expandList` / `collapseList`）
  - 不修改现有的 carousel 滑动逻辑
  - 不修改右键菜单逻辑（除了添加 `hasMoved` 检查）

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None
  - **Blocked By**: Task 2

  **References**:
  - `src/pages/FloatWindow.vue:600-613` - `.float-window` CSS，需要移除 `-webkit-app-region: drag`
  - `src/pages/FloatWindow.vue:615-623` - `.float-empty` CSS，需要移除 `-webkit-app-region: no-drag`
  - `src/pages/FloatWindow.vue:625-629` - `.list-wrap` CSS，需要移除 `-webkit-app-region: no-drag`
  - `src/pages/FloatWindow.vue:818-825` - `.carousel-wrap` CSS，需要移除 `-webkit-app-region: no-drag`
  - `src/pages/FloatWindow.vue:284-598` - Script 部分，参考现有事件处理模式
  - `src/pages/FloatWindow.vue:427-453` - `showMenu` 函数，需要添加 `hasMoved` 检查
  - `src/pages/FloatWindow.vue:519-552` - 现有 carousel drag 实现，参考拖拽模式
  - `electron/preload.ts` (Task 2) - 确认 API 方法名称和参数

  **Acceptance Criteria**:
  - [ ] 所有 `-webkit-app-region` 相关 CSS 已移除
  - [ ] 拖拽状态变量已添加
  - [ ] `onWindowDragStart`、`onWindowDragMove`、`onWindowDragEnd` 方法已实现
  - [ ] `.float-window` 已绑定 mousedown/mousemove/mouseup/mouseleave 事件
  - [ ] `showMenu` 已添加 `hasMoved` 检查
  - [ ] 拖拽阈值（5px）已实现

  **QA Scenarios**:

  ```
  Scenario: CSS 清理完成
    Tool: Bash
    Preconditions: 代码已修改
    Steps:
      1. 在 FloatWindow.vue 中搜索 `-webkit-app-region`
      2. 确认没有任何 `-webkit-app-region: drag` 或 `-webkit-app-region: no-drag`
    Expected Result: 无 `-webkit-app-region` 相关 CSS
    Evidence: .omo/evidence/task-3-css-clean.txt

  Scenario: 拖拽逻辑实现正确
    Tool: Bash
    Preconditions: 代码已编写
    Steps:
      1. 检查 `onWindowDragStart` 方法是否记录 `screenX`/`screenY`
      2. 检查 `onWindowDragMove` 方法是否计算移动距离并调用 IPC
      3. 检查 `onWindowDragEnd` 方法是否调用 `stopWindowDrag`
      4. 检查 `.float-window` 是否绑定了 mousedown/mousemove/mouseup 事件
    Expected Result: 拖拽逻辑完整实现
    Evidence: .omo/evidence/task-3-drag-logic.txt

  Scenario: 拖拽阈值防止误触
    Tool: Bash
    Preconditions: 代码已编写
    Steps:
      1. 检查是否实现了 5px 的拖拽阈值
      2. 检查 `hasMoved` 变量是否用于区分拖拽和点击
      3. 检查 `showMenu` 是否检查 `hasMoved`
    Expected Result: 拖拽不会误触发 click/右键菜单
    Evidence: .omo/evidence/task-3-threshold.txt
  ```

  **Commit**: YES
  - Message: `feat(float-window): implement IPC-based drag to fix hover conflict`
  - Files: `src/pages/FloatWindow.vue`
  - Pre-commit: None

---

## Final Verification Wave

- [ ] F1. **功能验证** — `unspecified-high`
  启动应用，打开悬浮窗，验证：
  1. 鼠标拖拽可移动窗口
  2. hover 可展开模型列表
  3. 模型卡片 click 和右键菜单正常
  4. 轮播模式滑动正常
  5. 拖拽不会误触发 click

- [ ] F2. **代码质量** — `unspecified-high`
  检查所有修改的文件：
  1. 无 TypeScript 错误
  2. 无 `-webkit-app-region` 残留
  3. 逻辑清晰，无冗余代码

---

## Commit Strategy

- **Task 1**: `feat(electron): add drag IPC handlers for float window` - electron/main.ts
- **Task 2**: `feat(preload): expose drag APIs for float window` - electron/preload.ts
- **Task 3**: `feat(float-window): implement IPC-based drag to fix hover conflict` - src/pages/FloatWindow.vue

---

## Success Criteria

### Final Checklist
- [ ] 悬浮窗可通过鼠标拖拽移动位置
- [ ] hover 到悬浮窗可正常展开模型列表
- [ ] 模型卡片的 click 和右键菜单正常工作
- [ ] 轮播模式的滑动切换正常工作
- [ ] 拖拽不会误触发 click 事件
- [ ] 无 `-webkit-app-region: drag` 相关代码残留
