<template>
  <div class="percent-bar" :class="[`variant-${variant}`]">
    <div
      v-for="tier in tiers"
      :key="tier.name"
      class="bar-tier"
      :class="{ 'glass-surface': variant === 'default' || variant === 'summary' }"
    >
      <div class="tier-header">
        <div class="tier-badge">
          <span class="tier-label">{{ tier.label }}</span>
        </div>
        <!-- 重置时间（右上角） -->
        <span v-if="tier.resetAt && variant !== 'mini-tiers'" class="tier-reset">
          <el-icon :size="10"><Clock /></el-icon>
          {{ formatResetTime(tier.resetAt) }}
        </span>
      </div>

      <div class="tier-track-row">
        <div class="tier-track">
          <div
            class="tier-fill"
            :style="{
              width: '100%',
              background: 'var(--progress-gradient)',
              clipPath: `inset(0 ${safeClip(tier.percent)} 0 0)`
            }"
          >
            <div class="tier-glow"></div>
            <div class="tier-shine"></div>
          </div>
        </div>
        <!-- 百分比（进度条右侧） -->
        <span class="tier-percent">
          {{ (Number.isFinite(tier.percent) ? tier.percent : 0).toFixed(1) }}%
        </span>
      </div>

      <!-- summary / default 下的 used/total 详情 -->
      <div
        v-if="showDetail && (variant === 'default' || variant === 'summary') && tier.total && tier.total > 0"
        class="tier-detail"
      >
        <span>{{ formatFullNumber(tier.used || 0) }} / {{ formatFullNumber(tier.total || 0) }}</span>
        <span class="tier-remain">余 {{ formatFullNumber(tier.remaining || 0) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Clock } from '@element-plus/icons-vue'

interface Tier {
  name: string
  label: string
  percent: number
  used?: number
  total?: number
  remaining?: number
  resetAt?: string
}

const props = withDefaults(defineProps<{
  tiers: Tier[]
  showDetail?: boolean
  variant?: 'default' | 'mini-tiers' | 'summary'
}>(), {
  showDetail: true,
  variant: 'default'
})

/** 计算 clip-path 右侧 inset，保证 0% 时完全隐藏，NaN 时安全回退 */
function safeClip(percent: number): string {
  const p = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0
  return p === 0 ? '100%' : `calc(100% - ${p}%)`
}

function formatFullNumber(num: number): string {
  return num.toLocaleString('zh-CN')
}

function formatResetTime(timeStr: string): string {
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
        return `${days}天${remainHours}时后`
      }
      return `${days}天后`
    }
    if (hours > 0) {
      if (minutes > 0) {
        return `${hours}时${minutes}分后`
      }
      return `${hours}时后`
    }
    return `${minutes}分后`
  } catch {
    return timeStr
  }
}
</script>

<style scoped>
.percent-bar {
  display: flex;
  width: 100%;
}

/* ═══ Default / Summary variant ═══ */
.variant-default,
.variant-summary {
  flex-direction: column;
  gap: 12px;
}

.variant-summary {
  gap: 14px;
}

.bar-tier {
  padding: 14px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.variant-summary .bar-tier {
  padding: 16px;
  border-radius: 14px;
  gap: 12px;
}

.tier-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tier-badge {
  display: flex;
  align-items: center;
  gap: 10px;
}

.tier-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-primary);
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border);
  border-radius: 6px;
  padding: 4px 12px;
  letter-spacing: 0.5px;
}

.variant-summary .tier-label {
  font-size: 14px;
  padding: 5px 14px;
}

.tier-percent {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 50px;
  text-align: right;
}

.variant-summary .tier-percent {
  font-size: 18px;
  min-width: 56px;
}

.tier-track-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.tier-track {
  flex: 1;
  height: 10px;
  border-radius: 5px;
  background: var(--border-light);
  overflow: hidden;
  position: relative;
}

.variant-summary .tier-track {
  height: 12px;
  border-radius: 6px;
}

.tier-fill {
  height: 100%;
  border-radius: 5px;
  position: relative;
  transition: clip-path 1.2s var(--ease-spring);
}

.variant-summary .tier-fill {
  border-radius: 6px;
}

.tier-glow {
  position: absolute;
  inset: -3px;
  border-radius: 8px;
  background: var(--progress-gradient);
  opacity: 0.4;
  filter: blur(6px);
}

.tier-shine {
  position: absolute;
  top: 0;
  left: -100%;
  width: 100%;
  height: 100%;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
  animation: shine 2s ease-in-out infinite;
}

.tier-reset {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 11px;
  color: var(--text-placeholder);
}

.tier-detail {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-secondary);
  margin-top: -4px;
}

.tier-remain {
  color: var(--success);
  font-weight: 600;
}

/* ═══ Mini-tiers variant ═══ */
.variant-mini-tiers {
  flex-direction: row;
  align-items: stretch;
  gap: 8px;
}

.variant-mini-tiers .bar-tier {
  flex: 1 1 0;
  min-width: 0;
  padding: 0;
  background: transparent;
  border-radius: 0;
  gap: 4px;
}

.variant-mini-tiers .tier-header {
  display: none;
}

.variant-mini-tiers .tier-track-row {
  flex-direction: column;
  align-items: stretch;
  gap: 4px;
}

.variant-mini-tiers .tier-track {
  height: 4px;
  border-radius: 2px;
}

.variant-mini-tiers .tier-percent {
  font-size: 10px;
  font-weight: 700;
  min-width: auto;
  text-align: left;
  line-height: 1;
}

.variant-mini-tiers .tier-fill {
  border-radius: 2px;
}

@keyframes shine {
  0% { left: -100%; }
  50% { left: 100%; }
  100% { left: 100%; }
}
</style>
