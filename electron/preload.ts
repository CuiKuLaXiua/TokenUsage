import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from './core/ipc-channels'

export interface ElectronAPI {
  // ── Config / data ──
  loadConfig: () => Promise<any>
  saveConfig: (config: any) => Promise<boolean>
  loadUsage: (month: string) => Promise<any[]>
  saveUsage: (month: string, data: any[]) => Promise<boolean>
  getDataPath: () => Promise<string>

  // ── MiMo / OpenCode / Kimi API proxies ──
  fetchMimoUsage: (options: {
    url: string
    apiKey: string
    cookies?: string
    method?: string
    headers?: Record<string, string>
    body?: Record<string, unknown>
  }) => Promise<any>
  fetchMimoTokenPlan: (options: { year: number; month: number; cookies: string }) => Promise<any>
  fetchMimoTokenPlanDetail: (options: { cookies: string }) => Promise<any>
  fetchKimiSubscription: (options: { cookies: string; token?: string; baseUrl?: string }) => Promise<any>
  fetchOpenCodeUsageDetail: (options: { cookies: string; serverId: string; serverInstance: string; body: string }) => Promise<any>
  fetchOpenCodeUsageRecords: (options: { cookies: string; serverId: string; serverInstance: string; body: string }) => Promise<any>

  // ── Main window control ──
  showMainWindow: () => Promise<boolean>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>

  // ── Float window ──
  openFloatWindow: () => Promise<boolean>
  closeFloatWindow: () => Promise<boolean>
  getFloatWindowState: () => Promise<{ active: boolean }>
  focusFloatWindow: () => Promise<boolean>
  setFloatAlwaysOnTop: (value: boolean) => Promise<boolean>
  setFloatWindowPosition: (x: number, y: number) => Promise<boolean>
  getFloatWindowBounds: () => Promise<{ x: number; y: number; width: number; height: number } | null>
  resizeFloatWindow: (width: number, height: number) => Promise<boolean>
  resizeFloatWindowAnimated: (width: number, height: number, duration: number) => Promise<boolean>
  startWindowDrag: (options: { mouseX: number; mouseY: number }) => Promise<void>
  stopWindowDrag: () => Promise<void>
  onFloatWindowClosed: (callback: () => void) => () => void
  onFloatWindowOpened: (callback: () => void) => () => void

  // ── Detail popup ──
  showFloatDetail: (options: {
    anchorX: number
    anchorY: number
    anchorW: number
    anchorH: number
  }) => Promise<boolean>
  hideFloatDetail: () => Promise<boolean>
  resizeDetailWindow: (width: number, height: number) => Promise<boolean>
  notifyDetailHover: (state: 'enter' | 'leave') => void
  detailReady: () => Promise<boolean>
  onDetailHoverChanged: (callback: (state: 'enter' | 'leave') => void) => () => void

  // ── Context menu popup ──
  showCtxMenu: (options: {
    screenX: number
    screenY: number
    modelId: string | null
    modelName: string | null
    theme: string
    preset: string
    layoutMode: string
    alwaysOnTop: boolean
  }) => Promise<boolean>
  hideCtxMenu: () => Promise<boolean>
  sendCtxMenuAction: (action: string) => Promise<boolean>
  getCtxMenuConfig: () => Promise<{
    modelId: string | null
    modelName: string | null
    theme: string
    preset: string
    layoutMode: string
    alwaysOnTop: boolean
  } | null>
  onCtxMenuConfig: (callback: (config: {
    modelId: string | null
    modelName: string | null
    theme: string
    preset: string
    layoutMode: string
    alwaysOnTop: boolean
  }) => void) => () => void
  onExecuteCtxMenuAction: (callback: (action: string) => void) => () => void
  onCtxMenuClosed: (callback: () => void) => () => void

  // ── Edge docking ──
  dockFloatWindow: (edge: 'left' | 'right' | 'top') => Promise<boolean>
  undockFloatWindow: () => Promise<boolean>
  getEdgeDockState: () => Promise<{ isDocked: boolean; edge: 'left' | 'right' | 'top' | null; originalX: number; originalY: number } | null>
  onEdgeDockChanged: (callback: (state: { isDocked: boolean; edge: 'left' | 'right' | 'top' | null }) => void) => () => void
  stripMousedown: () => Promise<void>

