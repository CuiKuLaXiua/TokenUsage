import type { ModelConfig, UsageRecord } from '@/stores/app'

export interface AppConfig {
  models: ModelConfig[]
}

interface MimoResponseItem {
  name: string
  used: number
  limit: number
}

interface MimoResponseData {
  usage?: { items?: MimoResponseItem[] }
  monthUsage?: { items?: MimoResponseItem[] }
}

export interface MimoApiResponse {
  code: number
  message?: string
  data?: MimoResponseData
}

export interface ElectronAPI {
  loadConfig: () => Promise<AppConfig>
  saveConfig: (config: AppConfig) => Promise<boolean>
  loadUsage: (month: string) => Promise<UsageRecord[]>
  saveUsage: (month: string, data: UsageRecord[]) => Promise<boolean>
  getDataPath: () => Promise<string>
  fetchMimoUsage: (options: {
    url: string
    apiKey: string
    cookies?: string
    method?: string
    headers?: Record<string, string>
    body?: Record<string, unknown>
  }) => Promise<MimoApiResponse>
  openFloatWindow: () => Promise<boolean>
  closeFloatWindow: () => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
