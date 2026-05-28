import type { ModelUsageStatus, UsageTier } from '@/stores/app'

export const MIMO_DEFAULT_BASE_URL = 'https://platform.xiaomimimo.com/api/v1/tokenPlan/usage'
export const KIMI_DEFAULT_BASE_URL = 'https://api.kimi.com/coding/v1/usages'
export const DEEPSEEK_DEFAULT_BASE_URL = 'https://api.deepseek.com/user/balance'

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

interface MimoApiResponse {
  code: number
  data?: MimoResponseData
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
        const tier = makeTier('five_hour', '5小时', detail)
        if (tier) tiers.push(tier)
      }
    }
  }

  // 2. 7天限额 (usage)
  const usage = response.usage
  if (usage && typeof usage === 'object') {
    const tier = makeTier('seven_day', '7天', usage)
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

// ── DeepSeek (余额查询) ──
// 响应格式: { balance_infos: [{ currency: "CNY", total_balance: 50.00, ... }] }

interface DeepSeekBalanceInfo {
  currency: string
  total_balance: number
  granted_balance?: number
  topped_up_balance?: number
}

interface DeepSeekResponse {
  balance_infos?: DeepSeekBalanceInfo[]
}

function parseDeepSeekResponse(response: DeepSeekResponse): ModelUsageStatus | null {
  if (!response || !Array.isArray(response.balance_infos) || response.balance_infos.length === 0) {
    return null
  }

  const info = response.balance_infos[0]
  const balance = info.total_balance ?? 0
  const currency = info.currency ?? 'CNY'

  return {
    usageType: 'balance',
    planName: 'DeepSeek',
    lastUpdated: Date.now(),
    balance,
    currency
  }
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
      result = parseKimiResponse(response)
      break
    case 'deepseek':
      result = parseDeepSeekResponse(response)
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
