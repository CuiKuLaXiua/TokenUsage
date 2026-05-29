import { BrowserWindow, net } from 'electron'
import { readFileSync, existsSync } from 'fs'

// ── 类型定义 ──

interface ModelConfig {
  id: string
  name: string
  provider: string
  apiKey: string
  baseUrl: string
  cookies: string
  refreshInterval?: number
  enabled: boolean
}

interface UsageTier {
  name: string
  label: string
  used?: number
  total?: number
  remaining?: number
  percent: number
  resetAt?: string
}

interface ModelUsageStatus {
  usageType: 'token' | 'balance' | 'percent'
  planName: string
  lastUpdated: number
  used?: number
  total?: number
  remaining?: number
  percent?: number
  balance?: number
  currency?: string
  tiers?: UsageTier[]
}

// ── API URL 常量 ──

const MIMO_DEFAULT_BASE_URL = 'https://platform.xiaomimimo.com/api/v1/tokenPlan/usage'
const KIMI_DEFAULT_BASE_URL = 'https://api.kimi.com/coding/v1/usages'
const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com/user/balance'

// ── 解析逻辑（从 src/services/api.ts 复制） ──

interface MimoResponseItem {
  name: string
  used: number
  limit: number
}

function extractQuota(items?: MimoResponseItem[]) {
  let totalLimit = 0
  let totalUsed = 0
  if (items && Array.isArray(items)) {
    for (const item of items) {
      if (item.name === 'plan_total_token' || item.name === 'compensation_total_token') {
        totalLimit += item.limit || 0
        totalUsed += item.used || 0
      }
    }
  }
  return { totalLimit, totalUsed }
}

function parseMimoResponse(response: any): ModelUsageStatus | null {
  if (!response || response.code !== 0 || !response.data) return null

  const { data } = response
  const usageQuota = extractQuota(data.usage?.items)
  const monthQuota = extractQuota(data.monthUsage?.items)

  const total = usageQuota.totalLimit || monthQuota.totalLimit
  const used = usageQuota.totalUsed || monthQuota.totalUsed
  const remaining = Math.max(0, total - used)
  const percent = total > 0 ? Math.round((used / total) * 10000) / 100 : 0

  let planName = '未知套餐'
  if (data.usage?.items) {
    for (const item of data.usage.items) {
      if (item.name === 'plan_total_token') {
        planName = '基础套餐'
        break
      }
    }
  } else if (data.monthUsage?.items) {
    for (const item of data.monthUsage.items) {
      if (item.name === 'month_total_token') {
        planName = '月度套餐'
        break
      }
    }
  }

  return {
    usageType: 'token',
    planName,
    used,
    total,
    remaining,
    percent,
    lastUpdated: Date.now()
  }
}

function parseF64(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = Number(value)
    return isNaN(n) ? null : n
  }
  return null
}

function makeTier(name: string, label: string, detail: any): UsageTier | null {
  const total = parseF64(detail.limit) ?? 0
  const used = parseF64(detail.used) ?? 0
  const remaining = parseF64(detail.remaining) ?? 0
  if (total <= 0) return null
  const percent = Math.round((used / total) * 10000) / 100
  return {
    name,
    label,
    used,
    total,
    remaining,
    percent,
    resetAt: typeof detail.resetTime === 'string' ? detail.resetTime : undefined
  }
}

function parseKimiResponse(response: any): ModelUsageStatus | null {
  if (!response || typeof response !== 'object') return null

  const tiers: UsageTier[] = []

  // 1. 五小时窗口限额 (limits[].detail)
  const limits = response.limits
  if (Array.isArray(limits)) {
    for (const item of limits) {
      const detail = item?.detail
      if (detail && typeof detail === 'object') {
        const tier = makeTier('five_hour', '5H', detail)
        if (tier) tiers.push(tier)
      }
    }
  }

  // 2. 7天限额 (usage)
  const usage = response.usage
  if (usage && typeof usage === 'object') {
    const tier = makeTier('seven_day', '7D', usage)
    if (tier) tiers.push(tier)
  }

  if (tiers.length === 0) return null

  return {
    usageType: 'percent',
    planName: 'Kimi Coding',
    lastUpdated: Date.now(),
    tiers
  }
}

