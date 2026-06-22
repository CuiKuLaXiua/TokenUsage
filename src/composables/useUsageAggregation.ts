import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import type { UsageTier, ModelConfig, ModelUsageStatus } from '@/stores/app'

export interface TokenAggregation {
  total: number
  used: number
  remaining: number
  percent: number
  modelCount: number
}

export interface AggregatedTier {
  name: string
  label: string
  used: number
  total: number
  remaining: number
  percent: number
  resetAt?: string
}

export interface PercentAggregation {
  tiers: AggregatedTier[]
  worstPercent: number
  worstLabel: string
  modelCount: number
}

export interface BalanceAggregation {
  totalBalance: number
  currency: string
  modelCount: number
}

export interface MainRingInfo {
  percent: number
  label: string
  source: 'unified' | 'token' | 'percent' | 'balance' | 'none'
}

export interface SingleModelSummary {
  type: 'token' | 'percent' | 'balance'
  model: ModelConfig
  usage: ModelUsageStatus
  title: string
  subtitle: string
  primaryValue: number
  primaryLabel: string
  secondaryText: string
  tiers: UsageTier[]
}

/** 时间窗口优先级：数字越大表示窗口越长 */
const TIER_PRIORITY: Record<string, number> = {
  thirty_day: 3,
  monthly: 3,
  seven_day: 2,
  weekly: 2,
  five_hour: 1,
  rolling: 1
}

function getTierPriority(name: string): number {
  return TIER_PRIORITY[name] ?? 0
}

/**
 * 从 percent 型模型的 tiers 中选取最长窗口 tier
 * 30D > 7D > 5H，避免重叠时间窗口重复计数
 */
function pickLongestTier(tiers: UsageTier[]): UsageTier | null {
  if (!tiers || tiers.length === 0) return null
  let best = tiers[0]
  for (let i = 1; i < tiers.length; i++) {
    if (getTierPriority(tiers[i].name) > getTierPriority(best.name)) {
      best = tiers[i]
    }
  }
  return best
}

function pickWorstTier(tiers: UsageTier[]): UsageTier | null {
  if (!tiers || tiers.length === 0) return null
  return tiers.reduce((worst, t) => (t.percent > worst.percent ? t : worst), tiers[0])
}

function formatResetTimeShort(timeStr: string): string {
  try {
    const date = new Date(timeStr)
    const now = new Date()
    const diff = date.getTime() - now.getTime()

    if (diff <= 0) return '即将重置'

    const totalMinutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const days = Math.floor(hours / 24)
    const remainHours = hours % 24

    if (days > 0) {
      if (remainHours > 0) {
        return `${days}天${remainHours}时`
      }
      return `${days}天`
    }
    if (hours > 0) {
      if (minutes > 0) {
        return `${hours}时${minutes}分`
      }
      return `${hours}时`
    }
    return `${minutes}分`
  } catch {
    return timeStr
  }
}

