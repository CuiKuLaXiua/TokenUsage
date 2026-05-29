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
  setFloatAlwaysOnTop: (value: boolean) => Promise<boolean>
  resizeFloatWindow: (width: number, height: number) => Promise<boolean>
  resizeFloatWindowAnimated: (width: number, height: number, duration?: number) => Promise<boolean>
  onConfigUpdated: (callback: () => void) => () => void
  openMimoLogin: () => Promise<string | null>
  onLoginNeeded: (callback: () => void) => () => void
  windowMinimize: () => Promise<void>
  windowMaximize: () => Promise<void>
  windowClose: () => Promise<void>
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
  setFloatAlwaysOnTop: (value) => ipcRenderer.invoke('set-float-always-on-top', value),
  resizeFloatWindow: (width, height) => ipcRenderer.invoke('resize-float-window', width, height),
  resizeFloatWindowAnimated: (width, height, duration) => ipcRenderer.invoke('resize-float-window-animated', width, height, duration),
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
  windowMinimize: () => ipcRenderer.invoke('window-minimize'),
  windowMaximize: () => ipcRenderer.invoke('window-maximize'),
  windowClose: () => ipcRenderer.invoke('window-close')
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
