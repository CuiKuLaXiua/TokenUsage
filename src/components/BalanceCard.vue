<template>
  <div class="balance-card glass-surface">
    <div class="balance-icon">
      <div class="icon-glow"></div>
      <span class="icon-symbol">💰</span>
    </div>
    <div class="balance-info">
      <div class="balance-label">{{ label }}</div>
      <div class="balance-value">
        <span class="currency">{{ currency }}</span>
        <span class="amount">{{ displayAmount }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(defineProps<{
  balance: number
  currency?: string
  label?: string
}>(), {
  currency: 'CNY',
  label: '账户余额'
})

const displayAmount = computed(() => {
  const num = Number(props.balance)
  return isNaN(num) ? '0.00' : num.toFixed(2)
})
</script>

<style scoped>
.balance-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 16px;
  animation: fadeSlideUp var(--duration-slow) var(--ease-spring) both;
}

.balance-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, var(--neon-amber) 0%, #f59e0b 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.icon-glow {
  position: absolute;
  inset: -3px;
  border-radius: 17px;
  background: linear-gradient(135deg, var(--neon-amber) 0%, #f59e0b 100%);
  opacity: 0.3;
  filter: blur(12px);
}

.icon-symbol {
  font-size: 24px;
  position: relative;
  z-index: 1;
}

.balance-info {
  flex: 1;
}

.balance-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.balance-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.currency {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-secondary);
}

.amount {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  animation: countUp 0.8s var(--ease-spring) both;
}

@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
}

@keyframes countUp {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
}
</style>
