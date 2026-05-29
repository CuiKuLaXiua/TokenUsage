<template>
  <div class="float-model-card">
    <div class="card-header">
      <span class="model-name">{{ model.name }}</span>
      <div class="header-badges">
        <span class="provider-badge" :class="model.provider">{{ model.provider }}</span>
        <span v-if="model.refreshInterval && model.refreshInterval > 0" class="refresh-timer">
          <el-icon :size="10"><Timer /></el-icon>
          {{ model.refreshInterval }}m
        </span>
      </div>
    </div>

    <template v-if="usage">
      <!-- 多层级额度 (Kimi / percent) -->
      <template v-if="usage.usageType === 'percent' && usage.tiers?.length">
        <div v-for="tier in usage.tiers" :key="tier.name" class="tier-row">
          <div class="tier-header">
            <span class="tier-name">{{ tier.label }}</span>
            <span class="tier-percent">{{ formatPercent(tier.percent) }}%</span>
          </div>
          <div class="tier-bar">
            <div class="tier-track">
              <div
                class="tier-fill"
                :style="{
                  width: tier.percent + '%',
                  background: getProgressColor(tier.percent)
                }"
              ></div>
            </div>
          </div>
          <div class="tier-detail">
            <span>{{ formatTokens(tier.used) }} / {{ formatTokens(tier.total) }}</span>
            <span class="tier-remaining">余 {{ formatTokens(tier.remaining) }}</span>
          </div>
          <div v-if="tier.resetAt" class="tier-reset">
            <el-icon :size="10"><Clock /></el-icon>
            <span>{{ formatResetTime(tier.resetAt) }}</span>
          </div>
        </div>
      </template>

      <!-- 余额 (DeepSeek / balance) -->
      <template v-else-if="usage.usageType === 'balance'">
        <div class="balance-display">
          <span class="balance-value">
            {{ usage.currency === 'CNY' ? '¥' : usage.currency }} {{ (usage.balance || 0).toFixed(2) }}
          </span>
        </div>
      </template>

      <!-- 单层级额度 (MIMO / OpenAI / Claude / token) -->
      <template v-else>
        <div class="token-bar">
          <div class="token-track">
            <div
              class="token-fill"
              :style="{
                width: (usage.percent || 0) + '%',
                background: getProgressColor(usage.percent)
              }"
            ></div>
          </div>
          <span class="token-percent">{{ formatPercent(usage.percent || 0) }}%</span>
        </div>
        <div class="token-detail">
          <span>{{ formatTokens(usage.used) }} / {{ formatTokens(usage.total) }}</span>
          <span class="token-remaining">余 {{ formatTokens(usage.remaining) }}</span>
        </div>
      </template>
    </template>

    <template v-else>
      <button class="fetch-btn" @click="emit('fetch')" :disabled="store.fetching[model.id]">
        {{ store.fetching[model.id] ? '获取中...' : '获取额度' }}
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Timer, Clock } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import type { ModelConfig } from '@/stores/app'
import { formatTokens, formatPercent, getProgressColor, formatResetTime } from '@/utils/format'

const props = defineProps<{
  model: ModelConfig
}>()

const emit = defineEmits<{
  fetch: []
}>()

const store = useAppStore()
const usage = computed(() => store.modelUsageMap[props.model.id])
</script>

<style scoped>
.float-model-card {
  width: 100%;
  padding: 2px;
  border-radius: 10px;
  transition: transform 0.25s var(--ease-spring), box-shadow 0.25s, background 0.25s;
}
.float-model-card:hover {
  transform: translateY(-1px);
  background: var(--glass-bg);
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.model-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.header-badges {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.provider-badge {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: var(--glass-bg);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.provider-badge.openai { background: rgba(16, 163, 127, 0.12); color: #10a37f; border-color: rgba(16, 163, 127, 0.2); }
.provider-badge.claude { background: rgba(204, 132, 63, 0.12); color: #cc843f; border-color: rgba(204, 132, 63, 0.2); }
.provider-badge.deepseek { background: rgba(59, 130, 246, 0.12); color: #3b82f6; border-color: rgba(59, 130, 246, 0.2); }
.provider-badge.kimi { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; border-color: rgba(139, 92, 246, 0.2); }
.provider-badge.mimo { background: rgba(255, 107, 0, 0.12); color: #ff6b00; border-color: rgba(255, 107, 0, 0.2); }

.refresh-timer {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 9px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-glow);
  padding: 1px 6px;
  border-radius: 4px;
}

/* Token bar */
.token-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.token-track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--border-light);
  overflow: hidden;
}

.token-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s var(--ease-spring);
  position: relative;
}
.token-fill::after {
  content: '';
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 12px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3));
  border-radius: 0 2px 2px 0;
  animation: shimmer 2s ease-in-out infinite;
}
@keyframes shimmer {
  0%, 100% { opacity: 0; }
  50% { opacity: 1; }
}

.token-percent {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 32px;
  text-align: right;
}

.token-detail {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-secondary);
}

.token-remaining {
  color: var(--success);
  font-weight: 600;
}

/* Balance */
.balance-display {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px 0;
}

.balance-value {
  font-size: 22px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* Tier rows */
.tier-row {
  margin-bottom: 6px;
}

.tier-row:last-child {
  margin-bottom: 0;
}

.tier-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
}

.tier-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--glass-bg);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 1px 6px;
}

.tier-percent {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 32px;
  text-align: right;
}

.tier-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.tier-track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--border-light);
  overflow: hidden;
}

.tier-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s var(--ease-spring);
  position: relative;
}
.tier-fill::after {
  content: '';
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 10px;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.25));
  border-radius: 0 2px 2px 0;
  animation: shimmer 2.5s ease-in-out infinite;
}

.tier-detail {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-secondary);
}

.tier-remaining {
  color: var(--success);
  font-weight: 600;
}

.tier-reset {
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 9px;
  color: var(--text-placeholder);
  margin-top: 2px;
}

/* Fetch button */
.fetch-btn {
  width: 100%;
  padding: 6px;
  border-radius: 6px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-secondary);
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-smooth);
}

.fetch-btn:hover:not(:disabled) {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
}

.fetch-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
