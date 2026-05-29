# 主线程统一刷新 + 广播架构重构

## TL;DR

> **目标**：将数据刷新逻辑从渲染进程迁移到主进程，实现单一数据源、多窗口同步
> 
> **收益**：
> - 消除重复 API 请求（两个窗口不再各自拉取）
> - 数据实时同步（主窗口刷新后悬浮窗立即更新）
> - 定时器生命周期与窗口解耦（关闭窗口不影响刷新）
> - 登录重试逻辑统一管理
> 
> **风险**：中（核心 store 重构）
> **预估**：~300 行改动，7 个文件

---

## 当前架构问题

```
Main Window (Renderer 1)          Float Window (Renderer 2)
┌─────────────────────┐           ┌─────────────────────┐
│ useAppStore()        │           │ useAppStore()        │
│ ├── models[]         │           │ ├── models[]         │
│ ├── modelUsageMap{}  │           │ ├── modelUsageMap{}  │
│ ├── autoRefreshTimers│           │ ├── (无定时器)        │
│ ├── fetchModelUsage()│           │ ├── fetchModelUsage()│
│ └── startMimoLogin() │           │ └── refreshAll()     │
└────────┬────────────┘           └────────┬────────────┘
         │ fetchMimoUsage (IPC)            │ fetchMimoUsage (IPC)
         ▼                                 ▼
┌──────────────────────────────────────────────────────┐
│ Main Process: net.request() — 纯转发，无状态          │
└──────────────────────────────────────────────────────┘
```

**问题**：
1. 两个窗口各自维护独立 store，重复请求同一 API
2. 主窗口刷新后悬浮窗不知道，数据不同步
3. 自动刷新定时器在渲染进程，窗口关闭就丢失
4. 登录重试逻辑在渲染进程，两个窗口可能同时触发登录

---

## 目标架构

```
┌──────────────────────────────────────────────────────────────┐
│ Main Process                                                  │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │ UsageRefresher                                          │  │
│ │ ├── models[] (从 config 读取)                            │  │
│ │ ├── modelUsageMap{} (缓存最新数据)                       │  │
│ │ ├── autoRefreshTimers (统一管理)                         │  │
│ │ ├── refreshAll() → 串行拉取所有模型                      │  │
│ │ ├── fetchModel(id) → 拉取单个模型                        │  │
│ │ └── broadcast() → 广播给所有窗口                         │  │
│ └─────────────────────────────────────────────────────────┘  │
│         │                                                     │
│         │ webContents.send('usage-updated', {id, data})       │
│         ▼                                                     │
│ ┌──────────────┐  ┌──────────────┐                           │
│ │ Main Window  │  │ Float Window │  (可以有 N 个窗口)         │
│ │ 收到广播 →   │  │ 收到广播 →   │                            │
│ │ 更新 store   │  │ 更新 store   │                            │
│ └──────────────┘  └──────────────┘                           │
└──────────────────────────────────────────────────────────────┘
```

---

## 涉及文件

| 文件 | 改动类型 | 说明 |
|------|---------|------|
| `electron/refresher.ts` | **新增** | 主进程数据刷新管理器 |
| `electron/main.ts` | 修改 | 集成 refresher，新增 IPC handlers |
| `electron/preload.ts` | 修改 | 新增 `onUsageUpdated` 事件监听 |
| `src/types/electron.d.ts` | 修改 | 类型声明同步 |
| `src/stores/app.ts` | **大幅重构** | 移除 fetch/startAutoRefresh，改为订阅广播 |
| `src/pages/Dashboard.vue` | 小改 | 移除 onMounted 的 refreshAll 调用 |
| `src/pages/FloatWindow.vue` | 小改 | 移除 onMounted 的 refreshAll 调用 |

---

## 详细设计

### 1. 新增 `electron/refresher.ts`

主进程数据刷新管理器，职责：
- 从 config 加载模型列表
- 管理所有模型的定时刷新
- 调用 API 获取数据（复用 `extractUsage` 解析逻辑）
- 缓存最新数据
- 广播更新给所有窗口

