<template>
  <div class="float-window" :data-theme="theme">
    <!-- Title bar -->
    <div class="float-titlebar">
      <span class="float-title">Token Usage</span>
      <div class="float-actions">
        <button class="float-btn" @click="refresh" :disabled="store.refreshing" title="刷新">
          <el-icon :size="14" :class="{ 'spin': store.refreshing }"><Refresh /></el-icon>
        </button>
        <button class="float-btn close" @click="close" title="关闭">
          <el-icon :size="14"><Close /></el-icon>
        </button>
      </div>
    </div>

    <!-- Summary -->
    <div class="float-summary glass-surface">
      <div class="summary-row">
        <span class="summary-label">总配额</span>
        <span class="summary-value">{{ formatTokens(totalTokens) }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">已使用</span>
        <span class="summary-value warn">{{ formatTokens(usedTokens) }}</span>
      </div>
      <div class="summary-row">
        <span class="summary-label">剩余额度</span>
        <span class="summary-value ok">{{ formatTokens(remainingTokens) }}</span>
      </div>
      <div class="summary-bar">
        <div class="summary-bar-track">
          <div class="summary-bar-fill" :style="{ width: usagePercent + '%', background: getProgressColor(usagePercent) }"></div>
        </div>
        <span class="summary-percent">{{ formatPercent(usagePercent) }}%</span>
      </div>
    </div>

    <!-- Model list -->
    <div class="float-models">
      <div v-if="store.models.length === 0" class="float-empty">
        <span>暂无配置的模型</span>
      </div>
      <div v-else class="model-list">
        <div v-for="model in store.models" :key="model.id" class="model-row">
          <div class="model-row-header">
            <span class="model-row-name">{{ model.name }}</span>
            <span class="model-row-badge" :class="model.provider">{{ model.provider }}</span>
          </div>
          <template v-if="store.modelUsageMap[model.id]">
            <!-- 多层级额度 -->
            <template v-if="store.modelUsageMap[model.id].tiers?.length">
              <div v-for="tier in store.modelUsageMap[model.id].tiers" :key="tier.name" class="model-tier-row">
                <div class="model-tier-header">
                  <span class="model-tier-name">{{ tier.label }}</span>
                  <span class="model-tier-percent">{{ formatPercent(tier.percent) }}%</span>
                </div>
                <div class="model-tier-bar">
                  <div class="model-tier-track">
                    <div
                      class="model-tier-fill"
                      :style="{
                        width: tier.percent + '%',
                        background: getProgressColor(tier.percent)
                      }"
                    ></div>
                  </div>
                </div>
                <div class="model-tier-detail">
                  <span>{{ formatTokens(tier.used) }} / {{ formatTokens(tier.total) }}</span>
                  <span class="model-tier-remaining">余 {{ formatTokens(tier.remaining) }}</span>
                </div>
              </div>
            </template>
            <!-- 单层级额度 -->
            <template v-else>
              <div class="model-row-bar">
                <div class="model-bar-track">
                  <div
                    class="model-bar-fill"
                    :style="{
                      width: store.modelUsageMap[model.id].percent + '%',
                      background: getProgressColor(store.modelUsageMap[model.id].percent)
                    }"
                  ></div>
                </div>
                <span class="model-bar-percent">{{ formatPercent(store.modelUsageMap[model.id].percent) }}%</span>
              </div>
              <div class="model-row-detail">
                <span>{{ formatTokens(store.modelUsageMap[model.id].used) }} / {{ formatTokens(store.modelUsageMap[model.id].total) }}</span>
                <span class="model-remaining">余 {{ formatTokens(store.modelUsageMap[model.id].remaining) }}</span>
              </div>
            </template>
          </template>
          <template v-else>
            <button
              class="float-fetch-btn"
              @click="fetchModel(model)"
              :disabled="store.fetching[model.id]"
            >
              {{ store.fetching[model.id] ? '获取中...' : '获取额度' }}
            </button>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { Refresh, Close } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import type { ModelConfig } from '@/stores/app'
import { formatTokens, formatPercent, getProgressColor } from '@/utils/format'

const store = useAppStore()
const theme = ref('light')

