# MiMo BrowserWindow 嵌入式登录

## TL;DR

> **Quick Summary**: 利用 Electron BrowserWindow 打开 MiMo 登录页，用户登录后关闭窗口自动提取 Cookie 并存储；API 请求失败（401/403/自定义错误）时自动弹出登录窗口引导重新登录。
>
> **Deliverables**:
> - `electron/login.ts` — LoginWindowManager 类（BrowserWindow 生命周期管理 + Cookie 提取）
> - `electron/main.ts` — 新增 IPC handler：`open-mimo-login`、`close-mimo-login`
> - `electron/preload.ts` — 暴露 `openMimoLogin()`、`onLoginNeeded` 回调
> - `src/types/electron.d.ts` — 新增接口声明
> - `src/stores/app.ts` — ModelConfig 新增 `loginUrl` 字段 + login 状态管理 + login 完成回调
> - `src/components/LoginButton.vue` — 手动登录按钮
> - `src/components/LoginNotification.vue` — 登录过期/进行中通知条
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES — 3 waves
> **Critical Path**: Task 1 → Task 6 → Task 9 → F1-F4

---

## Context

### Original Request
"嵌入式 BrowserWindow 登录，利用 Electron 的 BrowserWindow 能力，打开 MiMo 登录页，用户登录后自动提取 Cookie。Cookie 会过期。可以在每次请求失败时自动弹出登录窗口。"

### Interview Summary

**Key Discussions**:
- **Login URL**: 存储在 config.json 的 model 配置中，方便更新
- **Login Detection**: 用户手动关闭登录窗口视为登录完成，不监控 URL/DOM/网络请求
- **Cookie Domain**: 提取 `platform.xiaomimimo.com` 域名的 cookies
- **Error Detection**: 组合判断—— HTTP 状态码（401、403）+ response body 错误信息
- **User Experience**: 登录窗口为非模态 + 显示消息说明原因
- **Multi-Window**: 登录窗口已打开时再次触发 → 显示通知提示登录进行中
- **Manual Trigger**: 提供"登录"按钮手动触达
- **Timeout**: 5 分钟常规超时

**Research Findings**:
- **Current Implementation**:
  - MiMo API 调用走 `fetch-mimo-usage` IPC handler（`electron/main.ts:225`）
  - Cookies 在 `config.json` 的 `models[].cookies` 中手动配置
  - API 端点：`https://platform.xiaomimimo.com/api/v1/tokenPlan/usage`
  - 请求使用 `net.request` + `Cookie` header（`electron/main.ts:251-253`）
- **Project Structure**:
  - 主进程：`electron/main.ts`
  - 预加载：`electron/preload.ts`
  - API 服务：`src/services/api.ts`
  - 状态管理：`src/stores/app.ts`

---

## Work Objectives

### Core Objective
为 MiMo 平台实现嵌入式 BrowserWindow 登录流程：自动 Cookie 提取 → 持久化存储 → Cookie 过期时自动弹出登录窗口。

### Concrete Deliverables
- `electron/login.ts` — LoginWindowManager 类
- `electron/main.ts` — 新增 2 个 IPC handler
- `electron/preload.ts` — 新增 2 个 IPC 方法 + 1 个回调
- `src/types/electron.d.ts` — 接口扩展
- `src/stores/app.ts` — ModelConfig 扩展 + login state
- `src/components/LoginButton.vue` — 登录按钮组件
- `src/components/LoginNotification.vue` — 提示条组件

### Definition of Done
- [ ] 点击登录按钮 → BrowserWindow 打开 MiMo 登录页
- [ ] 登录完成后关闭窗口 → Cookie 自动提取并存储到 config
- [ ] API 返回 401/403 → 自动弹出登录窗口
- [ ] 登录窗口已打开时 → 显示"登录进行中"通知
- [ ] 重新登录后 → 自动重试失败的 API 请求

### Must Have
- BrowserWindow 打开 MiMo 登录页
- 关闭窗口后自动提取并存储 Cookie（`platform.xiaomimimo.com` 域）
- API 失败时自动弹出登录窗口（非模态 + 原因说明）
- 手动登录按钮入口
- Cookie 过期检测（HTTP 状态码 + response body 双重判断）
- 多窗口防重保护

### Must NOT Have (Guardrails)
- 不处理 Kimi、DeepSeek 等其他 provider 的登录
- 不对 Cookie 做加密/安全处理（基础存储即可）
- 不做高级 Cookie 管理 UI（如查看/编辑/删除单条 Cookie）
- 不改变现有 API 解析逻辑（`src/services/api.ts`）
- 不引入新的 npm 依赖

---

## Verification Strategy (MANDATORY)

> **ZERO HUMAN INTERVENTION** - ALL verification is agent-executed. No exceptions.

### Test Decision
- **Infrastructure exists**: NO
- **Automated tests**: NO
- **Agent-Executed QA**: ALWAYS（每个任务必须包含 QA Scenarios）

### QA Policy
每个 TODO 必须包含 agent-executed QA Scenarios：
- 前端/UI：使用 Playwright — 导航、交互、断言 DOM、截图
- 主进程/IPC：使用 interactive_bash 启动 Electron 应用 + 检查日志/输出
- Cookie/存储：使用 Bash 读取 config.json 验证

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Start Immediately — 类型 + 核心模块):
├── Task 1: ModelConfig 新增 loginUrl 字段 [quick]
├── Task 2: 创建 LoginWindowManager 模块 [deep]
└── Task 3: 更新 ElectronAPI 类型定义 [quick]