  // ── Theme sync ──
  getTheme: () => Promise<{ mode: string; accent: string; preset: string }>
  notifyThemeChanged: (theme: { mode: string; accent: string; preset: string }) => Promise<boolean>
  onThemeChanged: (callback: (theme: { mode: string; accent: string; preset: string }) => void) => () => void
  onThemeInit: (callback: (theme: { mode: string; accent: string; preset: string }) => void) => () => void

  // ── Config update ──
  onConfigUpdated: (callback: () => void) => () => void

  // ── Usage refresh ──
  getCachedUsage: () => Promise<Record<string, any>>
  getFetchingState: () => Promise<Record<string, boolean>>
  getStripData: () => Promise<{ fiveHour: number; sevenDay: number; hasTiers: boolean; mainPercent: number }>
  refreshAllModels: () => Promise<boolean>
  refreshModel: (modelId: string) => Promise<boolean>
  onUsageUpdated: (callback: (data: { modelId: string, data: any }) => void) => () => void
  onUsageFetching: (callback: (data: { modelId: string, fetching: boolean }) => void) => () => void

  // ── Login ──
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
  openKimiLogin: (modelId?: string) => Promise<{ cookies: string | null; token: string | null }>
  onKimiLoginSuccess: (callback: (data: { modelId: string; hasToken: boolean }) => void) => () => void
  onLoginNeeded: (callback: (data: { modelId: string }) => void) => () => void
  onApiKeyInvalid: (callback: (data: { modelId: string, modelName: string, provider: string }) => void) => () => void

  // ── Close action ──
  getCloseAction: () => Promise<string | null>
  setCloseAction: (action: string | null) => Promise<boolean>
  closeActionChosen: (action: string, remember: boolean) => Promise<void>
  onCloseActionUpdated: (callback: (action: string | null) => void) => () => void
  onShowCloseDialog: (callback: () => void) => () => void
  onResetCloseDialog: (callback: () => void) => () => void

  // ── Tray ──
  onTrayToggleTheme: (callback: () => void) => () => void
  onTraySetAccent: (callback: (accent: string) => void) => () => void
  onTraySetPreset: (callback: (preset: string) => void) => () => void

  // ── Tray menu ──
  getTrayMenuConfig: () => Promise<any>
  sendTrayMenuAction: (action: string) => Promise<any>
  onTrayMenuUpdate: (callback: (payload: any) => void) => () => void

  // ── Export ──
  showSaveDialog: (options: { title?: string; defaultPath?: string; filters?: { name: string; extensions: string[] }[] }) => Promise<{ canceled: boolean; filePath: string }>
  saveFile: (options: { filePath: string; content: string }) => Promise<boolean>

  // ── Debug ──
  debugLog: (msg: string) => Promise<boolean>
  floatReady: () => Promise<boolean>
}