function parseDeepSeekResponse(response: any): ModelUsageStatus | null {
  if (!response || !Array.isArray(response.balance_infos) || response.balance_infos.length === 0) {
    return null
  }

  const info = response.balance_infos[0]
  const balance = Number(info.total_balance) || 0
  const currency = info.currency ?? 'CNY'

  return {
    usageType: 'balance',
    planName: 'DeepSeek',
    lastUpdated: Date.now(),
    balance,
    currency
  }
}

function extractUsage(response: any, provider: string): ModelUsageStatus | null {
  let result: ModelUsageStatus | null = null

  switch (provider) {
    case 'mimo':
      result = parseMimoResponse(response)
      break
    case 'kimi':
      result = parseKimiResponse(response)
      break
    case 'deepseek':
      result = parseDeepSeekResponse(response)
      break
    default:
      result = parseKimiResponse(response)
      break
  }

  return result
}

// ── 主进程刷新管理器 ──

export class UsageRefresher {
  private modelUsageMap: Map<string, ModelUsageStatus> = new Map()
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map()
  private configPath: string
  private models: ModelConfig[] = []
  private fetchInProgress: Set<string> = new Set()

  constructor(configPath: string) {
    this.configPath = configPath
  }

  /**
   * 加载配置并启动定时刷新
   */
  start(): void {
    this.loadConfig()
    this.stopAll()

    for (const model of this.models) {
      if (!model.enabled || !model.apiKey) continue

      // 首次立即拉取
      this.fetchModel(model).catch(() => {})

      // 设置定时器
      if (model.refreshInterval && model.refreshInterval > 0) {
        const timer = setInterval(() => {
          if (!this.fetchInProgress.has(model.id)) {
            this.fetchModel(model).catch(() => {})
          }
        }, model.refreshInterval * 60 * 1000)
        this.timers.set(model.id, timer)
      }
    }
  }

  /**
   * 重新加载配置（config 变更时调用）
   */
  restart(): void {
    console.log('[Refresher] 重启刷新服务')
    this.start()
  }

  /**
   * 拉取单个模型数据
   */
  async fetchModel(model: ModelConfig): Promise<ModelUsageStatus | null> {
    if (this.fetchInProgress.has(model.id)) return null

    this.fetchInProgress.add(model.id)
    this.broadcastFetching(model.id, true)

    try {
      const fetchOptions = this.buildFetchOptions(model)
      const responseData = await this.doRequest(fetchOptions)
      const result = extractUsage(responseData, model.provider)

      if (result) {
        this.modelUsageMap.set(model.id, result)
        this.broadcast(model.id, result)
        console.log(`[Refresher] ${model.name} 数据更新成功`)
        return result      }
      return null
    } catch (error) {
      console.error(`[Refresher] ${model.name} 拉取失败:`, error)

      // 检测 cookie 过期
      if (model.provider === 'mimo' && this.isCookieExpired(error)) {
        console.log('[Refresher] 检测到 Cookie 过期，广播 login-needed')
        this.broadcastLoginNeeded()
      }
      throw error
    } finally {
      this.fetchInProgress.delete(model.id)
      this.broadcastFetching(model.id, false)
    }
  }

  /**
   * 按 ID 拉取模型
   */
  async fetchModelById(modelId: string): Promise<ModelUsageStatus | null> {
    const model = this.models.find(m => m.id === modelId)
    if (!model) return null
    return this.fetchModel(model)
  }