Wave 2 (After Wave 1 — 主进程 + preload + store):
├── Task 4: main.ts 新增 login IPC handler [deep]
├── Task 5: preload.ts 暴露 login API [quick]
└── Task 6: app store 集成 login 流程 [deep]

Wave 3 (After Wave 2 — UI + 错误处理):
├── Task 7: LoginButton 组件 [visual-engineering]
├── Task 8: LoginNotification 组件 [visual-engineering]
└── Task 9: fetch-mimo-usage 集成 Cookie 过期检测 [deep]

Wave FINAL (After ALL tasks — 4 parallel reviews):
├── Task F1: Plan Compliance Audit (oracle)
├── Task F2: Code Quality Review (unspecified-high)
├── Task F3: Real Manual QA (unspecified-high)
└── Task F4: Scope Fidelity Check (deep)
```

### Dependency Matrix

| Task | Blocked By | Blocks |
|------|-----------|--------|
| 1 | - | 6, 7 |
| 2 | - | 4 |
| 3 | - | 4, 5, 6 |
| 4 | 2, 3 | 9 |
| 5 | 3 | 6, 7, 8 |
| 6 | 1, 3, 5 | 7, 8, 9 |
| 7 | 6, 5 | - |
| 8 | 6, 5 | - |
| 9 | 4, 6 | - |

**Critical Path**: Task 1 → Task 6 → Task 9 → F1-F4
**Max Concurrent**: 3 (Wave 1 & 3), 3 (Wave 2)

---

## TODOs

> Implementation + Test = ONE Task. Never separate.
> EVERY task MUST have: Recommended Agent Profile + Parallelization info + QA Scenarios.
> **A task WITHOUT QA Scenarios is INCOMPLETE. No exceptions.**
> **FORMAT**: Task labels MUST use bare numbers: `1.`, `2.`, `3.` — NOT `T1.`, `Task 1.`, `Phase 1:`.

- [ ] 1. **ModelConfig 新增 `loginUrl` 字段** — 类型扩展 + 默认配置

  **What to do**:
  - 在 `src/stores/app.ts` 的 `ModelConfig` 接口新增 `loginUrl?: string` 字段
  - 在 `electron/main.ts` 的 `ensureDataDir()` 中为默认 MiMo 配置添加 `loginUrl: 'https://platform.xiaomimimo.com/login'`
  - 确保 `config.json` 的存储/读取路径自动包含新字段，无需手动迁移

  **Must NOT do**:
  - 不修改 `ModelUsageStatus`、`UsageTier`、`UsageRecord` 等其他接口
  - 不添加新的 npm 依赖

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 两处简单修改，类型定义 + 默认值添加
  - **Skills**: 无

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（with Tasks 2, 3）
  - **Blocks**: Tasks 6, 7
  - **Blocked By**: None

  **References**:
  - `src/stores/app.ts:7-18` — ModelConfig 接口定义，需要在此新增 `loginUrl`
  - `electron/main.ts:36-52` — `ensureDataDir()` 默认配置，需要在此添加 `loginUrl` 默认值
  - **WHY**: ModelConfig 是所有模型配置的基础类型，loginUrl 作为模型属性跟随配置持久化；默认配置生成时自动带出，保证已有用户升级后字段存在

  **Acceptance Criteria**:
  - [ ] `ModelConfig` 包含 `loginUrl?: string` 字段（TypeScript 编译通过）
  - [ ] 默认 `config.json` 中 `mimo-default` 模型包含 `loginUrl` 字段

  **QA Scenarios**:

  ```
  Scenario: 新用户首次启动获得带 loginUrl 的默认配置
    Tool: Bash
    Preconditions: 删除 %USERPROFILE%\.token-usage\config.json
    Steps:
      1. 启动 Electron 应用: npm run electron:dev
      2. 等待应用启动完成（约5秒）
      3. 读取 config.json: Get-Content "$env:USERPROFILE\.token-usage\config.json" | ConvertFrom-Json
      4. 检查 mimo-default 模型: .models[0].loginUrl
    Expected Result: loginUrl 值为 "https://platform.xiaomimimo.com/login"
    Failure Indicators: loginUrl 为 null、undefined 或不存在
    Evidence: .omo/evidence/task-1-default-config.txt

  Scenario: TypeScript 编译验证新增字段
    Tool: Bash
    Preconditions: 已完成代码修改
    Steps:
      1. Run: npx tsc --noEmit
      2. 检查是否有 loginUrl 相关编译错误
    Expected Result: 编译通过，无错误
    Failure Indicators: 出现 any 类型警告或字段不存在错误
    Evidence: .omo/evidence/task-1-tsc-check.txt
  ```

  **Commit**: YES（groups with Task 3）
  - Message: `feat(types): add loginUrl to ModelConfig`
  - Files: `src/stores/app.ts`, `electron/main.ts`

- [ ] 2. **创建 LoginWindowManager 模块** — `electron/login.ts`

  **What to do**:
  - 新建 `electron/login.ts`，导出 `LoginWindowManager` 类
  - 类职责：
    - `openLoginWindow(url: string)`: 创建非模态 BrowserWindow，加载指定 URL
    - 监听 `closed` 事件 → 触发 cookie 提取
    - `extractCookies()`: 使用 `webContents.session.cookies.get({ domain: 'platform.xiaomimimo.com' })` 提取
    - 将 cookies 数组格式化为 HTTP Cookie header 字符串（`name=value; name2=value2`）
    - 暴露 `onLoginComplete(callback)` 注册回调，传入提取的 cookie 字符串
    - 5 分钟超时：超时则关闭窗口，回调传 null
  - BrowserWindow 配置：
    - `width: 800, height: 700`
    - `parent: mainWindow`（关联主窗口，但不模态）
    - `webPreferences: { nodeIntegration: false, contextIsolation: true }`
  - 单例模式：如果已有登录窗口打开则聚焦已有窗口，不重复创建

  **Must NOT do**:
  - 不加载 preload 脚本（登录页不需要 IPC）
  - 不阻塞主窗口（不设置 modal: true）
  - 不使用 `session.fromPartition()`（共享默认 session，Cookie 才能被 `net.request` 使用）

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 需要正确理解 Electron BrowserWindow 生命周期、session cookies API、单例模式
  - **Skills**: 无

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（with Tasks 1, 3）
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `electron/main.ts:22-23` — 现有的 BrowserWindow 变量声明方式（floatWindow/mainWindow），参考命名和组织
  - `electron/main.ts:54-68` — `createWindow()` 函数，参考 BrowserWindow 构造参数写法
  - Electron 官方 API: `webContents.session.cookies.get()` — 用于提取指定域名 cookies
  - Electron 官方 API: `BrowserWindow` — `parent`、`show`、`closed` 事件
  - **WHY**: 现有 `floatWindow` 已经展示了非模态窗口的模式；`net.request` 共享默认 session，所以 login window 不能使用独立 partition，否则 cookies 无法被主请求复用

  **Acceptance Criteria**:
  - [ ] `LoginWindowManager` 类导出
  - [ ] `openLoginWindow(url)` 创建 BrowserWindow 并加载 URL
  - [ ] 窗口关闭后自动调用 `extractCookies()` 并触发回调
  - [ ] Cookie 字符串格式正确（`name1=value1; name2=value2`）
  - [ ] 第二次调用 `openLoginWindow` 时聚焦已有窗口，不创建新窗口
  - [ ] 5 分钟超时自动关闭窗口并回调 null

  **QA Scenarios**:

  ```
  Scenario: 正常登录流程 — 打开窗口 → 关闭 → 提取 Cookie
    Tool: interactive_bash (tmux)
    Preconditions: 编写测试脚本调用 LoginWindowManager
    Steps:
      1. 启动 Electron 应用
      2. 调用 openLoginWindow("https://platform.xiaomimimo.com/login")
      3. 断言 BrowserWindow 已创建
      4. 手动关闭窗口（或等待超时）
      5. 检查 extractCookies 是否被调用
      6. 检查回调是否收到 cookie 字符串
    Expected Result: 回调收到非空 cookie 字符串（或 null 若超时）
    Failure Indicators: 窗口未创建、cookie 提取报错、回调未触发
    Evidence: .omo/evidence/task-2-login-flow.txt

  Scenario: 单例模式 — 重复打开登录窗口
    Tool: interactive_bash (tmux)
    Preconditions: 已有登录窗口打开
    Steps:
      1. 调用 openLoginWindow() 第一次
      2. 断言 BrowserWindow.getAllWindows() 包含登录窗口
      3. 调用 openLoginWindow() 第二次
      4. 断言 BrowserWindow 数量未增加（仍为1个登录窗口）
    Expected Result: 第二次调用不创建新窗口，聚焦已有窗口
    Failure Indicators: 创建了多个登录窗口
    Evidence: .omo/evidence/task-2-singleton.txt
  ```

  **Commit**: YES
  - Message: `feat(electron): add LoginWindowManager module`
  - Files: `electron/login.ts` (NEW)

- [ ] 3. **更新 ElectronAPI 类型定义** — `src/types/electron.d.ts` + 全局声明

  **What to do**:
  - 在 `ElectronAPI` 接口新增：
    - `openMimoLogin(): Promise<string | null>` — 打开登录窗口，返回 cookie 字符串或 null
    - `onLoginNeeded(callback: () => void): void` — 注册"需要登录"事件回调
  - 确保 `declare global` 中的 `Window.electronAPI` 包含新方法

  **Must NOT do**:
  - 不修改已有的 `fetchMimoUsage`、`loadConfig` 等方法签名
  - 不引入新类型依赖

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 仅类型声明扩展，无逻辑实现
  - **Skills**: 无

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1（with Tasks 1, 2）
  - **Blocks**: Tasks 4, 5, 6
  - **Blocked By**: None

  **References**:
  - `src/types/electron.d.ts:24-40` — 现有 `ElectronAPI` 接口，新增方法参考此风格
  - `electron/preload.ts:21-30` — 现有 API 实现，确认方法名一致
  - **WHY**: 类型定义是所有 IPC 调用的契约源头，必须先在类型层声明，后续 preload 和 main 进程才能正确实现

  **Acceptance Criteria**:
  - [ ] `ElectronAPI` 接口包含 `openMimoLogin()` 和 `onLoginNeeded()` 方法
  - [ ] TypeScript 编译通过
  - [ ] 渲染进程中 `window.electronAPI.openMimoLogin` 类型可推断

  **QA Scenarios**:

  ```
  Scenario: TypeScript 类型检查
    Tool: Bash
    Preconditions: 已完成代码修改
    Steps:
      1. Run: npx tsc --noEmit
      2. 检查 electron.d.ts 相关编译输出
    Expected Result: 无类型错误
    Failure Indicators: 类型声明不匹配、方法签名缺失
    Evidence: .omo/evidence/task-3-tsc-check.txt
  ```

  **Commit**: YES（groups with Task 1）
  - Message: `feat(types): add login APIs to ElectronAPI interface`
  - Files: `src/types/electron.d.ts`

- [ ] 4. **main.ts 新增 login IPC handler** — `open-mimo-login` + cookie 存储

  **What to do**:
  - 在 `electron/main.ts` 顶部导入 `LoginWindowManager`
  - 创建全局单例 `loginManager`
  - 新增 IPC handler `open-mimo-login`:
    - 从 config 读取 MiMo 模型的 `loginUrl`
    - 如果 cookie 已有值，先尝试用已有 cookie 做一次 API 请求验证是否仍然有效
    - 如果有效：直接返回已有 cookie 字符串（不需重新登录）
    - 如果无效/无 cookie：调用 `loginManager.openLoginWindow(loginUrl)`
    - 通过 `loginManager.onLoginComplete` 获取 cookie 字符串
    - 将提取的 cookie 保存到 config（更新 MiMo 模型的 `cookies` 字段）
    - 将 cookie 字符串返回给渲染进程
  - 超时处理：5 分钟无操作返回 null
  - 监听登录窗口关闭时也在主进程日志输出（方便调试）

  **Must NOT do**:
  - 不修改 `fetch-mimo-usage` 现有逻辑（错误检测在 Task 9 中集成）
  - 不影响 `load-config`、`save-config` 等其他 handler

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 涉及 IPC 通信、异步流程、文件读写、LoginWindowManager 集成
  - **Skills**: 无

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2（with Tasks 5, 6）
  - **Blocks**: Task 9
  - **Blocked By**: Tasks 2, 3

  **References**:
  - `electron/main.ts:225-294` — 现有 `fetch-mimo-usage` IPC handler，参考 `ipcMain.handle()` 注册方式
  - `electron/login.ts` (NEW) — LoginWindowManager API：`openLoginWindow()`、`onLoginComplete()`
  - `electron/main.ts:153-165` — 现有 `save-config` handler，参考 config 读写方式
  - `electron/main.ts:25-27` — config 文件路径常量
  - **WHY**: `open-mimo-login` 是中心调度者——从 LoginWindowManager 获取 cookie → 存入 config → 返回给渲染进程。需要正确串起登录窗口 → 存储 → 调用链。

  **Acceptance Criteria**:
  - [ ] `ipcMain.handle('open-mimo-login')` 已注册
  - [ ] 调用后打开 BrowserWindow 登录页
  - [ ] 登录完成后 cookie 自动存入 config.json
  - [ ] 返回 cookie 字符串给渲染进程
  - [ ] 已有有效 cookie 时跳过登录直接返回
  - [ ] 超时 5 分钟返回 null

  **QA Scenarios**:

  ```
  Scenario: 首次登录 — 无 cookie → 打开窗口 → 提取并存储
    Tool: interactive_bash (tmux)
    Preconditions: 清空 config.json 中 MiMo 的 cookies 字段
    Steps:
      1. 启动 Electron 应用
      2. 通过 IPC 调用 open-mimo-login
      3. 断言登录窗口已打开
      4. 模拟用户关闭窗口（手动或程序触发）
      5. 检查回调返回的 cookie 字符串
      6. 检查 config.json 中 MiMo 的 cookies 字段已更新
    Expected Result: cookie 字符串非空，config.json 已更新
    Failure Indicators: 窗口未打开、cookie 为空、config 未更新
    Evidence: .omo/evidence/task-4-first-login.txt

  Scenario: 已有有效 cookie — 跳过登录直接返回
    Tool: interactive_bash (tmux)
    Preconditions: config.json 中已有有效 cookie
    Steps:
      1. 通过 IPC 调用 open-mimo-login
      2. 观察是否跳过 BrowserWindow 打开
      3. 检查返回值是否为已有 cookie
    Expected Result: 直接返回 cookie 字符串，未打开新窗口
    Failure Indicators: 仍打开了登录窗口
    Evidence: .omo/evidence/task-4-cached-cookie.txt

  Scenario: 超时处理
    Tool: interactive_bash (tmux)
    Preconditions: 登录窗口打开但无人操作
    Steps:
      1. 打开登录窗口
      2. 等待 5 分钟
      3. 检查窗口是否自动关闭
      4. 检查回调是否返回 null
    Expected Result: 窗口自动关闭，回调返回 null
    Failure Indicators: 窗口未关闭、回调未触发、返回值非 null
    Evidence: .omo/evidence/task-4-timeout.txt
  ```

  **Commit**: YES（groups with Task 5）
  - Message: `feat(electron): add open-mimo-login IPC handler`
  - Files: `electron/main.ts`

- [ ] 5. **preload.ts 暴露 login API** — `openMimoLogin()` + `onLoginNeeded()`

  **What to do**:
  - 在 `electron/preload.ts` 的 `ElectronAPI` 接口中新增方法
  - 实现 `openMimoLogin()`: 调用 `ipcRenderer.invoke('open-mimo-login')`，返回 `Promise<string | null>`
  - 实现 `onLoginNeeded(callback)`: 调用 `ipcRenderer.on('login-needed', callback)`，注册事件监听
  - 更新 `contextBridge.exposeInMainWorld` 的对象，添加新方法

  **Must NOT do**:
  - 不暴露 `ipcRenderer` 直接给渲染进程（必须通过 contextBridge 封装）
  - 不修改已有方法实现

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: 简单的 IPC 桥接层，无业务逻辑
  - **Skills**: 无

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2（with Tasks 4, 6）
  - **Blocks**: Tasks 6, 7, 8
  - **Blocked By**: Task 3

  **References**:
  - `electron/preload.ts:21-30` — 现有 API 实现，参考 `ipcRenderer.invoke()` 和 `contextBridge.exposeInMainWorld()` 写法
  - `src/types/electron.d.ts:24-40` (修改后) — 类型声明，确保方法签名一致
  - **WHY**: preload 是主进程和渲染进程之间的安全桥梁，contextIsolation 开启时必须通过 contextBridge 暴露 API

  **Acceptance Criteria**:
  - [ ] `window.electronAPI.openMimoLogin()` 可用
  - [ ] `window.electronAPI.onLoginNeeded(callback)` 可用
  - [ ] TypeScript 编译通过

  **QA Scenarios**:

  ```
  Scenario: 渲染进程调用 openMimoLogin()
    Tool: Playwright
    Preconditions: Electron 应用已启动
    Steps:
      1. 打开 DevTools Console
      2. 执行: await window.electronAPI.openMimoLogin()
      3. 检查返回值类型
    Expected Result: 返回 string 或 null
    Failure Indicators: 方法不存在、抛出异常
    Evidence: .omo/evidence/task-5-preload-api.png (DevTools 截图)
  ```

  **Commit**: YES（groups with Task 4）
  - Message: `feat(electron): expose login API via preload`
  - Files: `electron/preload.ts`

- [ ] 6. **app store 集成 login 流程** — `src/stores/app.ts`

  **What to do**:
  - 新增状态：
    - `loginState: ref<'idle' | 'logging-in' | 'complete' | 'failed'>('idle')`
    - `loginError: ref<string | null>(null)`
    - `pendingRetry: ref<(() => void) | null>(null)` — 登录完成后需要重试的回调
  - 新增方法 `startMimoLogin()`:
    - 设置 `loginState = 'logging-in'`
    - 调用 `window.electronAPI.openMimoLogin()`
    - 成功：`loginState = 'complete'`，更新 model cookies → `saveConfig()` → 触发 `pendingRetry`
    - 失败/超时：`loginState = 'failed'`，设置 `loginError`
  - 新增方法 `retryAfterLogin(model: ModelConfig)`:
    - 将 `fetchModelUsage(model)` 包装为回调，存入 `pendingRetry`
    - 调用 `startMimoLogin()`
  - 在 `loadConfig()` 完成后注册 `onLoginNeeded` 回调:
    - 当主进程检测到需要登录时触发 → `loginState = 'idle'`（清除过期 cookie 标记）

  **Must NOT do**:
  - 不移除现有的手动 cookie 配置逻辑（保持兼容）
  - 不改变 `fetchModelUsage` 的公开接口

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 涉及状态机设计、异步流程编排、IPC 通信、与现有 store 逻辑集成
  - **Skills**: 无

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2（with Tasks 4, 5）
  - **Blocks**: Tasks 7, 8, 9
  - **Blocked By**: Tasks 1, 3, 5

  **References**:
  - `src/stores/app.ts:59-244` — 现有 store 结构和状态管理方式（ref、reactive、Pinia）
  - `src/stores/app.ts:159-200` — `fetchModelUsage()` 方法，需要在其错误处理中集成重试逻辑
  - `src/stores/app.ts:70-82` — `loadConfig()` 方法，login 初始化挂载点
  - `src/stores/app.ts:116-120` — `saveConfig()` 方法，login 成功后调用
  - **WHY**: Store 是 UI 层和主进程之间的中间层，需要管理 login 状态机（idle → logging-in → complete/failed），协调登录完成后自动刷新数据

  **Acceptance Criteria**:
  - [ ] `loginState` 正确反映当前状态
  - [ ] `startMimoLogin()` 可被组件调用
  - [ ] 登录成功后自动触发 pending 重试
  - [ ] `retryAfterLogin(model)` 串联登录→重试流程

  **QA Scenarios**:

  ```
  Scenario: 正常登录流程 → 状态变化
    Tool: Playwright
    Preconditions: Electron 应用已启动，无有效 cookie
    Steps:
      1. 在 Vue DevTools 中检查 loginState 初始值 = 'idle'
      2. 调用 store.startMimoLogin()
      3. 检查 loginState 变为 'logging-in'
      4. 等待登录窗口弹出并手动关闭
      5. 检查 loginState 变为 'complete'
    Expected Result: 状态流转 idle → logging-in → complete
    Failure Indicators: 状态卡在 logging-in、未触达 complete
    Evidence: .omo/evidence/task-6-state-machine.png (DevTools 截图)

  Scenario: 登录失败/超时 → 错误状态
    Tool: Playwright
    Preconditions: 启动应用，打开登录窗口但不操作
    Steps:
      1. 调用 store.startMimoLogin()
      2. 等待超时（5 分钟）
      3. 检查 loginState 变为 'failed'
      4. 检查 loginError 非空
    Expected Result: loginState = 'failed', loginError 有错误信息
    Failure Indicators: 状态未更新、无错误信息
    Evidence: .omo/evidence/task-6-login-fail.png
  ```

  **Commit**: YES
  - Message: `feat(store): integrate login flow in app store`
  - Files: `src/stores/app.ts`

- [ ] 7. **LoginButton 组件** — `src/components/LoginButton.vue`

  **What to do**:
  - 新建 Vue 3 SFC 组件
  - Props: `modelId: string` — 指定触发哪个模型的登录
  - 使用 Element Plus 的 `<el-button>`，显示"🔑 登录 MiMo" 文案
  - 绑定 store 的 `loginState`：
    - `idle` → 按钮可点击
    - `logging-in` → 按钮 loading 状态 + 文字变为"登录中..."
    - `complete` → 按钮短暂变绿 + 文字变为"✅ 已登录"，2 秒后恢复 idle
    - `failed` → 按钮变红 + 文字变为"❌ 登录失败，重试"，可点击重试
  - 点击事件：调用 `store.startMimoLogin()`
  - 放置在模型配置区域或仪表盘 MiMo 卡片上

  **Must NOT do**:
  - 不修改其他已有组件
  - 不引入新的 npm 依赖

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Vue 3 组件 + Element Plus 集成 + 状态驱动的 UI 变化
  - **Skills**: [`ui-ux-pro-max`]
    - `ui-ux-pro-max`: 确保按钮设计与现有 Element Plus 风格一致

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3（with Tasks 8, 9）
  - **Blocks**: None
  - **Blocked By**: Tasks 6, 5

  **References**:
  - `src/stores/app.ts` (修改后) — `loginState`、`startMimoLogin()` 方法
  - Element Plus 文档: `<el-button>` — loading、type、icon 等属性
  - 项目现有组件目录 `src/components/` — 参考现有组件的 Composition API + `<script setup>` 写法
  - **WHY**: 登录按钮是用户手动触发登录的唯一入口，需要清晰的状态反馈

  **Acceptance Criteria**:
  - [ ] 按钮在 `idle` 状态可点击
  - [ ] 按钮在 `logging-in` 状态显示 loading
  - [ ] 登录成功后短暂显示绿色确认
  - [ ] 登录失败后显示红色错误并提供重试
  - [ ] 组件通过 `modelId` prop 接收参数

  **QA Scenarios**:

  ```
  Scenario: 点击登录按钮 → 状态流转
    Tool: Playwright
    Preconditions: Electron 应用已启动，MiMo 模型已配置
    Steps:
      1. 定位 LoginButton: 查找文本 "登录 MiMo" 的 button
      2. 断言按钮状态为 enabled
      3. 点击按钮: playwright click(".login-button")
      4. 等待 1 秒: 断言按钮变为 loading 状态，文字变为"登录中..."
      5. 手动关闭登录窗口
      6. 断言按钮恢复为 idle 或短暂显示"✅ 已登录"
    Expected Result: 按钮状态按 idle → loading → complete/idle 流转
    Failure Indicators: 按钮无响应、loading 不消失、控制台报错
    Evidence: .omo/evidence/task-7-button-flow.png (Playwright 逐帧截图)

  Scenario: 登录失败状态
    Tool: Playwright
    Preconditions: 可模拟网络错误或超时
    Steps:
      1. 点击登录按钮
      2. 等待超时（5分钟）或关闭窗口但不登录
      3. 断言按钮变为红色，文字包含"失败"或"重试"
    Expected Result: 显示失败状态，可再次点击重试
    Failure Indicators: 按钮卡在 loading、无错误反馈
    Evidence: .omo/evidence/task-7-button-fail.png
  ```

  **Commit**: YES（groups with Task 8）
  - Message: `feat(ui): add login button component`
  - Files: `src/components/LoginButton.vue` (NEW)

- [ ] 8. **LoginNotification 组件** — `src/components/LoginNotification.vue`

  **What to do**:
  - 新建 Vue 3 SFC 组件
  - 使用 Element Plus 的 `<el-alert>` 或 `<el-notification>`
  - 监听 store 的 `loginState` 变化：
    - `idle → logging-in`: 不显示通知（登录按钮已有状态反馈）
    - `logging-in` 且再次触发登录时: 显示"登录窗口已打开，请完成登录"（多窗口防重提示）
    - `failed`: 显示"登录失败或已超时，请重试"（可关闭）
  - 通知类型：`warning`（进行中）/ `error`（失败）
  - 位置：页面顶部居中，`closable: true`
  - 应在页面根组件（`App.vue`）或仪表盘页面挂载

  **Must NOT do**:
  - 不在 `logging-in` 首次触发时弹通知（登录按钮本身已有反馈）
  - 不阻塞用户操作（非模态）

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: Vue 3 组件 + Element Plus 通知组件 + 响应式逻辑
  - **Skills**: [`ui-ux-pro-max`]
    - `ui-ux-pro-max`: 确保通知样式与整体 UI 协调

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3（with Tasks 7, 9）
  - **Blocks**: None
  - **Blocked By**: Tasks 6, 5

  **References**:
  - `src/stores/app.ts` (修改后) — `loginState` 字段
  - Element Plus 文档: `<el-alert>` 或 `ElNotification` — 通知组件 API
  - `src/App.vue` — 根组件，考虑挂载位置
  - **WHY**: 通知组件处理"登录已在进行中"、"登录过期提示"两个场景，是用户体验的关键补充

  **Acceptance Criteria**:
  - [ ] 登录窗口已打开时重复触发 → 显示"登录窗口已打开"通知
  - [ ] 登录失败时 → 显示错误通知
  - [ ] 通知可手动关闭
  - [ ] 首次触发登录不弹通知（按钮已有反馈）

  **QA Scenarios**:

  ```
  Scenario: 重复触发登录 → 显示防重通知
    Tool: Playwright
    Preconditions: 应用已启动，但未触发登录
    Steps:
      1. 点击 LoginButton 触发登录（登录窗口弹出）
      2. 再次点击 LoginButton
      3. 断言页面出现通知: text contains "登录窗口已打开" or "请完成登录"
    Expected Result: 出现一条 warning 类型通知
    Failure Indicators: 无通知、打开了第二个登录窗口
    Evidence: .omo/evidence/task-8-dup-notification.png

  Scenario: 登录失败 → 显示错误通知
    Tool: Playwright
    Preconditions: 模拟超时场景
    Steps:
      1. 触发登录但不操作登录窗口
      2. 等待超时
      3. 断言页面出现 error 类型通知
    Expected Result: 错误通知，可关闭
    Failure Indicators: 无通知、通知类型不正确
    Evidence: .omo/evidence/task-8-error-notification.png
  ```

  **Commit**: YES（groups with Task 7）
  - Message: `feat(ui): add login notification component`
  - Files: `src/components/LoginNotification.vue` (NEW)

- [ ] 9. **fetch-mimo-usage 集成 Cookie 过期检测** — `electron/main.ts` + `src/stores/app.ts`

  **What to do**:
  - 在 `electron/main.ts` 的 `fetch-mimo-usage` handler 中：
    - 请求失败时检查 `statusCode`（401、403）
    - 检查 response body 是否包含错误关键词（如 `"unauthorized"`、`"login"`、`"expired"`、`"invalid token"`）
    - 满足任一条件 → 在 reject error 中添加标记 `{ code: 'COOKIE_EXPIRED', ... }`
    - 同时通过 `mainWindow.webContents.send('login-needed')` 通知渲染进程
  - 在 `src/stores/app.ts` 的 `fetchModelUsage()` 中：
    - catch 错误时检查 `error.code === 'COOKIE_EXPIRED'`
    - 如果是 cookie 过期 → 调用 `retryAfterLogin(model)`
    - 其他错误 → 保持现有行为（只打日志）
  - 只对 MiMo provider 生效（`model.provider === 'mimo'`）

  **Must NOT do**:
  - 不影响 Kimi 和 DeepSeek 的错误处理
  - 不改变 `fetch-mimo-usage` 的成功返回格式

  **Recommended Agent Profile**:
  - **Category**: `deep`
    - Reason: 涉及错误分类、IPC 事件、主进程↔渲染进程通信，需要细心处理边界
  - **Skills**: 无

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3（with Tasks 7, 8）
  - **Blocks**: None
  - **Blocked By**: Tasks 4, 6

  **References**:
  - `electron/main.ts:225-294` — `fetch-mimo-usage` handler，在 `request.on('response')` 中检测 statusCode
  - `electron/main.ts:272-278` — JSON 解析失败错误处理，参考 reject 写法
  - `src/stores/app.ts:159-200` — `fetchModelUsage()` 方法的 catch 块
  - `src/stores/app.ts:96-113` — `startAutoRefresh()` 自动刷新逻辑，确保登录后自动刷新恢复
  - **WHY**: 这是整个功能的闭环——API 失败 → 检测 cookie 过期 → 自动弹出登录 → 登录完成 → 重试 API

  **Acceptance Criteria**:
  - [ ] 401/403 状态码 → 触发 login-needed 事件
  - [ ] response body 含 `"unauthorized"` 等关键词 → 触发 login-needed 事件
  - [ ] 渲染进程收到 login-needed 后自动调用 retryAfterLogin
  - [ ] 登录成功后自动重试失败 API
  - [ ] Kimi/DeepSeek 请求不受影响

  **QA Scenarios**:

  ```
  Scenario: API 返回 401 → 自动弹出登录窗口
    Tool: interactive_bash (tmux)
    Preconditions: 设置过期 cookie，使 API 返回 401
    Steps:
      1. 向 config.json 写入一个过期的 cookie
      2. 触发 MiMo API 调用（自动刷新或手动触发）
      3. 检查主进程日志: 包含 "COOKIE_EXPIRED" 或 "login-needed"
      4. 检查登录窗口是否自动弹出
    Expected Result: 检测到 401 → 自动弹出登录窗口
    Failure Indicators: 仅报错不弹窗、弹窗但无原因说明
    Evidence: .omo/evidence/task-9-auto-login.txt

  Scenario: 登录成功后自动重试 API
    Tool: interactive_bash (tmux)
    Preconditions: API 因 cookie 过期失败，登录窗口已弹出
    Steps:
      1. 在登录窗口完成登录
      2. 关闭窗口
      3. 检查 config.json 中 cookie 是否更新
      4. 检查是否自动触发 API 重试
      5. 检查 API 重试是否成功（modelUsageMap 有数据）
    Expected Result: cookie 更新 + API 重试成功
    Failure Indicators: cookie 未更新、API 未重试、重试仍失败
    Evidence: .omo/evidence/task-9-auto-retry.txt

  Scenario: Kimi/DeepSeek 请求不受影响
    Tool: interactive_bash (tmux)
    Preconditions: 分别配置 MiMo、Kimi、DeepSeek
    Steps:
      1. 让 MiMo 返回 401，Kimi 和 DeepSeek 正常返回
      2. 检查只有 MiMo 触发 login-needed
      3. 检查 Kimi 和 DeepSeek 的数据正常更新
    Expected Result: 仅 MiMo 触发登录流程，其他 provider 不受影响
    Failure Indicators: Kimi/DeepSeek 也触发了登录流程
    Evidence: .omo/evidence/task-9-provider-isolation.txt
  ```

  **Commit**: YES
  - Message: `feat(api): add cookie expiration detection to fetch-mimo-usage`
  - Files: `electron/main.ts`, `src/stores/app.ts`

---

## Final Verification Wave (MANDATORY — after ALL implementation tasks)

> 4 review agents run in PARALLEL. ALL must APPROVE. Present consolidated results to user and get explicit "okay" before completing.

- [ ] F1. **Plan Compliance Audit** — `oracle`
  Read the plan end-to-end. For each "Must Have": verify implementation exists (read file, curl endpoint, run command). For each "Must NOT Have": search codebase for forbidden patterns — reject with file:line if found. Check evidence files exist in .omo/evidence/. Compare deliverables against plan.
  Output: `Must Have [N/N] | Must NOT Have [N/N] | Tasks [N/N] | VERDICT: APPROVE/REJECT`

- [ ] F2. **Code Quality Review** — `unspecified-high`
  Run `tsc --noEmit` + linter + `bun test`. Review all changed files for: `as any`/`@ts-ignore`, empty catches, console.log in prod, commented-out code, unused imports. Check AI slop: excessive comments, over-abstraction, generic names (data/result/item/temp).
  Output: `Build [PASS/FAIL] | Lint [PASS/FAIL] | Tests [N pass/N fail] | Files [N clean/N issues] | VERDICT`

- [ ] F3. **Real Manual QA** — `unspecified-high` (+ `playwright` skill)
  Start from clean state. Execute EVERY QA scenario from EVERY task — follow exact steps, capture evidence. Test cross-task integration (features working together, not isolation). Test edge cases: empty state, invalid input, rapid actions. Save to `.omo/evidence/final-qa/`.
  Output: `Scenarios [N/N pass] | Integration [N/N] | Edge Cases [N tested] | VERDICT`

- [ ] F4. **Scope Fidelity Check** — `deep`
  For each task: read "What to do", read actual diff (git log/diff). Verify 1:1 — everything in spec was built (no missing), nothing beyond spec was built (no creep). Check "Must NOT do" compliance. Detect cross-task contamination: Task N touching Task M's files. Flag unaccounted changes.
  Output: `Tasks [N/N compliant] | Contamination [CLEAN/N issues] | Unaccounted [CLEAN/N files] | VERDICT`

---

## Commit Strategy

- **1-3**: `feat(types): add loginUrl to ModelConfig and ElectronAPI` — `src/stores/app.ts`, `src/types/electron.d.ts`
- **2**: `feat(electron): add LoginWindowManager module` — `electron/login.ts` (NEW)
- **4-5**: `feat(electron): add login IPC handlers and preload API` — `electron/main.ts`, `electron/preload.ts`
- **6**: `feat(store): integrate login flow in app store` — `src/stores/app.ts`
- **7-8**: `feat(ui): add login button and notification components` — `src/components/LoginButton.vue`, `src/components/LoginNotification.vue`
- **9**: `feat(api): add cookie expiration detection to fetch-mimo-usage` — `electron/main.ts`, `src/stores/app.ts`

---

## Success Criteria

### Verification Commands
```bash
# TypeScript 编译检查
npx tsc --noEmit

# Electron 应用启动（检查无崩溃）
npm run electron:dev

# 检查 config.json 中 cookie 字段是否已更新
Get-Content "$env:USERPROFILE\.token-usage\config.json" | ConvertFrom-Json | Select-Object -ExpandProperty models | Select-Object -First 1 | Select-Object cookies, loginUrl
```

### Final Checklist
- [ ] 所有 "Must Have" 已实现
- [ ] 所有 "Must NOT Have" 未被违反
- [ ] TypeScript 编译通过
- [ ] Electron 应用启动无崩溃
- [ ] QA 证据文件存在于 `.omo/evidence/`
