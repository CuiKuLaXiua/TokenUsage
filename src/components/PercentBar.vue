<template>
  <div class="percent-bar">
    <div v-for="tier in tiers" :key="tier.name" class="bar-tier glass-surface">
      <div class="tier-header">
        <div class="tier-badge">
          <span class="tier-label">{{ tier.label }}</span>
        </div>
        <!-- 重置时间（右上角） -->
        <span v-if="tier.resetAt" class="tier-reset">
          <el-icon :size="10"><Clock /></el-icon>
          {{ formatResetTime(tier.resetAt) }}
        </span>
      </div>

      <div class="tier-track-row">
        <div class="tier-track">
          <div
            class="tier-fill"
            :style="{
              width: tier.percent + '%',
              background: `linear-gradient(90deg, ${getColor(tier.percent)}, ${getColor(tier.percent)}88)`
            }"
          >
            <div class="tier-glow" :style="{ background: getColor(tier.percent) }"></div>
            <div class="tier-shine"></div>
          </div>
        </div>
        <!-- 百分比（进度条右侧） -->
        <span class="tier-percent" :style="{ color: getColor(tier.percent) }">
          {{ tier.percent.toFixed(1) }}%
        </span>
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
}>(), {
  showDetail: true
})

function getColor(percent: number): string {
  if (percent >= 90) return 'var(--neon-red)'
  if (percent >= 70) return 'var(--neon-amber)'
  return 'var(--neon-green)'
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
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.bar-tier {
  padding: 14px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
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

.tier-percent {
  font-size: 16px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 50px;
  text-align: right;
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

.tier-fill {
  height: 100%;
  border-radius: 5px;
  position: relative;
  transition: width 1.2s var(--ease-spring);
  animation: barFill 1.5s var(--ease-spring) both;
}

.tier-glow {
  position: absolute;
  inset: -3px;
  border-radius: 8px;
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

@keyframes barFill {
  from { width: 0; }
}

@keyframes shine {
  0% { left: -100%; }
  50% { left: 100%; }
  100% { left: 100%; }
}
</style>
