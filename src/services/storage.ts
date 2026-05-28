import { type ModelConfig, type UsageRecord } from '@/stores/app'

export interface BackupData {
  version: string
  timestamp: number
  config: {
    models: ModelConfig[]
  }
  usage: Record<string, UsageRecord[]>
}

export class StorageService {
  private static instance: StorageService

  static getInstance(): StorageService {
    if (!StorageService.instance) {
      StorageService.instance = new StorageService()
    }
    return StorageService.instance
  }

  async loadConfig(): Promise<any> {
    try {
      return await window.electronAPI.loadConfig()
    } catch (error) {
      console.error('Error loading config:', error)
      return {}
    }
  }

  async saveConfig(config: any): Promise<boolean> {
    try {
      return await window.electronAPI.saveConfig(config)
    } catch (error) {
      console.error('Error saving config:', error)
      return false
    }
  }

  async loadUsage(month: string): Promise<UsageRecord[]> {
    try {
      return await window.electronAPI.loadUsage(month)
    } catch (error) {
      console.error('Error loading usage:', error)
      return []
    }
  }

  async saveUsage(month: string, data: UsageRecord[]): Promise<boolean> {
    try {
      return await window.electronAPI.saveUsage(month, data)
    } catch (error) {
      console.error('Error saving usage:', error)
      return false
    }
  }

  async getDataPath(): Promise<string> {
    try {
      return await window.electronAPI.getDataPath()
    } catch (error) {
      console.error('Error getting data path:', error)
      return ''
    }
  }

  async backupData(models: ModelConfig[]): Promise<BackupData | null> {
    try {
      const config = await this.loadConfig()
      const usageData: Record<string, UsageRecord[]> = {}
      
      const months = this.getRecentMonths(12)
      for (const month of months) {
        const data = await this.loadUsage(month)
        if (data.length > 0) {
          usageData[month] = data
        }
      }

      return {
        version: '1.0.0',
        timestamp: Date.now(),
        config: {
          models: models
        },
        usage: usageData
      }
    } catch (error) {
      console.error('Error creating backup:', error)
      return null
    }
  }

  async restoreBackup(backup: BackupData): Promise<boolean> {
    try {
      await this.saveConfig(backup.config)
      
      for (const [month, data] of Object.entries(backup.usage)) {
        await this.saveUsage(month, data)
      }
      
      return true
    } catch (error) {
      console.error('Error restoring backup:', error)
      return false
    }
  }

  private getRecentMonths(count: number): string[] {
    const months: string[] = []
    const now = new Date()
    
    for (let i = 0; i < count; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const month = date.toISOString().slice(0, 7)
      months.push(month)
    }
    
    return months
  }

  exportToCSV(records: UsageRecord[], models: ModelConfig[]): string {
    const headers = ['时间', '模型', '输入Token', '输出Token', '总Token', '费用']
    const rows = records.map(record => {
      const model = models.find(m => m.id === record.modelId)
      const modelName = model ? model.name : record.modelId
      const time = new Date(record.timestamp).toLocaleString('zh-CN')
      
      return [
        time,
        modelName,
        record.inputTokens,
        record.outputTokens,
        record.totalTokens,
        record.cost.toFixed(4)
      ].join(',')
    })
    
    return [headers.join(','), ...rows].join('\n')
  }

  exportToJSON(records: UsageRecord[], models: ModelConfig[]): string {
    const data = records.map(record => {
      const model = models.find(m => m.id === record.modelId)
      return {
        time: new Date(record.timestamp).toLocaleString('zh-CN'),
        model: model ? model.name : record.modelId,
        inputTokens: record.inputTokens,
        outputTokens: record.outputTokens,
        totalTokens: record.totalTokens,
        cost: record.cost
      }
    })
    
    return JSON.stringify(data, null, 2)
  }
}

export const storageService = StorageService.getInstance()
