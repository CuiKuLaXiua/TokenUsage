import { defineStore } from 'pinia'
import { ref, reactive, toRaw } from 'vue'

export type UsageType = 'token' | 'balance' | 'percent' | 'error'

export interface ModelConfig {
  id: string
  name: string
  provider: string
  apiKey?: string
  baseUrl: string
  cookies: string
  loginUrl?: string
  inputPrice?: number
  outputPrice?: number
  refreshInterval?: number  // 自动刷新间隔数值，0 或 undefined 表示关闭
  refreshUnit?: 'second' | 'minute' | 'hour'  // 刷新间隔单位，默认 minute
  enabled: boolean
  // Kimi 专用：认证方式
  authMode?: 'apikey' | 'cookie'  // 默认 apikey，保留旧配置兼容
  // OpenCode 专用
  serverId?: string              // API1 GET x-server-id（基础数据 + 刷新器）
  serverInstance?: string        // API1 GET x-server-instance
  dailyServerId?: string         // API2 POST x-server-id（日用量详情）
  dailyServerInstance?: string   // API2 POST x-server-instance
  recordsServerId?: string       // API3 POST x-server-id（调用记录）
  recordsServerInstance?: string // API3 POST x-server-instance
  postServerInstance?: string    // POST 请求的备用 server-instance
}

export interface UsageTier {
  name: string
  label: string
  used?: number
  total?: number
  remaining?: number
  percent: number
  resetAt?: string
}

export interface ModelUsageStatus {
  usageType: UsageType
  planName: string
  lastUpdated: number

  // token 型（MIMO、OpenAI、Claude）
  used?: number
  total?: number
  remaining?: number
  percent?: number

  // balance 型（DeepSeek）
  balance?: number
  currency?: string

  // percent 型（Kimi）— 通过 tiers 表达
  tiers?: UsageTier[]

  // error 型 — 当 cookie 过期或 API key 失效时
  error?: string

  // MIMO 套餐详情（tokenPlan/detail）
  planCode?: string
  currentPeriodEnd?: string
  expired?: boolean
  enableAutoRenew?: boolean
  hasAutoRenewSubscribed?: boolean
}

export interface UsageRecord {
  id: string
  timestamp: number
  modelId: string
  inputTokens: number
  outputTokens: number
  totalTokens: number
  cost: number
}

