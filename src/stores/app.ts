import { defineStore } from 'pinia'
import { ref, reactive, toRaw } from 'vue'
import { extractUsage, MIMO_DEFAULT_BASE_URL, KIMI_DEFAULT_BASE_URL, DEEPSEEK_DEFAULT_BASE_URL } from '@/services/api'

export type UsageType = 'token' | 'balance' | 'percent'

export interface ModelConfig {
  id: string
  name: string
  provider: string
  apiKey: string
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
  let refreshAbortFlag = false
  const autoRefreshTimers = new Map<string, ReturnType<typeof setInterval>>()

  // Login state
  type LoginState = 'idle' | 'logging-in' | 'complete' | 'failed'
  const loginState = ref<LoginState>('idle')
  const loginError = ref<string | null>(null)
  let pendingRetry: (() => void) | null = null
  let loginRetryInProgress = false

  async function loadConfig() {
    try {
      const config = await window.electronAPI.loadConfig()
      if (config && Array.isArray(config.models)) {
        models.value = config.models
      }
      isConfigLoaded.value = true
      startAutoRefresh()

      // 注册 login-needed 事件监听
      window.electronAPI.onLoginNeeded(() => {
        loginState.value = 'idle'
        loginError.value = null
      })
    } catch (error) {
      console.error('加载配置失败:', error)
      isConfigLoaded.value = true // still mark as attempted
    }
  }

  function abortRefresh() {
    refreshAbortFlag = true
  }

  function stopAutoRefresh() {
    autoRefreshTimers.forEach((timerId) => clearInterval(timerId))
    autoRefreshTimers.clear()
  }

  function startAutoRefresh() {
    stopAutoRefresh()

    for (const model of models.value) {
      const interval = model.refreshInterval
      if (!interval || interval <= 0) continue
      if (!model.enabled || !model.apiKey) continue

      // 首次立即获取（如果还没有数据）- 使用 await 串行执行
      if (!modelUsageMap[model.id]) {
        // 不等待完成，但确保不会同时触发多个登录
        fetchModelUsage(model).catch(() => {})
      }

      const timerId = setInterval(() => {
        if (!fetching[model.id]) {
          fetchModelUsage(model).catch(() => {})
        }
      }, interval * 60 * 1000)

      autoRefreshTimers.set(model.id, timerId)
    }
  }

