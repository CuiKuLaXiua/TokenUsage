# 仪表盘自适应布局优化计划

## TL;DR

> **快速摘要**: 修复仪表盘内容区域高度和宽度自适应问题，确保模型额度区域在各种窗口尺寸下都能完整显示，底部内容不被裁剪。
> 
> **交付物**:
> - 修复后的 AppLayout.vue 布局约束链
> - 优化后的 Dashboard.vue 响应式样式
> - 完整的窗口尺寸自适应方案
> 
> **预估工作量**: Short (1-2 小时)
> **并行执行**: NO - 顺序执行（依赖关系明确）
> **关键路径**: AppLayout.vue → Dashboard.vue → 验证

---

## Context

### 原始需求
用户报告仪表盘内容区高度和宽度没有很好的自适应，导致模型额度区域的内容显示不全，底部部分被裁剪遮挡。

### 问题分析

**根因 1: Flex 布局约束链断裂**
- `.main-content` 使用 `height: calc(100vh - 36px)` + `overflow: hidden`
- `.content-area` 作为 flex 子项缺少 `min-height: 0`，导致无法正确收缩
- 当内容超出时，`overflow-y: auto` 无法生效，内容被父容器裁剪

**根因 2: 宽度自适应不足**
- `.hero-grid` 使用 `grid-template-columns: 1fr 240px`，右侧固定 240px
- `.model-grid` 使用 `minmax(280px, 1fr)`，在窄容器下可能溢出
- 响应式断点未考虑 Electron 窗口最小宽度 1000px

**根因 3: 视口高度计算不稳定**
- 使用 `100vh` 在某些环境下不准确（如移动端浏览器地址栏）
- 应优先使用 `100dvh`（dynamic viewport height）

### 当前布局结构

```
.app-layout (min-height: 100vh, flex column)
├── .title-bar (height: 36px, fixed)
├── .sidebar (width: 240px, fixed)
└── .main-content (height: calc(100vh - 36px), margin-left: 240px, flex column, overflow: hidden)
    ├── .glass-header (height: 68px, flex-shrink: 0)
    └── .content-area (flex: 1, overflow-y: auto)
        └── .dashboard (flex column)
            ├── .hero-section
            │   └── .hero-grid (grid: 1fr 240px)
            └── .models-section
                └── .model-grid (grid: repeat(auto-fill, minmax(280px, 1fr)))
```

---

## Work Objectives

### 核心目标
修复仪表盘内容区域的自适应问题，确保：
1. 垂直方向：内容超出时出现滚动条，底部内容不被裁剪
2. 水平方向：内容宽度自适应窗口宽度，不溢出
3. 响应式：在不同窗口尺寸下都能正确显示

### 具体交付物
- `src/components/AppLayout.vue` - 修复布局约束链
- `src/pages/Dashboard.vue` - 优化响应式样式

### 完成定义
- [ ] 窗口高度 700px 时，模型额度区域可滚动查看完整内容
- [ ] 窗口宽度 1000px 时，所有内容正常显示无溢出
- [ ] 侧边栏折叠/展开时布局正确切换
- [ ] 响应式断点平滑过渡

### 必须实现
- `.content-area` 添加 `min-height: 0` 使 flex 子项可收缩
- `.main-content` 使用 `dvh` 优先，回退 `vh`
- `.hero-grid` 在小窗口下切换为单列布局
- `.model-grid` 使用更灵活的 `minmax` 约束

### 必须 NOT 实现
- 不改变视觉设计（只修复布局）
- 不添加新的 UI 组件
- 不修改业务逻辑

---

## Verification Strategy

### 测试决策
- **基础设施存在**: NO
- **自动化测试**: NO（UI 布局修复，依赖视觉验证）
- **QA 策略**: Agent 执行的 Playwright 截图验证

### QA 策略
每个任务必须包含 agent 执行的 QA 场景。
证据保存到 `.omo/evidence/task-{N}-{scenario-slug}.{ext}`。