```typescript
import { BrowserWindow, net } from 'electron'
import { readFileSync, existsSync } from 'fs'

interface ModelConfig {
  id: string
  name: string
  provider: string
  apiKey: string
  baseUrl: string
  cookies: string
  refreshInterval?: number
  enabled: boolean
}

interface ModelUsageStatus {
  usageType: 'token' | 'balance' | 'percent'
  planName: string
  lastUpdated: number
  used?: number
  total?: number
  remaining?: number
  percent?: number
  balance?: number
  currency?: string
  tiers?: any[]
}

export class UsageRefresher {
  private modelUsageMap: Map<string, ModelUsageStatus> = new Map()
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map()
  private configPath: string
  private models: ModelConfig[] = []
  private fetchInProgress: Set<string> = new Set()

  constructor(configPath: string) {
    this.configPath = configPath
  }

  /**
   * 加载配置并启动定时刷新
   */
  start(): void {
    this.loadConfig()
    this.stopAll()

    for (const model of this.models) {
      if (!model.enabled || !model.apiKey) continue

      // 首次立即拉取
      this.fetchModel(model).catch(() => {})

      // 设置定时器
      if (model.refreshInterval && model.refreshInterval > 0) {
        const timer = setInterval(() => {
          if (!this.fetchInProgress.has(model.id)) {
            this.fetchModel(model).catch(() => {})
          }
        }, model.refreshInterval * 60 * 1000)
        this.timers.set(model.id, timer)
      }
    }
  }

  /**
   * 重新加载配置（config 变更时调用）
   */
  restart(): void {
    this.start()
  }

  /**
   * 拉取单个模型数据
   */
  async fetchModel(model: ModelConfig): Promise<ModelUsageStatus | null> {
    if (this.fetchInProgress.has(model.id)) return null
    
    this.fetchInProgress.add(model.id)
    this.broadcastFetching(model.id, true)

    try {
      const fetchOptions = this.buildFetchOptions(model)
      const responseData = await this.doRequest(fetchOptions)
      const result = this.extractUsage(responseData, model.provider)

      if (result) {
        this.modelUsageMap.set(model.id, result)
        this.broadcast(model.id, result)
        return result      }
      return null
    } catch (error) {
      // 检测 cookie 过期
      if (model.provider === 'mimo' && this.isCookieExpired(error)) {
        this.broadcastLoginNeeded()
      }
      throw error
    } finally {
      this.fetchInProgress.delete(model.id)
      this.broadcastFetching(model.id, false)
    }
  }

  /**
   * 按 ID 拉取模型
   */
  async fetchModelById(modelId: string): Promise<ModelUsageStatus | null> {
    const model = this.models.find(m => m.id === modelId)
    if (!model) return null
    return this.fetchModel(model)
  }

  /**
   * 刷新所有模型
   */
  async refreshAll(): Promise<void> {
    for (const model of this.models) {
      if (model.enabled && model.apiKey) {
        try {
          await this.fetchModel(model)
        } catch {
          // 继续刷新其他模型
        }
      }
    }
  }

  /**
   * 获取当前缓存（新窗口打开时用）
   */
  getCachedData(): Record<string, ModelUsageStatus> {
    return Object.fromEntries(this.modelUsageMap)
  }

  /**
   * 停止所有定时器
   */
  stopAll(): void {
    this.timers.forEach(t => clearInterval(t))
    this.timers.clear()
  }

  // ── 私有方法 ──

  private loadConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        const config = JSON.parse(readFileSync(this.configPath, 'utf-8'))
        this.models = config.models || []
      }
    } catch (error) {
      console.error('[Refresher] 加载配置失败:', error)
      this.models = []
    }
  }

  private buildFetchOptions(model: ModelConfig): any {
    // 复用现有逻辑
    if (model.provider === 'kimi') {
      return {
        url: model.baseUrl || 'https://api.kimi.com/coding/v1/usages',
        apiKey: model.apiKey,
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    } else if (model.provider === 'deepseek') {
      return {
        url: model.baseUrl || 'https://api.deepseek.com/user/balance',
        apiKey: model.apiKey,
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    } else {
      return {
        url: model.baseUrl || 'https://platform.xiaomimimo.com/api/v1/tokenPlan/usage',
        apiKey: model.apiKey,
        cookies: model.cookies || ''
      }
    }
  }

  private doRequest(options: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const { url, apiKey, cookies, method = 'GET', headers = {}, body } = options

      const requestHeaders: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }

      for (const [key, value] of Object.entries(headers)) {
        if (typeof value === 'string') requestHeaders[key] = value
      }

      if (method === 'POST' && !requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json'
      }

      if (cookies) requestHeaders['Cookie'] = cookies

      const request = net.request({ method, url, headers: requestHeaders })
      let responseData = ''

      request.on('response', (response) => {
        response.on('data', (chunk) => { responseData += chunk.toString() })
        response.on('end', () => {
          try {
            resolve(JSON.parse(responseData))
          } catch {
            reject(new Error('JSON解析失败'))
          }
        })
      })

      request.on('error', reject)

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        request.write(typeof body === 'string' ? body : JSON.stringify(body))
      }

      request.end()
    })
  }

  private extractUsage(response: any, provider: string): ModelUsageStatus | null {
    // 复用 src/services/api.ts 的解析逻辑
    // ... (解析逻辑移至此处或提取为共享模块)
    return null // TODO: 实现
  }

  private isCookieExpired(error: any): boolean {
    return error?.code === 'COOKIE_EXPIRED' ||
           (error instanceof Error && error.message.includes('Cookie expired'))
  }

  private broadcast(modelId: string, data: ModelUsageStatus): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('usage-updated', { modelId, data })
      }
    }
  }

  private broadcastFetching(modelId: string, fetching: boolean): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('usage-fetching', { modelId, fetching })
      }
    }
  }

  private broadcastLoginNeeded(): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('login-needed')
      }
    }
  }
}
```