const totalTokens = computed(() => Object.values(store.modelUsageMap).reduce((sum, u) => sum + u.total, 0))
const usedTokens = computed(() => Object.values(store.modelUsageMap).reduce((sum, u) => sum + u.used, 0))
const remainingTokens = computed(() => Object.values(store.modelUsageMap).reduce((sum, u) => sum + u.remaining, 0))
const usagePercent = computed(() => {
  if (totalTokens.value === 0) return 0
  return Math.round((usedTokens.value / totalTokens.value) * 10000) / 100
})

async function refresh() {
  await store.refreshAll()
}

async function fetchModel(model: ModelConfig) {
  await store.fetchModelUsage(model)
}

function close() {
  window.electronAPI.closeFloatWindow()
}

onMounted(async () => {
  const saved = localStorage.getItem('theme')
  if (saved) theme.value = saved
  try {
    await store.loadConfig()
    await store.refreshAll()
  } catch (e) {
    console.error('Float window load error:', e)
  }
})
</script>

<style scoped>
.float-window {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-primary);
  overflow: hidden;
  user-select: none;
}

/* ── Title bar ── */
.float-titlebar {
  -webkit-app-region: drag;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: var(--header-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: 1px solid var(--border-light);
}

.float-title {
  font-size: 13px;
  font-weight: 700;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.float-actions {
  -webkit-app-region: no-drag;
  display: flex;
  gap: 4px;
}

.float-btn {
  width: 26px;
  height: 26px;
  border-radius: 6px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-smooth);
}

.float-btn:hover {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
}

.float-btn.close:hover {
  background: rgba(248, 113, 113, 0.15);
  color: #f87171;
  border-color: rgba(248, 113, 113, 0.3);
}

/* ── Summary ── */
.float-summary {
  margin: 10px 10px 0;
  padding: 14px;
  border-radius: 12px;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 3px 0;
}

.summary-label {
  font-size: 12px;
  color: var(--text-secondary);
}

.summary-value {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.summary-value.warn { color: var(--warning); }
.summary-value.ok { color: var(--success); }

.summary-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.summary-bar-track {
  flex: 1;
  height: 5px;
  border-radius: 3px;
  background: var(--border-light);
  overflow: hidden;
}

.summary-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: width 0.8s var(--ease-spring);
}

.summary-percent {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 32px;
  text-align: right;
}

/* ── Model list ── */
.float-models {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
}

.float-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100px;
  font-size: 13px;
  color: var(--text-placeholder);
}

.model-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.model-row {
  padding: 12px;
  border-radius: 10px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}

.model-row-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.model-row-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.model-row-badge {
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

.model-row-badge.openai { background: rgba(16, 163, 127, 0.12); color: #10a37f; border-color: rgba(16, 163, 127, 0.2); }
.model-row-badge.claude { background: rgba(204, 132, 63, 0.12); color: #cc843f; border-color: rgba(204, 132, 63, 0.2); }
.model-row-badge.deepseek { background: rgba(59, 130, 246, 0.12); color: #3b82f6; border-color: rgba(59, 130, 246, 0.2); }
.model-row-badge.kimi { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; border-color: rgba(139, 92, 246, 0.2); }
.model-row-badge.mimo { background: rgba(255, 107, 0, 0.12); color: #ff6b00; border-color: rgba(255, 107, 0, 0.2); }

.model-row-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.model-bar-track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--border-light);
  overflow: hidden;
}

.model-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s var(--ease-spring);
}

.model-bar-percent {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 32px;
  text-align: right;
}

.model-row-detail {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--text-secondary);
}

.model-remaining {
  color: var(--success);
  font-weight: 600;
}

/* ── Tier rows in float window ── */
.model-tier-row {
  margin-bottom: 6px;
}

.model-tier-row:last-child {
  margin-bottom: 0;
}

.model-tier-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 3px;
}

.model-tier-name {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--glass-bg);
  border: 1px solid var(--border-light);
  border-radius: 4px;
  padding: 1px 6px;
}

.model-tier-percent {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-secondary);
  min-width: 32px;
  text-align: right;
}

.model-tier-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}

.model-tier-track {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--border-light);
  overflow: hidden;
}

.model-tier-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.8s var(--ease-spring);
}

.model-tier-detail {
  display: flex;
  justify-content: space-between;
  font-size: 10px;
  color: var(--text-secondary);
}

.model-tier-remaining {
  color: var(--success);
  font-weight: 600;
}

.float-fetch-btn {
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

.float-fetch-btn:hover:not(:disabled) {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
}

.float-fetch-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Spin ── */
.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
