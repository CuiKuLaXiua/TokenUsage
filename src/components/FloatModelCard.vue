<template>
  <div class="float-model-card">
    <div class="card-header">
      <span class="model-name">{{ model.name }}</span>
      <div class="header-badges">
        <span class="provider-badge" :class="model.provider">{{
          model.provider
        }}</span>
        <span
          v-if="model.refreshInterval && model.refreshInterval > 0"
          class="refresh-timer"
        >
          <el-icon :size="10"><Timer /></el-icon>
          {{ model.refreshInterval
          }}{{
            model.refreshUnit === "second"
              ? "s"
              : model.refreshUnit === "hour"
                ? "h"
                : "m"
          }}
        </span>
      </div>
    </div>

    <template v-if="usage">
      <!-- 多层级额度 (Kimi / OpenCode / percent) -->
      <template v-if="usage.usageType === 'percent' && usage.tiers?.length">
        <div v-for="tier in usage.tiers" :key="tier.name" class="tier-row">
          <div class="tier-header">
            <span class="tier-name">{{ tier.label }}</span>
            <!-- 重置时间（右上角） -->
            <span v-if="tier.resetAt" class="tier-reset-inline">
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
                  clipPath: `inset(0 calc(100% - ${tier.percent}%) 0 0)`,
                }"
              ></div>
            </div>
            <!-- 百分比（进度条右侧） -->
            <span class="tier-percent">{{ formatPercent(tier.percent) }}%</span>
          </div>
        </div>
      </template>

      <!-- 余额 (DeepSeek / balance) -->
      <template v-else-if="usage.usageType === 'balance'">
        <div class="balance-display">
          <span class="balance-value">
            {{ usage.currency === "CNY" ? "¥" : usage.currency }}
            {{ (usage.balance || 0).toFixed(2) }}
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
                width: '100%',
                background: 'var(--progress-gradient)',
                clipPath: `inset(0 calc(100% - ${usage.percent || 0}%) 0 0)`,
              }"
            ></div>
          </div>
          <span class="token-percent"
            >{{ formatPercent(usage.percent || 0) }}%</span
          >
        </div>
        <div class="token-detail">
          <span
            >{{ formatTokens(usage.used) }} /
            {{ formatTokens(usage.total) }}</span
          >
          <span class="token-remaining"
            >余 {{ formatTokens(usage.remaining) }}</span
          >
        </div>
        <div
          v-if="usage.currentPeriodEnd || usage.enableAutoRenew !== undefined"
          class="plan-meta"
        >
          <span v-if="usage.currentPeriodEnd" class="plan-meta-item">
            到期 {{ usage.currentPeriodEnd.slice(0, 10) }}
          </span>
          <span
            v-if="usage.enableAutoRenew !== undefined"
            class="plan-meta-item"
          >
            自动续费
            <span
              class="renew-badge"
              :class="usage.enableAutoRenew ? 'renew-on' : 'renew-off'"
            >
              {{ usage.enableAutoRenew ? "ON" : "OFF" }}
            </span>
          </span>
        </div>
      </template>
    </template>

    <template v-else>
      <div v-if="store.fetching[model.id]" class="card-loading">
        <el-icon :size="14" class="spin"><Loading /></el-icon>
        <span>加载中...</span>
      </div>
      <button v-else class="fetch-btn" @click="emit('fetch')">
        获取额度
      </button>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Timer, Clock, Loading } from "@element-plus/icons-vue";
import { useAppStore } from "@/stores/app";
import type { ModelConfig } from "@/stores/app";
import { formatTokens, formatPercent, formatResetTime } from "@/utils/format";

const props = defineProps<{
  model: ModelConfig;
}>();

const emit = defineEmits<{
  fetch: [];
}>();

const store = useAppStore();
const usage = computed(() => store.modelUsageMap[props.model.id]);
</script>

<style scoped>
.float-model-card {
  width: 100%;
  padding: 2px;
  border-radius: 10px;
  transition:
    transform 0.25s var(--ease-spring),
    box-shadow 0.25s,
    background 0.25s;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  gap: 8px;
}

.model-name {
  font-size: 14px;
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
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 4px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  background: var(--glass-bg);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.provider-badge.openai {
  background: rgba(107, 158, 122, 0.12);
  color: var(--provider-openai);
  border-color: rgba(107, 158, 122, 0.2);
}
.provider-badge.claude {
  background: rgba(196, 168, 130, 0.12);
  color: var(--provider-claude);
  border-color: rgba(196, 168, 130, 0.2);
}
.provider-badge.deepseek {
  background: rgba(124, 196, 138, 0.12);
  color: var(--provider-deepseek);
  border-color: rgba(124, 196, 138, 0.2);
}
.provider-badge.kimi {
  background: rgba(184, 160, 136, 0.12);
  color: var(--provider-kimi);
  border-color: rgba(184, 160, 136, 0.2);
}
.provider-badge.mimo {
  background: rgba(212, 168, 85, 0.12);
  color: var(--provider-mimo);
  border-color: rgba(212, 168, 85, 0.2);
}
.provider-badge.opencode {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
  border-color: rgba(139, 92, 246, 0.2);
}

.refresh-timer {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
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
  transition: clip-path 0.8s var(--ease-spring);
  position: relative;
}
.token-fill::after {
  content: "";
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 12px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3));
  border-radius: 0 2px 2px 0;
  animation: shimmer 2.5s ease-in-out infinite;
}
@keyframes shimmer {
  0%,
  100% {
    opacity: 0;
  }
  50% {
    opacity: 1;
  }
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

/* Plan meta (MIMO) */
.plan-meta {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-placeholder);
  margin-top: 4px;
}

.plan-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.renew-badge {
  font-size: 9px;
  font-weight: 600;
  padding: 1px 4px;
  border-radius: 3px;
  letter-spacing: 0.5px;
}

.renew-badge.renew-on {
  background: rgba(124, 196, 138, 0.15);
  color: var(--success);
  border: 1px solid rgba(124, 196, 138, 0.3);
}

.renew-badge.renew-off {
  background: var(--glass-bg);
  color: var(--text-placeholder);
  border: 1px solid var(--border-light);
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
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--glass-bg);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 1px 6px;
}

.tier-reset-inline {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 10px;
  color: var(--text-placeholder);
  white-space: nowrap;
}

.tier-track-row {
  display: flex;
  align-items: center;
  gap: 8px;
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
  transition: clip-path 0.8s var(--ease-spring);
  position: relative;
}
.tier-fill::after {
  content: "";
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 10px;
  background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.25));
  border-radius: 0 2px 2px 0;
  animation: shimmer 2.5s ease-in-out infinite;
}

.tier-percent {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary);
  min-width: 40px;
  text-align: right;
}

/* Fetch button */
.fetch-btn {
  width: 100%;
  padding: 8px 12px;
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

.card-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: var(--text-secondary);
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