- **UI 验证**: 使用 Playwright 截图，验证布局在不同尺寸下的表现

---

## Execution Strategy

### 执行顺序

```
Wave 1 (顺序执行):
├── Task 1: 修复 AppLayout.vue 布局约束链 [quick]
├── Task 2: 优化 Dashboard.vue 响应式样式 [quick]
└── Task 3: 验证修复效果 [quick]

Critical Path: Task 1 → Task 2 → Task 3
```

---

## TODOs

- [ ] 1. 修复 AppLayout.vue 布局约束链

  **What to do**:
  - 为 `.content-area` 添加 `min-height: 0`，使 flex 子项可收缩到内容高度以下
  - 为 `.main-content` 添加 `dvh` 优先，回退 `vh`，确保视口高度计算准确
  - 确保 `.glass-header` 的 `flex-shrink: 0` 保持不变

  **Must NOT do**:
  - 不改变视觉样式（padding、颜色、字体等）
  - 不改变侧边栏和标题栏的行为

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 单文件 CSS 修改，风险低

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 2
  - **Blocked By**: None

  **References**:
  - `src/components/AppLayout.vue:414-428` - 当前 `.main-content` 样式
  - `src/components/AppLayout.vue:480-487` - 当前 `.content-area` 样式

  **Acceptance Criteria**:
  - [ ] `.content-area` 包含 `min-height: 0`
  - [ ] `.main-content` 包含 `height: calc(100dvh - 36px)` 和回退值

  **QA Scenarios**:

  ```
  Scenario: 验证布局约束链修复
    Tool: Playwright
    Preconditions: Electron 窗口大小 1200x800
    Steps:
      1. 打开 http://localhost:3002/#/dashboard
      2. 等待页面加载完成
      3. 截图保存为 task-1-layout-fix.png
      4. 检查 .content-area 元素是否可滚动（scrollHeight > clientHeight）
    Expected Result: 页面正常显示，无内容裁剪
    Evidence: .omo/evidence/task-1-layout-fix.png
  ```

  **Commit**: YES
  - Message: `fix(layout): add min-height:0 to content-area for proper flex shrinking`
  - Files: `src/components/AppLayout.vue`

---

- [ ] 2. 优化 Dashboard.vue 响应式样式

  **What to do**:
  - 修改 `.hero-grid` 的 `grid-template-columns`，在小窗口下自动切换为单列
  - 修改 `.model-grid` 的 `minmax` 最小值从 280px 降低到 240px
  - 添加新的响应式断点适配 Electron 最小宽度 1000px
  - 确保 `.dashboard` 有 `width: 100%` 和 `min-height: 0`

  **Must NOT do**:
  - 不改变卡片内部布局
  - 不改变动画效果

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 单文件 CSS 修改，主要是响应式断点调整

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: Task 3
  - **Blocked By**: Task 1

  **References**:
  - `src/pages/Dashboard.vue:345-352` - 当前 `.dashboard` 样式
  - `src/pages/Dashboard.vue:361-365` - 当前 `.hero-grid` 样式
  - `src/pages/Dashboard.vue:788-792` - 当前 `.model-grid` 样式
  - `src/pages/Dashboard.vue:955-979` - 当前响应式断点
  - `electron/main.ts:61-65` - Electron 窗口最小宽度 1000px

  **Acceptance Criteria**:
  - [ ] `.dashboard` 包含 `width: 100%` 和 `min-height: 0`
  - [ ] `.hero-grid` 在宽度 < 900px 时切换为单列
  - [ ] `.model-grid` 使用 `minmax(240px, 1fr)`
  - [ ] 新增 `@media (max-width: 1000px)` 断点

  **QA Scenarios**:

  ```
  Scenario: 验证宽窗口布局 (1200px)
    Tool: Playwright
    Preconditions: Electron 窗口大小 1200x800
    Steps:
      1. 打开 http://localhost:3002/#/dashboard
      2. 等待页面加载完成
      3. 截图保存为 task-2-wide-layout.png
      4. 验证 .hero-grid 为双列布局
      5. 验证 .model-grid 为三列布局
    Expected Result: 宽窗口下显示双列 hero 和三列模型卡片
    Evidence: .omo/evidence/task-2-wide-layout.png

  Scenario: 验证窄窗口布局 (1000px)
    Tool: Playwright
    Preconditions: Electron 窗口大小 1000x700
    Steps:
      1. 打开 http://localhost:3002/#/dashboard
      2. 等待页面加载完成
      3. 截图保存为 task-2-narrow-layout.png
      4. 验证 .hero-grid 为单列布局
      5. 验证 .model-grid 为两列布局
    Expected Result: 窄窗口下自动切换为单列 hero 和两列模型卡片
    Evidence: .omo/evidence/task-2-narrow-layout.png
  ```

  **Commit**: YES
  - Message: `fix(dashboard): improve responsive layout for small windows`
  - Files: `src/pages/Dashboard.vue`