export const useAppStore = defineStore('app', () => {
  const models = ref<ModelConfig[]>([])
  const usageRecords = ref<UsageRecord[]>([])
  const modelUsageMap = reactive<Record<string, ModelUsageStatus>>({})
  const currentMonth = ref(new Date().toISOString().slice(0, 7))
  const fetching = reactive<Record<string, boolean>>({})
  const refreshing = ref(false)
  const isConfigLoaded = ref(false)

  // Login state
  type LoginState = 'idle' | 'logging-in' | 'complete' | 'failed'
  const loginState = ref<LoginState>('idle')
  const loginError = ref<string | null>(null)

  // 订阅清理函数
  let unsubUsage: (() => void) | null = null
  let unsubFetching: (() => void) | null = null
  let unsubLogin: (() => void) | null = null
  let unsubApiKeyInvalid: (() => void) | null = null

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

      // 查询主进程中哪些模型仍在加载
      const fetchingState = await window.electronAPI.getFetchingState()
      for (const [modelId, isFetching] of Object.entries(fetchingState)) {
        fetching[modelId] = isFetching
      }
    } catch (error) {
      console.error('加载配置失败:', error)
      isConfigLoaded.value = true
    }
  }

  function initSubscription() {
    // 避免重复订阅
    if (unsubUsage) unsubUsage()
    if (unsubFetching) unsubFetching()
    if (unsubLogin) unsubLogin()

    // 监听数据更新
    unsubUsage = window.electronAPI.onUsageUpdated(({ modelId, data }) => {
      modelUsageMap[modelId] = data
      fetching[modelId] = false
    })

    // 监听 fetching 状态
    unsubFetching = window.electronAPI.onUsageFetching(({ modelId, fetching: isFetching }) => {
      fetching[modelId] = isFetching
    })

    // 监听 login-needed
    unsubLogin = window.electronAPI.onLoginNeeded(({ modelId }) => {
      // 写入错误状态到 modelUsageMap，让 UI 可以显示 Cookie 过期提示
      const model = models.value.find(m => m.id === modelId)
      const modelName = model?.name || modelId
      if (modelUsageMap[modelId]) {
        modelUsageMap[modelId].usageType = 'error'
        modelUsageMap[modelId].error = 'Cookie 已过期，请重新登录'
        modelUsageMap[modelId].planName = modelName
        modelUsageMap[modelId].lastUpdated = Date.now()
      } else {
        modelUsageMap[modelId] = {
          usageType: 'error',
          planName: modelName,
          lastUpdated: Date.now(),
          error: 'Cookie 已过期，请重新登录'
        }
      }

      // 如果已经在登录中，跳过
      if (loginState.value === 'logging-in') {
        return
      }

      // 根据 provider 分派到正确的登录流程
      if (!model) {
        return
      }
      if (model.provider === 'opencode') {
        startOpenCodeLogin(modelId)
      } else if (model.provider === 'kimi') {
        startKimiLogin(modelId)
      } else {
        startMimoLogin(modelId)
      }
    })

    // 监听 API key 失效
    unsubApiKeyInvalid = window.electronAPI.onApiKeyInvalid(({ modelId, modelName }) => {
      // 设置错误状态，让 UI 可以显示提示
      if (modelUsageMap[modelId]) {
        modelUsageMap[modelId].usageType = 'error'
        modelUsageMap[modelId].error = `API key 已失效，请重新配置`
      } else {
        modelUsageMap[modelId] = {
          usageType: 'error',
          planName: modelName,
          lastUpdated: Date.now(),
          error: `API key 已失效，请重新配置`
        }
      }
    })
  }

  function stopSubscription() {
    if (unsubUsage) { unsubUsage(); unsubUsage = null }
    if (unsubFetching) { unsubFetching(); unsubFetching = null }
    if (unsubLogin) { unsubLogin(); unsubLogin = null }
    if (unsubApiKeyInvalid) { unsubApiKeyInvalid(); unsubApiKeyInvalid = null }
  }

  async function saveConfig() {
    const plainModels = JSON.parse(JSON.stringify(toRaw(models.value)))
    await window.electronAPI.saveConfig({ models: plainModels })
    // 主进程收到后会自动 refresher.restart()
  }

  async function loadUsage(month?: string) {
    const targetMonth = month || currentMonth.value
    usageRecords.value = await window.electronAPI.loadUsage(targetMonth)
  }

  async function saveUsage() {
    await window.electronAPI.saveUsage(currentMonth.value, usageRecords.value)
  }

  async function addModel(model: ModelConfig) {
    models.value.push(model)
    await saveConfig()
  }

  async function updateModel(id: string, updates: Partial<ModelConfig>) {
    const index = models.value.findIndex(m => m.id === id)
    if (index !== -1) {
      models.value[index] = { ...models.value[index], ...updates }
      await saveConfig()
    }
  }

  async function removeModel(id: string) {
    models.value = models.value.filter(m => m.id !== id)
    delete modelUsageMap[id]
    await saveConfig()
  }

  async function reorderModels(fromIndex: number, toIndex: number, persist = true) {
    const arr = [...models.value]
    const [moved] = arr.splice(fromIndex, 1)
    arr.splice(toIndex, 0, moved)
    models.value = arr
    if (persist) {
      await saveConfig()
    }
  }

  function addUsageRecord(record: UsageRecord) {
    usageRecords.value.push(record)
    saveUsage()
  }

  function updateModelUsage(modelId: string, usage: ModelUsageStatus) {
    modelUsageMap[modelId] = usage
  }

  /**
   * 请求主进程刷新单个模型
   */
  async function requestRefresh(modelId: string) {
    fetching[modelId] = true
    try {
      await window.electronAPI.refreshModel(modelId)
    } catch (error) {
      throw error
    } finally {
      fetching[modelId] = false
    }
  }

  /**
   * 请求主进程刷新所有模型
   */
  async function requestRefreshAll() {
    if (refreshing.value) {
      return
    }
    refreshing.value = true
    try {
      await window.electronAPI.refreshAllModels()
    } finally {
      refreshing.value = false
    }
  }

  /**
   * 手动设置指定 MiMo 模型的 cookies
   */
  async function setMimoCookies(modelId: string, cookies: string): Promise<void> {
    const model = models.value.find(m => m.id === modelId)
    if (model && model.provider === 'mimo') {
      model.cookies = cookies
    }
    await saveConfig()
    loginState.value = 'complete'

    // 2 秒后恢复 idle
    setTimeout(() => {
      if (loginState.value === 'complete') {
        loginState.value = 'idle'
      }
    }, 2000)
  }

  /**
   * 开始 MiMo 登录流程
   */
  async function startMimoLogin(modelId?: string): Promise<void> {
    if (loginState.value === 'logging-in') {
      return
    }

    loginState.value = 'logging-in'
    loginError.value = null

    try {
      const cookies = await window.electronAPI.openMimoLogin(modelId)

      if (cookies) {
        // 只更新指定模型的 cookies
        if (modelId) {
          const model = models.value.find(m => m.id === modelId)
          if (model) {
            model.cookies = cookies
          }
        } else {
          // 兼容：无 modelId 时更新所有 MIMO 模型
          for (const model of models.value) {
            if (model.provider === 'mimo') {
              model.cookies = cookies
            }
          }
        }
        await saveConfig()
        loginState.value = 'complete'

        // 2 秒后恢复 idle
        setTimeout(() => {
          if (loginState.value === 'complete') {
            loginState.value = 'idle'
          }
        }, 2000)
      } else {
        loginState.value = 'failed'
        loginError.value = '登录超时或已取消'
      }
    } catch (error) {
      loginState.value = 'failed'
      loginError.value = error instanceof Error ? error.message : '登录失败'
    }
  }

  /**
   * 开始 Kimi 登录流程
   */
  async function startKimiLogin(modelId?: string): Promise<void> {
    if (loginState.value === 'logging-in') {
      return
    }

    loginState.value = 'logging-in'
    loginError.value = null

    try {
      const result = await window.electronAPI.openKimiLogin(modelId)

      if (result?.cookies) {
        if (modelId) {
          const model = models.value.find(m => m.id === modelId)
          if (model) {
            model.cookies = result.cookies
            model.authMode = 'cookie'
            if (result.token) {
              model.apiKey = result.token
            }
          }
        } else {
          for (const model of models.value) {
            if (model.provider === 'kimi') {
              model.cookies = result.cookies
              model.authMode = 'cookie'
              if (result.token) {
                model.apiKey = result.token
              }
            }
          }
        }
        await saveConfig()
        loginState.value = 'complete'

        setTimeout(() => {
          if (loginState.value === 'complete') {
            loginState.value = 'idle'
          }
        }, 2000)
      } else {
        loginState.value = 'failed'
        loginError.value = '登录超时或已取消'
      }
    } catch (error) {
      loginState.value = 'failed'
      loginError.value = error instanceof Error ? error.message : '登录失败'
    }
  }

  /**
   * 开始 Open Code 登录流程
   */
  async function startOpenCodeLogin(modelId?: string): Promise<void> {
    if (loginState.value === 'logging-in') {
      return
    }

    loginState.value = 'logging-in'
    loginError.value = null

    try {
      const result = await window.electronAPI.openOpencodeLogin(modelId)

      if (result.cookies) {
        // 只更新指定模型的 cookies 和 baseUrl
        if (modelId) {
          const model = models.value.find(m => m.id === modelId)
          if (model) {
            model.cookies = result.cookies
            if (result.baseUrl) model.baseUrl = result.baseUrl
            if (result.api1ServerId) model.serverId = result.api1ServerId
            if (result.api1Instance) model.serverInstance = result.api1Instance
            if (result.api2ServerId) model.dailyServerId = result.api2ServerId
            if (result.api2Instance) model.dailyServerInstance = result.api2Instance
            if (result.api3ServerId) model.recordsServerId = result.api3ServerId
            if (result.api3Instance) model.recordsServerInstance = result.api3Instance
          }
        } else {
          // 兼容：无 modelId 时更新所有 OpenCode 模型
          for (const model of models.value) {
            if (model.provider === 'opencode') {
              model.cookies = result.cookies
              if (result.baseUrl) model.baseUrl = result.baseUrl
              if (result.api1ServerId) model.serverId = result.api1ServerId
              if (result.api1Instance) model.serverInstance = result.api1Instance
              if (result.api2ServerId) model.dailyServerId = result.api2ServerId
              if (result.api2Instance) model.dailyServerInstance = result.api2Instance
              if (result.api3ServerId) model.recordsServerId = result.api3ServerId
              if (result.api3Instance) model.recordsServerInstance = result.api3Instance
            }
          }
        }
        await saveConfig()
        loginState.value = 'complete'

        // 2 秒后恢复 idle
        setTimeout(() => {
          if (loginState.value === 'complete') {
            loginState.value = 'idle'
          }
        }, 2000)
      } else {
        loginState.value = 'failed'
        loginError.value = '登录超时或已取消'
      }
    } catch (error) {
      loginState.value = 'failed'
      loginError.value = error instanceof Error ? error.message : '登录失败'
    }
  }

  function resetLoginState(): void {
    loginState.value = 'idle'
    loginError.value = null
  }

  return {
    models,
    usageRecords,
    modelUsageMap,
    currentMonth,
    fetching,
    refreshing,
    isConfigLoaded,
    loginState,
    loginError,
    loadConfig,
    saveConfig,
    loadUsage,
    saveUsage,
    addModel,
    updateModel,
    removeModel,
    reorderModels,
    addUsageRecord,
    updateModelUsage,
    requestRefresh,
    requestRefreshAll,
    startMimoLogin,
    startOpenCodeLogin,
    startKimiLogin,
    resetLoginState,
    setMimoCookies,
    stopSubscription
  }
})