### 2. 修改 `electron/main.ts`

**新增内容**：

```typescript
import { UsageRefresher } from './refresher'

const refresher = new UsageRefresher(configPath)

app.whenReady().then(() => {
  ensureDataDir()
  createWindow()
  refresher.start()  // 启动统一刷新
})

// 新增 IPC handlers
ipcMain.handle('get-cached-usage', () => {
  return refresher.getCachedData()
})

ipcMain.handle('refresh-all-models', async () => {
  await refresher.refreshAll()
  return true
})

ipcMain.handle('refresh-model', async (_, modelId: string) => {
  await refresher.fetchModelById(modelId)
  return true
})

// save-config handler 中增加：
ipcMain.handle('save-config', (_, config) => {
  // ... 现有逻辑 ...
  refresher.restart()  // 配置变更后重启刷新
  return true
})
```

**移除/调整**：
- `fetch-mimo-usage` handler 保留但仅供 refresher 内部使用
- 或者将请求逻辑完全移入 refresher

### 3. 修改 `electron/preload.ts`

**新增方法**：

```typescript
export interface ElectronAPI {
  // ... 现有 API
  
  // 新增
  getCachedUsage: () => Promise<Record<string, ModelUsageStatus>>
  refreshAllModels: () => Promise<boolean>
  refreshModel: (modelId: string) => Promise<boolean>
  onUsageUpdated: (callback: (data: { modelId: string, data: ModelUsageStatus }) => void) => () => void
  onUsageFetching: (callback: (data: { modelId: string, fetching: boolean }) => void) => () => void
}

// 实现
const electronAPI: ElectronAPI = {
  // ... 现有实现
  
  getCachedUsage: () => ipcRenderer.invoke('get-cached-usage'),
  refreshAllModels: () => ipcRenderer.invoke('refresh-all-models'),
  refreshModel: (modelId) => ipcRenderer.invoke('refresh-model', modelId),
  onUsageUpdated: (callback) => {
    const wrapper = (_: any, data: any) => callback(data)
    ipcRenderer.on('usage-updated', wrapper)
    return () => { ipcRenderer.removeListener('usage-updated', wrapper) }
  },
  onUsageFetching: (callback) => {
    const wrapper = (_: any, data: any) => callback(data)
    ipcRenderer.on('usage-fetching', wrapper)
    return () => { ipcRenderer.removeListener('usage-fetching', wrapper) }
  }
}
```

