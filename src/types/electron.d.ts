import type { ModelConfig, UsageRecord, ModelUsageStatus } from '@/stores/app'

export type CloseAction = 'minimize-to-tray' | 'quit'

export interface AppConfig {
  models: ModelConfig[]
  closeAction?: CloseAction | null  // null/undefined = 未设置，首次询问
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

export interface MimoTokenPlanItem {
  date: string
  model: string
  totalToken: number
  inputHitToken: number
  inputMissToken: number
  outputToken: number
  requestCount: number
  inputAudioDuration: number
}

export interface MimoTokenPlanResponse {
  code: number
  message?: string
  data?: MimoTokenPlanItem[]
}

export interface OpenCodeUsageItem {
  date: string
  model: string
  totalCost: number
  keyId: string
  plan: string
  inputTokens?: number
  outputTokens?: number
  reasoningTokens?: number
  cacheReadTokens?: number
}

export interface OpenCodeKey {
  id: string
  displayName: string
  deleted: boolean
}

export interface OpenCodeUsageDetailResponse {
  usage: OpenCodeUsageItem[]
  keys: OpenCodeKey[]
}

export interface OpenCodeUsageRecord {
  id: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cacheReadTokens: number
  cost: number
  keyID: string
  keyName?: string
  timeCreated: string
  plan: string
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
  fetchMimoTokenPlan: (options: { year: number; month: number; cookies: string }) => Promise<MimoTokenPlanResponse>
  fetchOpenCodeUsageDetail: (options: { cookies: string; serverId: string; serverInstance: string; body: string }) => Promise<OpenCodeUsageDetailResponse>
  fetchOpenCodeUsageRecords: (options: { cookies: string; serverId: string; serverInstance: string; body: string }) => Promise<{ records: OpenCodeUsageRecord[] }>
  openFloatWindow: () => Promise<boolean>
  closeFloatWindow: () => Promise<boolean>
  getFloatWindowState: () => Promise<{ active: boolean }>
  onFloatWindowClosed: (callback: () => void) => () => void
  onFloatWindowOpened: (callback: () => void) => () => void
  focusFloatWindow: () => Promise<boolean>
  setFloatAlwaysOnTop: (value: boolean) => Promise<boolean>
  resizeFloatWindow: (width: number, height: number) => Promise<boolean>
  resizeFloatWindowAnimated: (width: number, height: number, duration?: number) => Promise<boolean>
  debugLog: (msg: string) => Promise<boolean>
  // 窗口拖拽
  startWindowDrag: (options: { mouseX: number; mouseY: number }) => Promise<void>
  stopWindowDrag: () => Promise<void>
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
  openMimoLogin: (modelId?: string) => Promise<string | null>
  openOpencodeLogin: (modelId?: string) => Promise<{
    cookies: string | null
    baseUrl: string | null
    api1ServerId: string | null
    api1Instance: string | null
    api2ServerId: string | null
    api2Instance: string | null
    api3ServerId: string | null
    api3Instance: string | null
  }>
  onLoginNeeded: (callback: (data: { modelId: string }) => void) => () => void
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
  // 详情窗口就绪信号
  detailReady: () => void
  // 悬浮窗就绪信号
  floatReady: () => void
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
  stripMousedown: () => Promise<void>
  // 主题同步
  notifyThemeChanged: (theme: { mode: string; accent: string }) => Promise<boolean>
  onThemeChanged: (callback: (theme: { mode: string; accent: string }) => void) => () => void
  // 关闭行为
  getCloseAction: () => Promise<CloseAction | null>
  setCloseAction: (action: CloseAction | null) => Promise<boolean>
  closeActionChosen: (action: CloseAction, remember: boolean) => Promise<void>
  onShowCloseDialog: (callback: () => void) => () => void
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
