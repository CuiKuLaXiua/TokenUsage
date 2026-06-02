import { defineStore } from 'pinia'
import { ref, reactive, toRaw } from 'vue'

export type UsageType = 'token' | 'balance' | 'percent'

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
  refreshInterval?: number  // 自动刷新间隔（分钟），0 或 undefined 表示关闭
  enabled: boolean
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
    unsubLogin = window.electronAPI.onLoginNeeded(() => {
      console.log('[Store] 收到 login-needed 事件，当前 loginState:', loginState.value)
      loginError.value = null

      // 如果已经在登录中，跳过
      if (loginState.value === 'logging-in') {
        console.log('[Store] 已经在登录中，跳过重复调用')
        return
      }

      console.log('[Store] 准备调用 startMimoLogin()')
      // 自动触发登录流程
      startMimoLogin()
    })

    // 监听 API key 失效
    unsubApiKeyInvalid = window.electronAPI.onApiKeyInvalid(({ modelId, modelName, provider }) => {
      console.log(`[Store] 收到 api-key-invalid 事件: ${modelName} (${provider})`)
      // 设置错误状态，让 UI 可以显示提示
      if (modelUsageMap[modelId]) {
        modelUsageMap[modelId].error = `API key 已失效，请重新配置`
      } else {
        modelUsageMap[modelId] = {
          usageType: 'error',
          planName: modelName,
          lastUpdated: Date.now(),
          error: `API key 已失效，请重新配置`
        } as any
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
      fetching[modelId] = false
      throw error
    }
  }

  /**
   * 请求主进程刷新所有模型
   */
  async function requestRefreshAll() {
    if (refreshing.value) {
      console.log('[Store] 已在刷新中，跳过')
      return
    }
    console.log('[Store] 请求刷新所有模型')
    refreshing.value = true
    try {
      await window.electronAPI.refreshAllModels()
    } finally {
      refreshing.value = false
    }
  }

  /**
   * 手动设置 MiMo cookies
   */
  async function setMimoCookies(cookies: string): Promise<void> {
    for (const model of models.value) {
      if (model.provider === 'mimo') {
        model.cookies = cookies
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
  }

  /**
   * 开始 MiMo 登录流程
   */
  async function startMimoLogin(): Promise<void> {
    if (loginState.value === 'logging-in') {
      console.log('[Login] 已经在登录中，跳过')
      return
    }

    console.log('[Login] 开始登录流程，准备调用 openMimoLogin()')
    loginState.value = 'logging-in'
    loginError.value = null

    try {
      console.log('[Login] 调用 window.electronAPI.openMimoLogin()')
      const cookies = await window.electronAPI.openMimoLogin()
      console.log('[Login] openMimoLogin 返回:', cookies ? 'cookies 已获取' : 'cookies 为空')

      if (cookies) {
        // 更新所有 MiMo 模型的 cookies
        for (const model of models.value) {
          if (model.provider === 'mimo') {
            model.cookies = cookies
          }
        }
        await saveConfig()
        loginState.value = 'complete'
        console.log('[Login] 登录完成，cookies 已保存')

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
    addUsageRecord,
    updateModelUsage,
    requestRefresh,
    requestRefreshAll,
    startMimoLogin,
    resetLoginState,
    setMimoCookies,
    stopSubscription
  }
})
