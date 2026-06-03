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
  focusFloatWindow: () => Promise<boolean>
  setFloatAlwaysOnTop: (value: boolean) => Promise<boolean>
  resizeFloatWindow: (width: number, height: number) => Promise<boolean>
  resizeFloatWindowAnimated: (width: number, height: number, duration?: number) => Promise<boolean>
  debugLog: (msg: string) => Promise<boolean>
  // 窗口拖拽
  startWindowDrag: (options: { mouseX: number; mouseY: number }) => Promise<void>
  stopWindowDrag: () => Promise<void>
  dragHeartbeat: (options: { mouseX: number; mouseY: number }) => Promise<void>
  setFloatWindowPosition: (x: number, y: number) => Promise<boolean>
  // 详情悬浮窗
  showFloatDetail: (options: {
    anchorX: number
    anchorY: number
    anchorW: number
    anchorH: number
  }) => Promise<boolean>
  hideFloatDetail: () => Promise<boolean>
  resizeDetailWindow: (width: number, height: number) => Promise<boolean>
  getFloatWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>
  openMimoLogin: () => Promise<string | null>
  openOpencodeLogin: () => Promise<{ cookies: string | null, baseUrl: string | null }>
  onLoginNeeded: (callback: () => void) => () => void
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
  // 详情悬浮窗 hover 状态同步
  notifyDetailHover: (state: 'enter' | 'leave') => Promise<void>
  onDetailHoverChanged: (callback: (state: 'enter' | 'leave') => void) => () => void
  // 右键菜单弹出窗
  showCtxMenu: (options: {
    screenX: number
    screenY: number
    modelId: string | null
    modelName: string | null
    theme: string
    layoutMode: string
    alwaysOnTop: boolean
  }) => Promise<boolean>
  hideCtxMenu: () => Promise<boolean>
  sendCtxMenuAction: (action: string) => Promise<boolean>
  getCtxMenuConfig: () => Promise<{
    modelId: string | null
    modelName: string | null
    theme: string
    layoutMode: string
    alwaysOnTop: boolean
  } | null>
  onCtxMenuConfig: (callback: (config: {
    modelId: string | null
    modelName: string | null
    theme: string
    layoutMode: string
    alwaysOnTop: boolean
  }) => void) => () => void
  onNativeContextMenu: (callback: (pos: { x: number; y: number }) => void) => () => void
  onExecuteCtxMenuAction: (callback: (action: string) => void) => () => void
  onCtxMenuClosed: (callback: () => void) => () => void
  // 靠边隐藏相关
  dockFloatWindow: (edge: 'left' | 'right' | 'top') => Promise<boolean>
  undockFloatWindow: () => Promise<boolean>
  getEdgeDockState: () => Promise<{ isDocked: boolean; edge: 'left' | 'right' | 'top' | null; originalX: number; originalY: number } | null>
  onEdgeDockChanged: (callback: (state: { isDocked: boolean; edge: 'left' | 'right' | 'top' | null }) => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
