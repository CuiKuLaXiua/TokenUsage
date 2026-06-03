import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import type { UsageTier } from '@/stores/app'

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
  source: 'unified' | 'token' | 'percent' | 'none'
}

/** 时间窗口优先级：数字越大表示窗口越长 */
const TIER_PRIORITY: Record<string, number> = {
  thirty_day: 3,
  seven_day: 2,
  five_hour: 1
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

export function useUsageAggregation() {
  const store = useAppStore()

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

    const tierMap = new Map<string, { label: string; used: number; total: number; remaining: number }>()

    for (const m of percentModels.value) {
      const u = store.modelUsageMap[m.id]
      if (!u.tiers) continue
      for (const t of u.tiers) {
        const existing = tierMap.get(t.name)
        if (existing) {
          existing.used += t.used ?? 0
          existing.total += t.total ?? 0
          existing.remaining += t.remaining ?? 0
        } else {
          tierMap.set(t.name, {
            label: t.label,
            used: t.used ?? 0,
            total: t.total ?? 0,
            remaining: t.remaining ?? 0
          })
        }
      }
    }

    const tiers: AggregatedTier[] = []
    for (const [name, data] of tierMap) {
      const percent = data.total > 0 ? (data.used / data.total) * 100 : 0
      tiers.push({ name, label: data.label, used: data.used, total: data.total, remaining: data.remaining, percent })
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
      // 有 token 型或 percent 型数据 → 显示统一 token 池使用率
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

    // 只有 balance 型或完全没有数据
    if (balanceAgg.value && balanceAgg.value.modelCount > 0) {
      return { percent: 0, label: '余额充足', source: 'none' }
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

  return {
    tokenModels,
    percentModels,
    balanceModels,
    tokenAgg,
    percentAgg,
    balanceAgg,
    unifiedTokenPool,
    mainRing,
    hasAnyData,
    typeCounts
  }
}
