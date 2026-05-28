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
}

const electronAPI: ElectronAPI = {
  loadConfig: () => ipcRenderer.invoke('load-config'),
  saveConfig: (config) => ipcRenderer.invoke('save-config', config),
  loadUsage: (month) => ipcRenderer.invoke('load-usage', month),
  saveUsage: (month, data) => ipcRenderer.invoke('save-usage', month, data),
  getDataPath: () => ipcRenderer.invoke('get-data-path'),
  fetchMimoUsage: (options) => ipcRenderer.invoke('fetch-mimo-usage', options),
  openFloatWindow: () => ipcRenderer.invoke('open-float-window'),
  closeFloatWindow: () => ipcRenderer.invoke('close-float-window')
}

contextBridge.exposeInMainWorld('electronAPI', electronAPI)