### 4. 修改 `src/types/electron.d.ts`

```typescript
export interface ElectronAPI {
  // ... 现有声明
  
  getCachedUsage: () => Promise<Record<string, ModelUsageStatus>>
  refreshAllModels: () => Promise<boolean>
  refreshModel: (modelId: string) => Promise<boolean>
  onUsageUpdated: (callback: (data: { modelId: string, data: ModelUsageStatus }) => void) => () => void
  onUsageFetching: (callback: (data: { modelId: string, fetching: boolean }) => void) => () => void
}
```

### 5. 重构 `src/stores/app.ts`

**移除**：
- `fetchModelUsage()` — 不再由渲染进程调用
- `startAutoRefresh()` / `stopAutoRefresh()` — 定时器移到主进程
- `autoRefreshTimers` — 移到主进程
- `retryAfterLogin()` — 登录重试移到主进程

**保留**：
- `models[]` — 配置数据
- `modelUsageMap{}` — 接收广播更新
- `loadConfig()` — 加载配置
- `saveConfig()` — 保存配置
- `loginState` / `loginError` — 登录状态
- `startMimoLogin()` — 手动触发登录

**新增**：
- `initSubscription()` — 订阅主进程广播
- `requestRefresh()` — 请求主进程刷新单个模型
- `requestRefreshAll()` — 请求主进程刷新全部

```typescript
import { defineStore } from 'pinia'
import { ref, reactive, toRaw } from 'vue'

export const useAppStore = defineStore('app', () => {
  const models = ref<ModelConfig[]>([])
  const modelUsageMap = reactive<Record<string, ModelUsageStatus>>({})
  const fetching = reactive<Record<string, boolean>>({})
  const refreshing = ref(false)
  const isConfigLoaded = ref(false)
  let unsubUsage: (() => void) | null = null
  let unsubFetching: (() => void) | null = null

  // Login state
  type LoginState = 'idle' | 'logging-in' | 'complete' | 'failed'
  const loginState = ref<LoginState>('idle')
  const loginError = ref<string | null>(null)

  async function loadConfig() {
    try {
      const config = await window.electronAPI.loadConfig()
      if (config && Array.isArray(config.models)) {
        models.value = config.models
      }
      isConfigLoaded.value = true

      // 获取主进程缓存的数据
      const cached = await window.electronAPI.getCachedUsage()
      Object.assign(modelUsageMap, cached)

      // 订阅后续更新
      initSubscription()

      // 注册 login-needed 事件监听
      window.electronAPI.onLoginNeeded(() => {
        loginState.value = 'idle'
        loginError.value = null
      })
    } catch (error) {
      console.error('加载配置失败:', error)
      isConfigLoaded.value = true
    }
  }

  function initSubscription() {
    // 避免重复订阅
    if (unsubUsage) unsubUsage()
    if (unsubFetching) unsubFetching()

    // 监听数据更新
    unsubUsage = window.electronAPI.onUsageUpdated(({ modelId, data }) => {
      modelUsageMap[modelId] = data
      fetching[modelId] = false
    })

    // 监听 fetching 状态
    unsubFetching = window.electronAPI.onUsageFetching(({ modelId, fetching: isFetching }) => {
      fetching[modelId] = isFetching
    })
  }

  async function saveConfig() {
    const plainModels = JSON.parse(JSON.stringify(toRaw(models.value)))
    await window.electronAPI.saveConfig({ models: plainModels })
    // 主进程收到后会自动 refresher.restart()
  }

  async function requestRefresh(modelId: string) {
    fetching[modelId] = true
    await window.electronAPI.refreshModel(modelId)
  }

  async function requestRefreshAll() {
    if (refreshing.value) return
    refreshing.value = true
    try {
      await window.electronAPI.refreshAllModels()
    } finally {
      refreshing.value = false
    }
  }

  async function startMimoLogin(): Promise<void> {
    // 保留现有登录逻辑
    // ...
  }

  return {
    models,
    modelUsageMap,
    fetching,
    refreshing,
    isConfigLoaded,
    loginState,
    loginError,
    loadConfig,
    saveConfig,
    requestRefresh,
    requestRefreshAll,
    startMimoLogin,
    // ... 其他保留的方法
  }
})
```