---

- [ ] 3. 验证修复效果

  **What to do**:
  - 使用 Playwright 在不同窗口尺寸下截图验证
  - 验证滚动条正常工作
  - 验证内容不被裁剪

  **Must NOT do**:
  - 不修改任何代码

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: []
  - Reason: 纯验证任务

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: None
  - **Blocked By**: Task 1, Task 2

  **References**:
  - Task 1 和 Task 2 的修改内容

  **Acceptance Criteria**:
  - [ ] 所有截图显示正常布局
  - [ ] 无内容裁剪
  - [ ] 滚动条正常工作

  **QA Scenarios**:

  ```
  Scenario: 综合验证 - 标准尺寸
    Tool: Playwright
    Preconditions: Electron 窗口大小 1200x800
    Steps:
      1. 打开 http://localhost:3002/#/dashboard
      2. 等待页面加载完成
      3. 截图保存为 task-3-standard.png
      4. 滚动到页面底部
      5. 截图保存为 task-3-scrolled.png
    Expected Result: 页面可正常滚动，底部内容完整显示
    Evidence: .omo/evidence/task-3-standard.png, .omo/evidence/task-3-scrolled.png

  Scenario: 综合验证 - 最小尺寸
    Tool: Playwright
    Preconditions: Electron 窗口大小 1000x700
    Steps:
      1. 打开 http://localhost:3002/#/dashboard
      2. 等待页面加载完成
      3. 截图保存为 task-3-minimum.png
      4. 验证所有内容可访问（滚动查看）
    Expected Result: 最小窗口下内容可滚动查看，无裁剪
    Evidence: .omo/evidence/task-3-minimum.png
  ```

  **Commit**: NO

---

## Final Verification Wave

- [ ] F1. **Plan Compliance Audit** — `oracle`
  验证所有 Must Have 条件满足，所有 Must NOT Have 条件未违反。

- [ ] F2. **Visual QA** — `unspecified-high`
  在不同窗口尺寸下截图验证，确认布局正确。

---

## Commit Strategy

- **Task 1**: `fix(layout): add min-height:0 to content-area for proper flex shrinking` - AppLayout.vue
- **Task 2**: `fix(dashboard): improve responsive layout for small windows` - Dashboard.vue

---

## Success Criteria

### 验证命令
```bash
# 启动开发服务器
npm run dev

# 在 Electron 窗口中验证：
# 1. 调整窗口大小到 1200x800 - 应显示双列 hero + 三列模型卡片
# 2. 调整窗口大小到 1000x700 - 应显示单列 hero + 两列模型卡片
# 3. 滚动页面 - 底部内容应完整显示
```

### 最终检查清单
- [ ] 所有 "Must Have" 已实现
- [ ] 所有 "Must NOT Have" 未违反
- [ ] 垂直滚动正常工作
- [ ] 水平方向无溢出
- [ ] 响应式断点平滑过渡
- [ ] 侧边栏折叠/展开正常
