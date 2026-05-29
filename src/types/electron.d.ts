import type { ModelConfig, UsageRecord, ModelUsageStatus } from '@/stores/app'

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
  setFloatAlwaysOnTop: (value: boolean) => Promise<boolean>
  resizeFloatWindow: (width: number, height: number) => Promise<boolean>
  resizeFloatWindowAnimated: (width: number, height: number, duration: number) => Promise<boolean>
  openMimoLogin: () => Promise<string | null>
  onLoginNeeded: (callback: () => void) => void
  onConfigUpdated: (callback: () => void) => () => void
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  // 统一刷新相关
  getCachedUsage: () => Promise<Record<string, ModelUsageStatus>>
  refreshAllModels: () => Promise<boolean>
  refreshModel: (modelId: string) => Promise<boolean>
  onUsageUpdated: (callback: (data: { modelId: string, data: ModelUsageStatus }) => void) => () => void
  onUsageFetching: (callback: (data: { modelId: string, fetching: boolean }) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
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
  setFloatAlwaysOnTop: (value: boolean) => Promise<boolean>
  resizeFloatWindow: (width: number, height: number) => Promise<boolean>
  resizeFloatWindowAnimated: (width: number, height: number, duration?: number) => Promise<boolean>
  openMimoLogin: () => Promise<string | null>
  onLoginNeeded: (callback: () => void) => void
  onConfigUpdated: (callback: () => void) => () => void
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