### 6. 修改 `src/pages/Dashboard.vue`

```typescript
// 移除 onMounted 的 refreshAll 调用
onMounted(async () => {
  // 数据已在 loadConfig 时从主进程缓存获取
  // 不需要再调用 refreshAll
})

// 修改 fetchUsage 函数
async function fetchUsage(model: ModelConfig) {
  await store.requestRefresh(model.id)
}

// 修改 refreshAll 函数
async function refreshAll() {
  await store.requestRefreshAll()
}
```

### 7. 修改 `src/pages/FloatWindow.vue`

```typescript
onMounted(async () => {
  const s = localStorage.getItem('theme')
  if (s) theme.value = s
  try {
    await store.loadConfig()
    resizeToFit()
    // 移除 await store.refreshAll()
  } catch {}
  // ...
})

// 修改 fetchModel 函数
async function fetchModel(m: ModelConfig) {
  await store.requestRefresh(m.id)
}

// 修改 doRefreshAll 函数
function doRefreshAll() {
  menuVisible.value = false
  store.requestRefreshAll()
}
```

---

## 数据流对比

### 改前

```
窗口打开 → loadConfig → startAutoRefresh → 每个窗口各自定时拉取
                                            ↓
                                     fetchMimoUsage (IPC)
                                            ↓
                                     main process net.request
```

### 改后

```
窗口打开 → loadConfig → getCachedUsage (IPC) → 立即显示缓存数据
                    ↓
              订阅 onUsageUpdated
                    ↑
主进程 refresher.start() → 定时拉取 → broadcast → 所有窗口同步更新
```

---

## 登录流程处理

**场景**：Cookie 过期时，主进程检测到需要登录

```
主进程 refresher 检测到 COOKIE_EXPIRED
  → broadcast('login-needed')
  → 主窗口收到后调用 startMimoLogin()
  → 用户完成登录，cookies 保存到 config
  → 主进程收到 config-updated，调用 refresher.restart()
  → 自动重试失败的请求
```

---

## 注意事项

1. **`extractUsage` 解析函数**：需要从 `src/services/api.ts` 移到 `electron/refresher.ts`，或提取为共享模块
2. **fetching 状态**：渲染进程的 `fetching[modelId]` 改为乐观更新（立即设 true，收到广播设 false）
3. **错误处理**：主进程拉取失败时，广播 `usage-error` 事件，渲染进程显示错误状态
4. **窗口首次打开**：通过 `getCachedUsage` IPC 获取主进程缓存，避免白屏等待
5. **类型共享**：`ModelConfig` 和 `ModelUsageStatus` 接口需要在主进程和渲染进程之间共享

---

## 改动量评估

| 文件 | 改动量 | 风险 |
|------|--------|------|
| `electron/refresher.ts` | 新增 ~200 行 | 低（新文件） |
| `electron/main.ts` | +30 行 | 低（新增 handler） |
| `electron/preload.ts` | +20 行 | 低（新增方法） |
| `src/types/electron.d.ts` | +10 行 | 低（类型声明） |
| `src/stores/app.ts` | 重构 ~80 行 | **中**（核心逻辑） |
| `src/pages/Dashboard.vue` | -5 行 | 低 |
| `src/pages/FloatWindow.vue` | -5 行 | 低 |

**总计**：~340 行改动

---

## 验证清单

- [ ] 主窗口打开后立即显示缓存数据
- [ ] 悬浮窗打开后立即显示缓存数据
- [ ] 主进程定时刷新正常工作
- [ ] 手动刷新单个模型正常工作
- [ ] 手动刷新全部模型正常工作
- [ ] 主窗口刷新后悬浮窗同步更新
- [ ] 悬浮窗刷新后主窗口同步更新
- [ ] Cookie 过期时触发登录流程
- [ ] 登录完成后自动重试
- [ ] 配置保存后刷新自动重启
- [ ] 关闭窗口不影响其他窗口的数据更新
