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

  async function loadConfig() {
    try {
      const config = await window.electronAPI.loadConfig()
      if (config && Array.isArray(config.models)) {
        models.value = config.models
      }
      isConfigLoaded.value = true
      startAutoRefresh()
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

      // 首次立即获取（如果还没有数据）
      if (!modelUsageMap[model.id]) {
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
      throw error
    } finally {
      Object.assign(fetching, { [model.id]: false })
    }
  }

  async function refreshAll() {
    refreshAbortFlag = false
    refreshing.value = true
    try {
      for (const model of models.value) {
        if (refreshAbortFlag) break
        if (model.enabled && model.apiKey) {
          try {
            await fetchModelUsage(model)
          } catch {
            // continue to next model even if one fails
          }
        }
      }
    } finally {
      refreshing.value = false
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
    stopAutoRefresh
  }
})
