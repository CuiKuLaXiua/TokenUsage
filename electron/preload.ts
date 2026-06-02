import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  loadConfig: () => Promise<any>
  saveConfig: (config: any) => Promise<boolean>
  loadUsage: (month: string) => Promise<any[]>
  saveUsage: (month: string, data: any[]) => Promise<boolean>
  getDataPath: () => Promise<string>
  fetchMimoUsage: (options: {
    url: string
    apiKey: string
    cookies?: string
    method?: string
    headers?: Record<string, string>
    body?: Record<string, unknown>
  }) => Promise<any>
  openFloatWindow: () => Promise<boolean>
  closeFloatWindow: () => Promise<boolean>
  focusFloatWindow: () => Promise<boolean>
  setFloatAlwaysOnTop: (value: boolean) => Promise<boolean>
  resizeFloatWindow: (width: number, height: number) => Promise<boolean>
  resizeFloatWindowAnimated: (width: number, height: number, duration: number) => Promise<boolean>
  debugLog: (msg: string) => Promise<boolean>
  startWindowDrag: (options: { mouseX: number; mouseY: number }) => Promise<void>
  windowDragMove: (options: { mouseX: number; mouseY: number }) => Promise<void>
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
  onConfigUpdated: (callback: () => void) => () => void
  openMimoLogin: () => Promise<string | null>
  onLoginNeeded: (callback: () => void) => () => void
  onApiKeyInvalid: (callback: (data: { modelId: string, modelName: string, provider: string }) => void) => () => void
  showMainWindow: () => Promise<boolean>
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
  // 新增：统一刷新相关
  getCachedUsage: () => Promise<Record<string, any>>
  refreshAllModels: () => Promise<boolean>
  refreshModel: (modelId: string) => Promise<boolean>
  onUsageUpdated: (callback: (data: { modelId: string, data: any }) => void) => () => void
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
}

const electronAPI: ElectronAPI = {
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadUsage: (month) => ipcRenderer.invoke('load-usage', month),
  saveUsage: (month, data) => ipcRenderer.invoke('save-usage', month, data),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  fetchMimoUsage: (options) => ipcRenderer.invoke('fetch-mimo-usage', options),
  openFloatWindow: () => ipcRenderer.invoke('open-float-window'),
  closeFloatWindow: () => ipcRenderer.invoke('close-float-window'),
  focusFloatWindow: () => ipcRenderer.invoke('focus-float-window'),
  setFloatAlwaysOnTop: (value) => ipcRenderer.invoke('set-float-always-on-top', value),
  resizeFloatWindow: (width, height) => ipcRenderer.invoke('resize-float-window', width, height),
  resizeFloatWindowAnimated: (width, height, duration) => ipcRenderer.invoke('resize-float-window-animated', width, height, duration),
  debugLog: (msg: string) => ipcRenderer.invoke('debug-log', msg),
  startWindowDrag: (options) => ipcRenderer.invoke('start-window-drag', options),
  windowDragMove: (options) => ipcRenderer.invoke('window-drag-move', options),
  stopWindowDrag: () => ipcRenderer.invoke('stop-window-drag'),
  setFloatWindowPosition: (x, y) => ipcRenderer.invoke('set-float-window-position', x, y),
  // 详情悬浮窗
  showFloatDetail: (options) => ipcRenderer.invoke('show-float-detail', options),
  hideFloatDetail: () => ipcRenderer.invoke('hide-float-detail'),
  resizeDetailWindow: (width, height) => ipcRenderer.invoke('resize-detail-window', width, height),
  getFloatWindowBounds: () => ipcRenderer.invoke('get-float-window-bounds'),
  onConfigUpdated: (callback) => {
    const wrapper = () => callback()
    ipcRenderer.on('config-updated', wrapper)
    return () => {
      ipcRenderer.removeListener('config-updated', wrapper)
    }
  },
  openMimoLogin: () => ipcRenderer.invoke('open-mimo-login'),
  onLoginNeeded: (callback) => {
    const wrapper = () => callback()
    ipcRenderer.on('login-needed', wrapper)
    return () => {
      ipcRenderer.removeListener('login-needed', wrapper)
    }
  },
  onApiKeyInvalid: (callback) => {
    const wrapper = (_: any, data: { modelId: string, modelName: string, provider: string }) => callback(data)
    ipcRenderer.on('api-key-invalid', wrapper)
    return () => {
      ipcRenderer.removeListener('api-key-invalid', wrapper)
    }
  },
  showMainWindow: () => ipcRenderer.invoke('show-main-window'),
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close'),
  // 统一刷新相关
  getCachedUsage: () => ipcRenderer.invoke('get-cached-usage'),
  refreshAllModels: () => ipcRenderer.invoke('refresh-all-models'),
  refreshModel: (modelId) => ipcRenderer.invoke('refresh-model', modelId),
  onUsageUpdated: (callback) => {
    const wrapper = (_: any, data: any) => callback(data)
    ipcRenderer.on('usage-updated', wrapper)
    return () => {
      ipcRenderer.removeListener('usage-updated', wrapper)
    }
  },
  onUsageFetching: (callback) => {
    const wrapper = (_: any, data: any) => callback(data)
    ipcRenderer.on('usage-fetching', wrapper)
    return () => {
      ipcRenderer.removeListener('usage-fetching', wrapper)
    }
  },
  notifyDetailHover: (state) => ipcRenderer.invoke('notify-detail-hover', state),
  onDetailHoverChanged: (callback) => {
    const wrapper = (_: any, state: 'enter' | 'leave') => callback(state)
    ipcRenderer.on('detail-hover-changed', wrapper)
    return () => {
      ipcRenderer.removeListener('detail-hover-changed', wrapper)
    }
  },
  // 右键菜单弹出窗
  showCtxMenu: (options) => ipcRenderer.invoke('show-ctx-menu', options),
  hideCtxMenu: () => ipcRenderer.invoke('hide-ctx-menu'),
  sendCtxMenuAction: (action) => ipcRenderer.invoke('ctx-menu-action', action),
  getCtxMenuConfig: () => ipcRenderer.invoke('get-ctx-menu-config'),
  onCtxMenuConfig: (callback) => {
    const wrapper = (_: any, config: any) => callback(config)
    ipcRenderer.on('ctx-menu-config', wrapper)
    return () => { ipcRenderer.removeListener('ctx-menu-config', wrapper) }
  },
  onNativeContextMenu: (callback) => {
    const wrapper = (_: any, pos: { x: number; y: number }) => callback(pos)
    ipcRenderer.on('native-context-menu', wrapper)
    return () => { ipcRenderer.removeListener('native-context-menu', wrapper) }
  },
  onExecuteCtxMenuAction: (callback) => {
    const wrapper = (_: any, action: string) => callback(action)
    ipcRenderer.on('execute-ctx-menu-action', wrapper)
    return () => { ipcRenderer.removeListener('execute-ctx-menu-action', wrapper) }
  },
  onCtxMenuClosed: (callback) => {
    const wrapper = () => callback()
    ipcRenderer.on('ctx-menu-closed', wrapper)
    return () => { ipcRenderer.removeListener('ctx-menu-closed', wrapper) }
  }
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