export function useUsageAggregation() {
  const store = useAppStore()

  const enabledModels = computed(() => store.models.filter(m => m.enabled))

  const tokenModels = computed(() =>
    store.models.filter(m => m.enabled && store.modelUsageMap[m.id]?.usageType === 'token')
  )

  const percentModels = computed(() =>
    store.models.filter(m => m.enabled && store.modelUsageMap[m.id]?.usageType === 'percent')
  )

  const balanceModels = computed(() =>
    store.models.filter(m => m.enabled && store.modelUsageMap[m.id]?.usageType === 'balance')
  )

  const tokenAgg = computed<TokenAggregation | null>(() => {
    if (tokenModels.value.length === 0) return null
    let total = 0, used = 0
    for (const m of tokenModels.value) {
      const u = store.modelUsageMap[m.id]
      total += u.total || 0
      used += u.used || 0
    }
    const remaining = Math.max(0, total - used)
    const percent = total > 0 ? (used / total) * 100 : 0
    return { total, used, remaining, percent, modelCount: tokenModels.value.length }
  })

  const percentAgg = computed<PercentAggregation | null>(() => {
    if (percentModels.value.length === 0) return null

    const tierMap = new Map<string, { label: string; used: number; total: number; remaining: number; resetAt?: string }>()

    for (const m of percentModels.value) {
      const u = store.modelUsageMap[m.id]
      if (!u.tiers) continue
      for (const t of u.tiers) {
        const existing = tierMap.get(t.name)
        if (existing) {
          existing.used += t.used ?? 0
          existing.total += t.total ?? 0
          existing.remaining += t.remaining ?? 0
          if (t.resetAt && !existing.resetAt) existing.resetAt = t.resetAt
        } else {
          tierMap.set(t.name, {
            label: t.label,
            used: t.used ?? 0,
            total: t.total ?? 0,
            remaining: t.remaining ?? 0,
            resetAt: t.resetAt
          })
        }
      }
    }

    const tiers: AggregatedTier[] = []
    for (const [name, data] of tierMap) {
      const percent = data.total > 0 ? (data.used / data.total) * 100 : 0
      tiers.push({ name, label: data.label, used: data.used, total: data.total, remaining: data.remaining, percent, resetAt: data.resetAt })
    }

    tiers.sort((a, b) => b.percent - a.percent)

    const worstTier = tiers[0]
    return {
      tiers,
      worstPercent: worstTier?.percent ?? 0,
      worstLabel: worstTier?.label ?? '',
      modelCount: percentModels.value.length
    }
  })

  const balanceAgg = computed<BalanceAggregation | null>(() => {
    if (balanceModels.value.length === 0) return null
    let totalBalance = 0
    let currency = 'CNY'
    for (const m of balanceModels.value) {
      const u = store.modelUsageMap[m.id]
      totalBalance += u.balance || 0
      if (u.currency) currency = u.currency
    }
    return { totalBalance, currency, modelCount: balanceModels.value.length }
  })

  /**
   * 统一 Token 池：合并 token 型 + percent 型（取最长窗口）的所有 token 计量
   * balance 型不参与（它是金额，不是 token）
   */
  const unifiedTokenPool = computed(() => {
    let total = 0, used = 0

    // token 型
    if (tokenAgg.value) {
      total += tokenAgg.value.total
      used += tokenAgg.value.used
    }

    // percent 型 — 每个模型取最长窗口 tier，避免时间窗口重叠导致重复计数
    for (const m of percentModels.value) {
      const u = store.modelUsageMap[m.id]
      if (!u.tiers) continue
      const longest = pickLongestTier(u.tiers)
      if (longest) {
        total += longest.total ?? 0
        used += longest.used ?? 0
      }
    }

    const percent = total > 0 ? (used / total) * 100 : 0
    return { total, used, remaining: Math.max(0, total - used), percent }
  })

  const mainRing = computed<MainRingInfo>(() => {
    const pool = unifiedTokenPool.value

    if (pool.total > 0) {
      // 有 token 型或 percent 型数据（且 percent 型 tiers 带有 total/used）→ 显示统一 token 池使用率
      const hasToken = tokenAgg.value && tokenAgg.value.modelCount > 0
      const hasPercent = percentAgg.value && percentAgg.value.modelCount > 0

      let label: string
      if (hasToken && hasPercent) {
        label = `综合 ${pool.percent.toFixed(0)}%`
      } else if (hasToken) {
        label = `Token ${pool.percent.toFixed(0)}%`
      } else {
        label = `窗口 ${pool.percent.toFixed(0)}%`
      }

      return { percent: pool.percent, label, source: 'unified' }
    }

    // 只有 percent 型（tiers 无 total/used，如 OpenCode 或 Kimi 订阅模式）
    if (percentAgg.value && percentAgg.value.modelCount > 0) {
      const worst = percentAgg.value.worstPercent
      const label = percentAgg.value.worstLabel
      return {
        percent: worst,
        label: `${label} ${worst.toFixed(0)}%`,
        source: 'percent'
      }
    }

    // 只有 balance 型
    if (balanceAgg.value && balanceAgg.value.modelCount > 0) {
      return { percent: 0, label: '余额充足', source: 'balance' }
    }

    return { percent: 0, label: '暂无数据', source: 'none' }
  })

  const hasAnyData = computed(() =>
    (tokenAgg.value?.modelCount ?? 0) +
    (percentAgg.value?.modelCount ?? 0) +
    (balanceAgg.value?.modelCount ?? 0) > 0
  )

  const typeCounts = computed(() => ({
    token: tokenAgg.value?.modelCount ?? 0,
    percent: percentAgg.value?.modelCount ?? 0,
    balance: balanceAgg.value?.modelCount ?? 0
  }))

  // ── 单模型场景专用数据 ──
  const isSingleModel = computed(() => enabledModels.value.length === 1)

  const singleModel = computed<ModelConfig | null>(() =>
    isSingleModel.value ? enabledModels.value[0] : null
  )

  const singleModelUsage = computed<ModelUsageStatus | null>(() =>
    singleModel.value ? store.modelUsageMap[singleModel.value.id] : null
  )

  const singleModelSummary = computed<SingleModelSummary | null>(() => {
    const model = singleModel.value
    const usage = singleModelUsage.value
    if (!model || !usage) return null

    const providerLabels: Record<string, string> = {
      mimo: 'MIMO',
      openai: 'OpenAI',
      claude: 'Claude',
      deepseek: 'DeepSeek',
      kimi: 'Kimi',
      opencode: 'OpenCode'
    }
    const subtitle = providerLabels[model.provider] || model.provider

    if (usage.usageType === 'token') {
      const total = usage.total || 0
      const used = usage.used || 0
      const percent = total > 0 ? (used / total) * 100 : 0
      const expiry = usage.currentPeriodEnd ? usage.currentPeriodEnd.slice(0, 10) : ''
      return {
        type: 'token',
        model,
        usage,
        title: model.name,
        subtitle: usage.planName || subtitle,
        primaryValue: percent,
        primaryLabel: `${percent.toFixed(1)}%`,
        secondaryText: expiry ? `到期 ${expiry}` : '',
        tiers: []
      }
    }

    if (usage.usageType === 'percent') {
      const tiers = usage.tiers || []
      const worst = pickWorstTier(tiers)
      const resetText = worst?.resetAt
        ? `${worst.label} 窗口 ${formatResetTimeShort(worst.resetAt)}后重置`
        : ''
      return {
        type: 'percent',
        model,
        usage,
        title: model.name,
        subtitle: usage.planName || subtitle,
        primaryValue: worst?.percent ?? 0,
        primaryLabel: worst ? `${worst.label} ${worst.percent.toFixed(1)}%` : '—',
        secondaryText: resetText,
        tiers
      }
    }

    if (usage.usageType === 'balance') {
      return {
        type: 'balance',
        model,
        usage,
        title: model.name,
        subtitle: subtitle,
        primaryValue: usage.balance || 0,
        primaryLabel: `${usage.currency === 'CNY' ? '¥' : usage.currency || ''}${(usage.balance || 0).toFixed(2)}`,
        secondaryText: '',
        tiers: []
      }
    }

    return null
  })

  return {
    enabledModels,
    tokenModels,
    percentModels,
    balanceModels,
    tokenAgg,
    percentAgg,
    balanceAgg,
    unifiedTokenPool,
    mainRing,
    hasAnyData,
    typeCounts,
    isSingleModel,
    singleModel,
    singleModelUsage,
    singleModelSummary
  }
}