  /**
   * 刷新所有模型
   */
  async refreshAll(): Promise<void> {
    console.log('[Refresher] 开始刷新所有模型')
    for (const model of this.models) {
      if (model.enabled && model.apiKey) {
        try {
          await this.fetchModel(model)
        } catch {
          // 继续刷新其他模型
        }
      }
    }
    console.log('[Refresher] 所有模型刷新完成')
  }

  /**
   * 获取当前缓存（新窗口打开时用）
   */
  getCachedData(): Record<string, ModelUsageStatus> {
    return Object.fromEntries(this.modelUsageMap)
  }

  /**
   * 停止所有定时器
   */
  stopAll(): void {
    this.timers.forEach(t => clearInterval(t))
    this.timers.clear()
  }

  // ── 私有方法 ──

  private loadConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        const config = JSON.parse(readFileSync(this.configPath, 'utf-8'))
        this.models = config.models || []
        console.log(`[Refresher] 加载配置成功，${this.models.length} 个模型`)
      }
    } catch (error) {
      console.error('[Refresher] 加载配置失败:', error)
      this.models = []
    }
  }

  private buildFetchOptions(model: ModelConfig): any {
    if (model.provider === 'kimi') {
      return {
        url: model.baseUrl || KIMI_DEFAULT_BASE_URL,
        apiKey: model.apiKey,
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    } else if (model.provider === 'deepseek') {
      return {
        url: model.baseUrl || DEEPSEEK_DEFAULT_BASE_URL,
        apiKey: model.apiKey,
        method: 'GET',
        headers: { 'Accept': 'application/json' }
      }
    } else {
      return {
        url: model.baseUrl || MIMO_DEFAULT_BASE_URL,
        apiKey: model.apiKey,
        cookies: model.cookies || ''
      }
    }
  }

  private doRequest(options: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const { url, apiKey, cookies, method = 'GET', headers = {}, body } = options

      const requestHeaders: Record<string, string> = {
        'Authorization': `Bearer ${apiKey}`,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
      }

      for (const [key, value] of Object.entries(headers)) {
        if (typeof value === 'string') requestHeaders[key] = value
      }

      if (method === 'POST' && !requestHeaders['Content-Type']) {
        requestHeaders['Content-Type'] = 'application/json'
      }

      if (cookies) requestHeaders['Cookie'] = cookies

      const request = net.request({ method, url, headers: requestHeaders })
      let responseData = ''

      request.on('response', (response) => {
        response.on('data', (chunk: Buffer) => { responseData += chunk.toString() })
        response.on('end', () => {
          try {
            const data = JSON.parse(responseData)

            // 检测 MiMo 登录重定向
            if (url.includes('platform.xiaomimimo.com')) {
              if (response.statusCode === 401 || response.statusCode === 403) {
                const error = new Error('Cookie expired or unauthorized')
                ;(error as any).code = 'COOKIE_EXPIRED'
                reject(error)
                return              }
              if (data.loginUrl) {
                const error = new Error('Cookie expired or unauthorized')
                ;(error as any).code = 'COOKIE_EXPIRED'
                reject(error)
                return
              }
            }

            resolve(data)
          } catch {
            reject(new Error('JSON解析失败'))
          }
        })
      })

      request.on('error', reject)

      if (body && ['POST', 'PUT', 'PATCH'].includes(method)) {
        request.write(typeof body === 'string' ? body : JSON.stringify(body))
      }

      request.end()
    })
  }

  private isCookieExpired(error: any): boolean {
    return error?.code === 'COOKIE_EXPIRED' ||
           (error instanceof Error && error.message.includes('Cookie expired'))
  }

  private broadcast(modelId: string, data: ModelUsageStatus): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('usage-updated', { modelId, data })
      }
    }
  }

  private broadcastFetching(modelId: string, isFetching: boolean): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('usage-fetching', { modelId, fetching: isFetching })
      }
    }
  }

  private broadcastLoginNeeded(): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send('login-needed')
      }
    }
  }
}
