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

  async function loadConfig() {
    const config = await window.electronAPI.loadConfig()
    if (config.models) {
      models.value = config.models
    }
  }

  async function saveConfig() {
    const plainModels = JSON.parse(JSON.stringify(toRaw(models.value)))
    await window.electronAPI.saveConfig({ models: plainModels })
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
    fetching[model.id] = true
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
    } finally {
      fetching[model.id] = false
    }
  }

  async function refreshAll() {
    refreshing.value = true
    for (const model of models.value) {
      if (model.enabled && model.apiKey) {
        await fetchModelUsage(model)
      }
    }
    refreshing.value = false
  }

  return {
    models,
    usageRecords,
    modelUsageMap,
    currentMonth,
    fetching,
    refreshing,
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
    refreshAll
  }
})
