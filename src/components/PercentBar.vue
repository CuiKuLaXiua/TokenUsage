<template>
  <div class="percent-bar">
    <div v-for="tier in tiers" :key="tier.name" class="bar-tier">
      <div class="tier-header">
        <span class="tier-label">{{ tier.label }}</span>
        <span class="tier-percent" :style="{ color: getColor(tier.percent) }">
          {{ tier.percent.toFixed(1) }}%
        </span>
      </div>
      <div class="tier-track">
        <div
          class="tier-fill"
          :style="{
            width: tier.percent + '%',
            background: getColor(tier.percent)
          }"
        >
          <div class="tier-glow" :style="{ background: getColor(tier.percent) }"></div>
        </div>
      </div>
      <div v-if="showDetail" class="tier-detail">
        <span class="tier-used">{{ formatValue(tier.used) }} / {{ formatValue(tier.total) }}</span>
        <span class="tier-remaining">余 {{ formatValue(tier.remaining) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Tier {
  name: string
  label: string
  percent: number
  used?: number
  total?: number
  remaining?: number
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

function formatValue(value?: number): string {
  if (value === undefined || value === null) return '-'
  if (value >= 1e9) return (value / 1e9).toFixed(2) + 'B'
  if (value >= 1e6) return (value / 1e6).toFixed(2) + 'M'
  if (value >= 1e3) return (value / 1e3).toFixed(2) + 'K'
  return value.toLocaleString('zh-CN')
}
</script>

<style scoped>
.percent-bar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.bar-tier {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.tier-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tier-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--glass-bg);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 2px 8px;
}

.tier-percent {
  font-size: 14px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.tier-track {
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--border-light);
  overflow: hidden;
}

.tier-fill {
  height: 100%;
  border-radius: 4px;
  position: relative;
  transition: width 1s var(--ease-spring);
  animation: barFill 1.2s var(--ease-spring) both;
}

.tier-glow {
  position: absolute;
  inset: -2px;
  border-radius: 6px;
  opacity: 0.3;
  filter: blur(4px);
}

.tier-detail {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-secondary);
}

.tier-remaining {
  color: var(--success);
  font-weight: 600;
}

@keyframes barFill {
  from { width: 0; }
}
</style>