const electronAPI: ElectronAPI = {
  // Config / data
  loadConfig: () => ipcRenderer.invoke(IPC.CONFIG.LOAD),
  saveConfig: (config) => ipcRenderer.invoke(IPC.CONFIG.SAVE, config),
  loadUsage: (month) => ipcRenderer.invoke(IPC.USAGE.LOAD, month),
  saveUsage: (month, data) => ipcRenderer.invoke(IPC.USAGE.SAVE, month, data),
  getDataPath: () => ipcRenderer.invoke(IPC.DATA_PATH),

  // API proxies
  fetchMimoUsage: (options) => ipcRenderer.invoke(IPC.API.MIMO_USAGE, options),
  fetchMimoTokenPlan: (options) => ipcRenderer.invoke(IPC.API.MIMO_TOKEN_PLAN, options),
  fetchMimoTokenPlanDetail: (options) => ipcRenderer.invoke(IPC.API.MIMO_TOKEN_PLAN_DETAIL, options),
  fetchKimiSubscription: (options) => ipcRenderer.invoke(IPC.API.KIMI_SUBSCRIPTION, options),
  fetchOpenCodeUsageDetail: (options) => ipcRenderer.invoke(IPC.API.OPCODE_USAGE_DETAIL, options),
  fetchOpenCodeUsageRecords: (options) => ipcRenderer.invoke(IPC.API.OPCODE_USAGE_RECORDS, options),

  // Main window
  showMainWindow: () => ipcRenderer.invoke(IPC.MAIN_WINDOW.SHOW),
  windowMinimize: () => ipcRenderer.invoke(IPC.MAIN_WINDOW.MINIMIZE),
  windowMaximize: () => ipcRenderer.invoke(IPC.MAIN_WINDOW.MAXIMIZE),
  windowClose: () => ipcRenderer.invoke(IPC.MAIN_WINDOW.CLOSE),

  // Float window
  openFloatWindow: () => ipcRenderer.invoke(IPC.FLOAT.OPEN),
  closeFloatWindow: () => ipcRenderer.invoke(IPC.FLOAT.CLOSE),
  getFloatWindowState: () => ipcRenderer.invoke(IPC.FLOAT.STATE),
  focusFloatWindow: () => ipcRenderer.invoke(IPC.FLOAT.FOCUS),
  setFloatAlwaysOnTop: (value) => ipcRenderer.invoke(IPC.FLOAT.SET_ALWAYS_ON_TOP, value),
  setFloatWindowPosition: (x, y) => ipcRenderer.invoke(IPC.FLOAT.SET_POSITION, x, y),
  getFloatWindowBounds: () => ipcRenderer.invoke(IPC.FLOAT.GET_BOUNDS),
  resizeFloatWindow: (width, height) => ipcRenderer.invoke(IPC.FLOAT.RESIZE, width, height),
  resizeFloatWindowAnimated: (width, height, duration) => ipcRenderer.invoke(IPC.FLOAT.RESIZE_ANIMATED, width, height, duration),
  startWindowDrag: (options) => ipcRenderer.invoke(IPC.DRAG.START, options),
  stopWindowDrag: () => ipcRenderer.invoke(IPC.DRAG.STOP),
  onFloatWindowClosed: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.FLOAT.CLOSED, handler)
    return () => { ipcRenderer.removeListener(IPC.FLOAT.CLOSED, handler) }
  },
  onFloatWindowOpened: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.FLOAT.OPENED, handler)
    return () => { ipcRenderer.removeListener(IPC.FLOAT.OPENED, handler) }
  },

  // Detail popup
  showFloatDetail: (options) => ipcRenderer.invoke(IPC.DETAIL.SHOW, options),
  hideFloatDetail: () => ipcRenderer.invoke(IPC.DETAIL.HIDE),
  resizeDetailWindow: (width, height) => ipcRenderer.invoke(IPC.DETAIL.RESIZE, width, height),
  notifyDetailHover: (state) => ipcRenderer.send(IPC.DETAIL.HOVER_NOTIFY, state),
  detailReady: () => ipcRenderer.invoke(IPC.DETAIL.READY),
  onDetailHoverChanged: (callback) => {
    const handler = (_: any, state: 'enter' | 'leave') => callback(state)
    ipcRenderer.on(IPC.DETAIL.HOVER_CHANGED, handler)
    return () => { ipcRenderer.removeListener(IPC.DETAIL.HOVER_CHANGED, handler) }
  },

  // Context menu popup
  showCtxMenu: (options) => ipcRenderer.invoke(IPC.CTX_MENU.SHOW, options),
  hideCtxMenu: () => ipcRenderer.invoke(IPC.CTX_MENU.HIDE),
  sendCtxMenuAction: (action) => ipcRenderer.invoke(IPC.CTX_MENU.ACTION, action),
  getCtxMenuConfig: () => ipcRenderer.invoke(IPC.CTX_MENU.GET_CONFIG),
  onCtxMenuConfig: (callback) => {
    const wrapper = (_: any, config: any) => callback(config)
    ipcRenderer.on(IPC.CTX_MENU.CONFIG, wrapper)
    return () => { ipcRenderer.removeListener(IPC.CTX_MENU.CONFIG, wrapper) }
  },
  onExecuteCtxMenuAction: (callback) => {
    const wrapper = (_: any, action: string) => callback(action)
    ipcRenderer.on(IPC.CTX_MENU.ACTION_EXECUTE, wrapper)
    return () => { ipcRenderer.removeListener(IPC.CTX_MENU.ACTION_EXECUTE, wrapper) }
  },
  onCtxMenuClosed: (callback) => {
    const wrapper = () => callback()
    ipcRenderer.on(IPC.CTX_MENU.CLOSED, wrapper)
    return () => { ipcRenderer.removeListener(IPC.CTX_MENU.CLOSED, wrapper) }
  },

  // Edge docking
  dockFloatWindow: (edge) => ipcRenderer.invoke(IPC.EDGE_DOCK.DOCK, edge),
  undockFloatWindow: () => ipcRenderer.invoke(IPC.EDGE_DOCK.UNDOCK),
  getEdgeDockState: () => ipcRenderer.invoke(IPC.EDGE_DOCK.GET_STATE),
  onEdgeDockChanged: (callback) => {
    const wrapper = (_: any, state: any) => callback(state)
    ipcRenderer.on(IPC.EDGE_DOCK.CHANGED, wrapper)
    return () => { ipcRenderer.removeListener(IPC.EDGE_DOCK.CHANGED, wrapper) }
  },
  stripMousedown: () => ipcRenderer.invoke(IPC.EDGE_DOCK.STRIP_MOUSEDOWN),

  // Theme sync
  getTheme: () => ipcRenderer.invoke(IPC.THEME.GET),
  notifyThemeChanged: (theme) => ipcRenderer.invoke(IPC.THEME.NOTIFY_CHANGED, theme),
  onThemeChanged: (callback) => {
    const wrapper = (_: any, theme: { mode: string; accent: string; preset: string }) => callback(theme)
    ipcRenderer.on(IPC.THEME.CHANGED, wrapper)
    return () => { ipcRenderer.removeListener(IPC.THEME.CHANGED, wrapper) }
  },
  onThemeInit: (callback) => {
    const wrapper = (_: any, theme: { mode: string; accent: string; preset: string }) => callback(theme)
    ipcRenderer.on(IPC.THEME.INIT, wrapper)
    return () => { ipcRenderer.removeListener(IPC.THEME.INIT, wrapper) }
  },

  // Config update
  onConfigUpdated: (callback) => {
    const wrapper = () => callback()
    ipcRenderer.on(IPC.CONFIG_UPDATED, wrapper)
    return () => { ipcRenderer.removeListener(IPC.CONFIG_UPDATED, wrapper) }
  },

  // Usage refresh
  getCachedUsage: () => ipcRenderer.invoke(IPC.USAGE_REFRESH.CACHED),
  getFetchingState: () => ipcRenderer.invoke(IPC.USAGE_REFRESH.FETCHING),
  getStripData: () => ipcRenderer.invoke(IPC.USAGE_REFRESH.STRIP_DATA),
  refreshAllModels: () => ipcRenderer.invoke(IPC.USAGE_REFRESH.REFRESH_ALL),
  refreshModel: (modelId) => ipcRenderer.invoke(IPC.USAGE_REFRESH.REFRESH_MODEL, modelId),
  onUsageUpdated: (callback) => {
    const wrapper = (_: any, data: any) => callback(data)
    ipcRenderer.on(IPC.USAGE_REFRESH.UPDATED, wrapper)
    return () => { ipcRenderer.removeListener(IPC.USAGE_REFRESH.UPDATED, wrapper) }
  },
  onUsageFetching: (callback) => {
    const wrapper = (_: any, data: any) => callback(data)
    ipcRenderer.on(IPC.USAGE_REFRESH.FETCHING_CHANGED, wrapper)
    return () => { ipcRenderer.removeListener(IPC.USAGE_REFRESH.FETCHING_CHANGED, wrapper) }
  },

  // Login
  openMimoLogin: (modelId) => ipcRenderer.invoke(IPC.LOGIN.MIMO, modelId),
  openOpencodeLogin: (modelId) => ipcRenderer.invoke(IPC.LOGIN.OPCODE, modelId),
  openKimiLogin: (modelId) => ipcRenderer.invoke(IPC.LOGIN.KIMI, modelId),
  onKimiLoginSuccess: (callback) => {
    const wrapper = (_: any, data: { modelId: string; hasToken: boolean }) => callback(data)
    ipcRenderer.on(IPC.LOGIN.KIMI_SUCCESS, wrapper)
    return () => { ipcRenderer.removeListener(IPC.LOGIN.KIMI_SUCCESS, wrapper) }
  },
  onLoginNeeded: (callback) => {
    const wrapper = (_: any, data: { modelId: string }) => callback(data)
    ipcRenderer.on(IPC.LOGIN.NEEDED, wrapper)
    return () => { ipcRenderer.removeListener(IPC.LOGIN.NEEDED, wrapper) }
  },
  onApiKeyInvalid: (callback) => {
    const wrapper = (_: any, data: { modelId: string, modelName: string, provider: string }) => callback(data)
    ipcRenderer.on(IPC.LOGIN.API_KEY_INVALID, wrapper)
    return () => { ipcRenderer.removeListener(IPC.LOGIN.API_KEY_INVALID, wrapper) }
  },

  // Close action
  getCloseAction: () => ipcRenderer.invoke(IPC.CLOSE_ACTION.GET),
  setCloseAction: (action) => ipcRenderer.invoke(IPC.CLOSE_ACTION.SET, action),
  closeActionChosen: (action, remember) => ipcRenderer.invoke(IPC.CLOSE_ACTION.CHOSEN, action, remember),
  onCloseActionUpdated: (callback) => {
    const wrapper = (_: any, action: string | null) => callback(action)
    ipcRenderer.on(IPC.CLOSE_ACTION.UPDATED, wrapper)
    return () => { ipcRenderer.removeListener(IPC.CLOSE_ACTION.UPDATED, wrapper) }
  },
  onShowCloseDialog: (callback) => {
    const wrapper = () => callback()
    ipcRenderer.on(IPC.CLOSE_ACTION.SHOW_DIALOG, wrapper)
    return () => { ipcRenderer.removeListener(IPC.CLOSE_ACTION.SHOW_DIALOG, wrapper) }
  },
  onResetCloseDialog: (callback) => {
    const wrapper = () => callback()
    ipcRenderer.on(IPC.CLOSE_ACTION.RESET_DIALOG, wrapper)
    return () => { ipcRenderer.removeListener(IPC.CLOSE_ACTION.RESET_DIALOG, wrapper) }
  },

  // Tray
  onTrayToggleTheme: (callback) => {
    const wrapper = () => callback()
    ipcRenderer.on(IPC.TRAY.TOGGLE_THEME, wrapper)
    return () => { ipcRenderer.removeListener(IPC.TRAY.TOGGLE_THEME, wrapper) }
  },
  onTraySetAccent: (callback) => {
    const wrapper = (_: any, accent: string) => callback(accent)
    ipcRenderer.on(IPC.TRAY.SET_ACCENT, wrapper)
    return () => { ipcRenderer.removeListener(IPC.TRAY.SET_ACCENT, wrapper) }
  },
  onTraySetPreset: (callback) => {
    const wrapper = (_: any, preset: string) => callback(preset)
    ipcRenderer.on(IPC.TRAY.SET_PRESET, wrapper)
    return () => { ipcRenderer.removeListener(IPC.TRAY.SET_PRESET, wrapper) }
  },

  // Tray menu
  getTrayMenuConfig: () => ipcRenderer.invoke(IPC.TRAY_MENU.GET_CONFIG),
  sendTrayMenuAction: (action) => ipcRenderer.invoke(IPC.TRAY_MENU.ACTION, action),
  onTrayMenuUpdate: (callback) => {
    const wrapper = (_: any, payload: any) => callback(payload)
    ipcRenderer.on(IPC.TRAY_MENU.UPDATE, wrapper)
    return () => { ipcRenderer.removeListener(IPC.TRAY_MENU.UPDATE, wrapper) }
  },

  // Export
  showSaveDialog: (options) => ipcRenderer.invoke(IPC.EXPORT.SAVE_DIALOG, options),
  saveFile: (options) => ipcRenderer.invoke(IPC.EXPORT.SAVE_FILE, options),

  // Debug
  debugLog: (msg) => ipcRenderer.invoke(IPC.DEBUG_LOG, msg),
  floatReady: () => ipcRenderer.invoke(IPC.FLOAT.READY),
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
