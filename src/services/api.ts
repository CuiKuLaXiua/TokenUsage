import type { ModelUsageStatus, UsageTier } from '@/stores/app'

export const MIMO_DEFAULT_BASE_URL = 'https://platform.xiaomimimo.com/api/v1/tokenPlan/usage'
export const KIMI_DEFAULT_BASE_URL = 'https://api.kimi.com/coding/v1/usages'
export const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com/user/balance'
export const OPENCODE_DEFAULT_BASE_URL = 'https://opencode.ai/_server'

// ── MIMO ──
interface MimoResponseItem {
  name: string
  used: number
  limit: number
}

interface MimoResponseData {
  usage?: { items?: MimoResponseItem[] }
  monthUsage?: { items?: MimoResponseItem[] }
}

interface MimoTokenPlanDetailData {
  planCode: string
  planName: string
  currentPeriodEnd: string
  expired: boolean
  enableAutoRenew: boolean
  autoRenewDiscount: number | null
  hasAutoRenewSubscribed: boolean
}

interface MimoApiResponse {
  code: number
  data?: MimoResponseData
  detail?: { code: number; data?: MimoTokenPlanDetailData }
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

function parseMimoResponse(response: MimoApiResponse): ModelUsageStatus | null {
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

  // 解析套餐详情（tokenPlan/detail）
  const detail = response.detail?.data
  if (detail?.planName) {
    planName = detail.planName
  }

  const result: ModelUsageStatus = {
    usageType: 'token',
    planName,
    used,
    total,
    remaining,
    percent,
    lastUpdated: Date.now()
  }

  if (detail) {
    result.planCode = detail.planCode
    result.currentPeriodEnd = detail.currentPeriodEnd
    result.expired = detail.expired
    result.enableAutoRenew = detail.enableAutoRenew
    result.hasAutoRenewSubscribed = detail.hasAutoRenewSubscribed
  }

  return result
}

// ── Kimi (Coding Plan) ──
// 响应格式: { limits: [{ detail: { limit, used, remaining, resetTime } }], usage: { limit, used, remaining, resetTime } }

function parseF64(value: unknown): number | null {
  if (typeof value === 'number') return value
  if (typeof value === 'string') {
    const n = Number(value)
    return isNaN(n) ? null : n
  }
  return null
}

function makeTier(
  name: string,
  label: string,
  detail: any
): UsageTier | null {
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

  // 主数据取7天限额（最重要），没有则取第一个 tier
  const primary = tiers.find(t => t.name === 'seven_day') ?? tiers[0]

  return {
    usageType: 'percent',
    planName: 'Kimi Coding',
    lastUpdated: Date.now(),
    tiers
  }
}

function parseKimiSubscriptionResponse(response: any): ModelUsageStatus | null {
  if (!response || typeof response !== 'object') return null

  const tiers: UsageTier[] = []

  // 5 小时速率限制
  const limit5h = response.ratelimitCode5h
  if (limit5h && typeof limit5h === 'object' && limit5h.enabled) {
    const ratio = Number(limit5h.ratio) || 0
    const percent = Math.round(ratio * 10000) / 100
    tiers.push({
      name: 'five_hour',
      label: '5H',
      percent,
      resetAt: typeof limit5h.resetTime === 'string' ? limit5h.resetTime : undefined
    })
  }

  // 7 天速率限制
  const limit7d = response.ratelimitCode7d
  if (limit7d && typeof limit7d === 'object' && limit7d.enabled) {
    const ratio = Number(limit7d.ratio) || 0
    const percent = Math.round(ratio * 10000) / 100
    tiers.push({
      name: 'seven_day',
      label: '7D',
      percent,
      resetAt: typeof limit7d.resetTime === 'string' ? limit7d.resetTime : undefined
    })
  }

  // 月度订阅额度 → 与 OpenCode 统一显示为 30D
  const subscription = response.subscriptionBalance
  if (subscription && typeof subscription === 'object') {
    const ratio = Number(subscription.amountUsedRatio) || 0
    const percent = Math.round(ratio * 10000) / 100
    tiers.push({
      name: 'subscription',
      label: '30D',
      percent,
      resetAt: typeof subscription.expireTime === 'string' ? subscription.expireTime : undefined
    })
  }

  if (tiers.length === 0) return null

  return {
    usageType: 'percent',
    planName: 'Kimi 订阅',
    lastUpdated: Date.now(),
    tiers,
    currentPeriodEnd: typeof subscription?.expireTime === 'string' ? subscription.expireTime : undefined
  }
}

// ── DeepSeek (余额查询) ──
// 响应格式: { balance_infos: [{ currency: "CNY", total_balance: 50.00, ... }] }

interface DeepSeekBalanceInfo {
  currency: string
  total_balance: number | string
  granted_balance?: number | string
  topped_up_balance?: number | string
}

interface DeepSeekResponse {
  balance_infos?: DeepSeekBalanceInfo[]
}

function parseDeepSeekResponse(response: DeepSeekResponse): ModelUsageStatus | null {
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

// ── Open Code (通用查询) ──
// 响应格式未明确，尝试多种常见格式

function parseOpenCodeResponse(response: any): ModelUsageStatus | null {
  // Open Code 返回的是 JavaScript 代码，需要从字符串中提取数据
  if (typeof response === 'string') {
    try {
      // 提取 monthlyUsage 的 usagePercent
      const monthlyMatch = response.match(/monthlyUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*usagePercent:\s*(\d+)[^}]*\}/)
      const weeklyMatch = response.match(/weeklyUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*usagePercent:\s*(\d+)[^}]*\}/)
      const rollingMatch = response.match(/rollingUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*usagePercent:\s*(\d+)[^}]*\}/)

      // 提取 resetInSec
      const monthlyResetMatch = response.match(/monthlyUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*resetInSec:\s*(\d+)[^}]*\}/)
      const weeklyResetMatch = response.match(/weeklyUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*resetInSec:\s*(\d+)[^}]*\}/)
      const rollingResetMatch = response.match(/rollingUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*resetInSec:\s*(\d+)[^}]*\}/)

      const tiers: UsageTier[] = []

      if (rollingMatch) {
        const percent = parseInt(rollingMatch[1])
        const resetSec = rollingResetMatch ? parseInt(rollingResetMatch[1]) : undefined
        // 将秒数转换为 ISO 日期格式（当前时间 + resetInSec）
        const resetAt = resetSec ? new Date(Date.now() + resetSec * 1000).toISOString() : undefined
        tiers.push({
          name: 'five_hour',
          label: '5H',
          percent,
          resetAt
        })
      }

      if (weeklyMatch) {
        const percent = parseInt(weeklyMatch[1])
        const resetSec = weeklyResetMatch ? parseInt(weeklyResetMatch[1]) : undefined
        const resetAt = resetSec ? new Date(Date.now() + resetSec * 1000).toISOString() : undefined
        tiers.push({
          name: 'weekly',
          label: '7D',
          percent,
          resetAt
        })
      }

      if (monthlyMatch) {
        const percent = parseInt(monthlyMatch[1])
        const resetSec = monthlyResetMatch ? parseInt(monthlyResetMatch[1]) : undefined
        const resetAt = resetSec ? new Date(Date.now() + resetSec * 1000).toISOString() : undefined
        tiers.push({
          name: 'monthly',
          label: '30D',
          percent,
          resetAt
        })
      }

      if (tiers.length > 0) {
        return {
          usageType: 'percent',
          planName: 'Open Code',
          lastUpdated: Date.now(),
          tiers
        }
      }

      return null
    } catch (e) {
      console.error('[OpenCode] 解析 JavaScript 响应失败:', e)
      return null
    }
  }

  // 如果是对象，尝试之前的格式
  if (response && typeof response === 'object') {
    // 格式 1: { usage: { used, total, remaining }, planName }
    if (response.usage && typeof response.usage === 'object') {
      const { used, total, remaining } = response.usage
      if (typeof total === 'number' && total > 0) {
        return {
          usageType: 'token',
          planName: response.planName || 'Open Code',
          used: Number(used) || 0,
          total: Number(total) || 0,
          remaining: Number(remaining) || Math.max(0, total - (used || 0)),
          percent: total > 0 ? Math.round(((used || 0) / total) * 10000) / 100 : 0,
          lastUpdated: Date.now()
        }
      }
    }

    // 格式 2: { balance: number, currency: string }
    if (typeof response.balance === 'number') {
      return {
        usageType: 'balance',
        planName: response.planName || 'Open Code',
        balance: response.balance,
        currency: response.currency || 'USD',
        lastUpdated: Date.now()
      }
    }

    // 格式 3: { total, used, remaining } 直接在顶层
    if (typeof response.total === 'number' && response.total > 0) {
      return {
        usageType: 'token',
        planName: response.planName || 'Open Code',
        used: Number(response.used) || 0,
        total: Number(response.total) || 0,
        remaining: Number(response.remaining) || Math.max(0, response.total - (response.used || 0)),
        percent: response.total > 0 ? Math.round(((response.used || 0) / response.total) * 10000) / 100 : 0,
        lastUpdated: Date.now()
      }
    }

    // 格式 4: 尝试 Kimi 风格的 limits/usage
    const kimiStyleResult = parseKimiResponse(response)
    if (kimiStyleResult) {
      kimiStyleResult.planName = 'Open Code'
      return kimiStyleResult
    }
  }

  return null
}

// ── 通用入口 ──
export function extractUsage(response: any, provider: string): ModelUsageStatus | null {
  console.log(`[${provider}] 原始响应:`, JSON.stringify(response, null, 2))

  let result: ModelUsageStatus | null = null

  switch (provider) {
    case 'mimo':
      result = parseMimoResponse(response)
      break
    case 'kimi':
      // Kimi Cookie 方式返回 subscription 结构，API Key 方式返回 limits/usage 结构
      result = parseKimiSubscriptionResponse(response) || parseKimiResponse(response)
      break
    case 'deepseek':
      result = parseDeepSeekResponse(response)
      break
    case 'opencode':
      result = parseOpenCodeResponse(response)
      break
    default:
      // 未知 provider 尝试通用解析
      result = parseKimiResponse(response)
      break
  }

  if (!result) {
    console.warn(`[${provider}] 解析失败，原始数据:`, response)
  }

  return result
}