  async function startMimoLogin(): Promise<void> {
    if (loginState.value === 'logging-in') {
      console.log('[Login] 已经在登录中，跳过')
      return // 已经在登录中，不重复触发
    }

    console.log('[Login] 开始登录流程')
    loginState.value = 'logging-in'
    loginError.value = null

    try {
      console.log('[Login] 调用 openMimoLogin IPC')
      const cookies = await window.electronAPI.openMimoLogin()
      console.log('[Login] openMimoLogin 返回:', cookies ? '成功获取 cookie' : '返回 null')

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

        // 触发 pending 重试
        if (pendingRetry) {
          console.log('[Login] 触发 pending 重试')
          const retryFn = pendingRetry
          pendingRetry = null
          retryFn()
        }

        // 2 秒后恢复 idle
        setTimeout(() => {
          if (loginState.value === 'complete') {
            loginState.value = 'idle'
          }
        }, 2000)
      } else {
        // 超时或用户未登录
        loginState.value = 'failed'
        loginError.value = '登录超时或已取消'
        loginRetryInProgress = false
        console.warn('[Login] 登录超时或已取消')
      }
    } catch (error) {
      loginState.value = 'failed'
      loginError.value = error instanceof Error ? error.message : '登录失败'
      loginRetryInProgress = false
      console.error('[Login] 登录失败:', error)
    }
  }

  function retryAfterLogin(model: ModelConfig): void {
    // 防止多次同时触发
    if (loginRetryInProgress || loginState.value === 'logging-in') {
      console.log('[Login] 登录已在进行中，跳过重复触发')
      return
    }

    loginRetryInProgress = true
    console.log('[Login] 设置 pendingRetry 并启动登录')

    // 将 fetchModelUsage 包装为回调，存入 pendingRetry
    pendingRetry = () => {
      console.log('[Login] 执行 pendingRetry，重新获取数据')
      // 重新读取 config 获取最新的 cookies
      window.electronAPI.loadConfig().then(config => {
        const mimoModel = config.models?.find((m: any) => m.provider === 'mimo')
        if (mimoModel) {
          // 更新 store 中的 model cookies
          const storeModel = models.value.find(m => m.id === model.id)
          if (storeModel) {
            storeModel.cookies = mimoModel.cookies
          }
        }
        fetchModelUsage(model).catch(() => {})
      }).finally(() => {
        loginRetryInProgress = false
      })
    }
    startMimoLogin()
  }

  function resetLoginState(): void {
    loginState.value = 'idle'
    loginError.value = null
    pendingRetry = null
    loginRetryInProgress = false
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

  async function saveConfig() {
    const plainModels = JSON.parse(JSON.stringify(toRaw(models.value)))
    await window.electronAPI.saveConfig({ models: plainModels })
    startAutoRefresh()
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

  async function fetchModelUsage(model: ModelConfig): Promise<ModelUsageStatus | null> {
    // 使用 Object.assign 确保响应式更新
    Object.assign(fetching, { [model.id]: true })
    try {
      let fetchOptions: any

      if (model.provider === 'kimi') {
        fetchOptions = {
          url: model.baseUrl || KIMI_DEFAULT_BASE_URL,
          apiKey: model.apiKey,
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      } else if (model.provider === 'deepseek') {
        fetchOptions = {
          url: model.baseUrl || DEEPSEEK_DEFAULT_BASE_URL,
          apiKey: model.apiKey,
          method: 'GET',
          headers: { 'Accept': 'application/json' }
        }
      } else {
        fetchOptions = {
          url: model.baseUrl || MIMO_DEFAULT_BASE_URL,
          apiKey: model.apiKey,
          cookies: model.cookies || ''
        }
      }

      const responseData = await window.electronAPI.fetchMimoUsage(fetchOptions)
      const result = extractUsage(responseData, model.provider)
      if (result) {
        modelUsageMap[model.id] = result
        return result
      }
      return null
    } catch (error) {
      console.error('获取额度失败:', error)

      // 检测 Cookie 过期，自动触发重新登录（仅 MiMo provider）
      // 注意：跨 IPC 传递的错误会丢失自定义属性，所以检查错误消息
      const isCookieExpired = model.provider === 'mimo' &&
        ((error as any)?.code === 'COOKIE_EXPIRED' ||
         (error instanceof Error && error.message.includes('Cookie expired')))

      if (isCookieExpired) {
        console.log('[fetchModelUsage] 检测到 COOKIE_EXPIRED, loginRetryInProgress:', loginRetryInProgress)
        if (!loginRetryInProgress) {
          console.log('[fetchModelUsage] 触发 retryAfterLogin')
          retryAfterLogin(model)
        } else {
          console.log('[fetchModelUsage] 登录已在进行中，跳过')
        }
        return null
      }

      throw error
    } finally {
      Object.assign(fetching, { [model.id]: false })
    }
  }

  async function refreshAll() {
    if (refreshing.value) {
      console.log('[refreshAll] 已在刷新中，跳过')
      return
    }
    console.log('[refreshAll] 开始刷新所有模型')
    refreshAbortFlag = false
    refreshing.value = true
    try {
      for (const model of models.value) {
        if (refreshAbortFlag) break
        if (model.enabled && model.apiKey) {
          console.log('[refreshAll] 刷新模型:', model.name, model.provider)
          try {
            await fetchModelUsage(model)
          } catch {
            // continue to next model even if one fails
          }
        }
      }
    } finally {
      refreshing.value = false
      console.log('[refreshAll] 刷新完成')
    }
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
    fetchModelUsage,
    refreshAll,
    abortRefresh,
    startAutoRefresh,
    stopAutoRefresh,
    startMimoLogin,
    retryAfterLogin,
    resetLoginState,
    setMimoCookies
  }
})
