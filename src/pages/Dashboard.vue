<template>
  <div class="dashboard">
    <!-- Hero Stats -->
    <div class="hero-section">
      <div class="hero-grid">
        <!-- Main Token Ring -->
        <div class="hero-main glass-surface">
          <div class="hero-ring-wrap">
            <TokenRing :percent="usagePercent" :size="120" :stroke="6">
              <div class="hero-ring-inner">
                <span class="hero-ring-value">{{ usagePercent.toFixed(1) }}</span>
                <span class="hero-ring-unit">%</span>
              </div>
            </TokenRing>
          </div>
          <div class="hero-stats">
            <div class="hero-stat-item">
              <span class="hero-stat-label">总配额</span>
              <span class="hero-stat-value neon-text">{{ formatLargeNumber(totalTokens) }}</span>
            </div>
            <div class="hero-divider"></div>
            <div class="hero-stat-item">
              <span class="hero-stat-label">已使用</span>
              <span class="hero-stat-value warn">{{ formatLargeNumber(usedTokens) }}</span>
            </div>
            <div class="hero-divider"></div>
            <div class="hero-stat-item">
              <span class="hero-stat-label">剩余额度</span>
              <span class="hero-stat-value ok">{{ formatLargeNumber(remainingTokens) }}</span>
            </div>
          </div>
        </div>

        <!-- Quick Stats -->
        <div class="hero-side">
          <div class="quick-stat glass-surface" style="animation-delay: 100ms">
            <div class="qs-icon" style="--glow: var(--neon-blue)">
              <el-icon :size="20"><Coin /></el-icon>
            </div>
            <div class="qs-info">
              <span class="qs-value"><CountUp :value="store.models.length" :duration="800" /></span>
              <span class="qs-label">配置模型</span>
            </div>
          </div>
          <div class="quick-stat glass-surface" style="animation-delay: 200ms">
            <div class="qs-icon" style="--glow: var(--neon-green)">
              <el-icon :size="20"><CircleCheck /></el-icon>
            </div>
            <div class="qs-info">
              <span class="qs-value"><CountUp :value="activeModels" :duration="800" /></span>
              <span class="qs-label">已获取额度</span>
            </div>
          </div>
          <div class="quick-stat glass-surface" style="animation-delay: 300ms">
            <div class="qs-icon" style="--glow: var(--neon-amber)">
              <el-icon :size="20"><Timer /></el-icon>
            </div>
            <div class="qs-info">
              <span class="qs-value">实时</span>
              <span class="qs-label">监控状态</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Models Section -->
    <div class="models-section">
      <div class="section-header">
        <div class="section-title-wrap">
          <h3 class="section-title neon-text">模型额度</h3>
          <span class="section-subtitle">实时监控各平台 Token 使用情况</span>
        </div>
        <div class="section-actions">
          <button class="btn-primary" @click="refreshAll" :disabled="store.refreshing">
            <el-icon :size="16" :class="{ 'spin': store.refreshing }"><Refresh /></el-icon>
            <span>刷新全部</span>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="store.models.length === 0" class="empty-state glass-surface">
        <div class="empty-visual">
          <div class="empty-ring"></div>
          <el-icon :size="48" class="empty-icon"><Coin /></el-icon>
        </div>
        <p class="empty-text">暂无配置的模型</p>
        <p class="empty-hint">添加模型后即可监控 Token 使用情况</p>
        <button class="btn-primary" @click="$router.push('/config')">
          <el-icon :size="16"><Plus /></el-icon>
          添加模型
        </button>
      </div>

      <!-- Model Grid -->
      <div v-else class="model-grid">
        <div
          v-for="(model, i) in store.models"
          :key="model.id"
          class="model-card glass-surface"
          :style="{ animationDelay: `${i * 80}ms` }"
        >
          <!-- Card Header -->
          <div class="card-header">
            <div class="card-title-row">
              <span class="model-name">{{ model.name }}</span>
              <span class="provider-badge" :class="model.provider">{{ getProviderLabel(model.provider) }}</span>
            </div>
            <button
              class="card-refresh"
              @click="fetchUsage(model)"
              :disabled="store.fetching[model.id]"
              title="刷新"
            >
              <el-icon :size="14" :class="{ 'spin': store.fetching[model.id] }">
                <component :is="store.fetching[model.id] ? Loading : Refresh" />
              </el-icon>
            </button>
          </div>

          <!-- Token Type -->
          <template v-if="getUsage(model.id)?.usageType === 'token'">
            <div class="card-body token-type">
              <div class="token-ring-section">
                <TokenRing :percent="getUsage(model.id)?.percent || 0" :size="90" />
              </div>
              <div class="token-details">
                <div class="detail-row">
                  <span class="detail-key">套餐</span>
                  <span class="detail-val">{{ getUsage(model.id)?.planName }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-key">已用</span>
                  <span class="detail-val">{{ formatTokens(getUsage(model.id)?.used || 0) }}</span>
                </div>
                <div class="detail-row">
                  <span class="detail-key">总计</span>
                  <span class="detail-val">{{ formatTokens(getUsage(model.id)?.total || 0) }}</span>
                </div>
                <div class="detail-row highlight">
                  <span class="detail-key">剩余</span>
                  <span class="detail-val">{{ formatTokens(getUsage(model.id)?.remaining || 0) }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Percent Type (Kimi) -->
          <template v-else-if="getUsage(model.id)?.usageType === 'percent'">
            <div class="card-body percent-type">
              <PercentBar :tiers="getUsage(model.id)?.tiers || []" />
            </div>
          </template>

          <!-- Balance Type (DeepSeek) -->
          <template v-else-if="getUsage(model.id)?.usageType === 'balance'">
            <div class="card-body balance-type">
              <BalanceCard :balance="getUsage(model.id)?.balance || 0" :currency="getUsage(model.id)?.currency || 'CNY'" />
            </div>
          </template>

          <!-- No Data -->
          <div v-else class="card-body empty-type">
            <button
              class="btn-fetch"
              @click="fetchUsage(model)"
              :disabled="store.fetching[model.id]"
            >
              <el-icon v-if="store.fetching[model.id]" :size="14" class="spin"><Loading /></el-icon>
              <span>{{ store.fetching[model.id] ? '获取中...' : '获取额度' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Coin,
  Refresh,
  Loading,
  Plus,
  CircleCheck,
  Timer
} from '@element-plus/icons-vue'
import type { ModelConfig } from '@/stores/app'
import { useAppStore } from '@/stores/app'
import { formatTokens } from '@/utils/format'
import TokenRing from '@/components/TokenRing.vue'
import PercentBar from '@/components/PercentBar.vue'
import BalanceCard from '@/components/BalanceCard.vue'
import CountUp from '@/components/CountUp.vue'

const store = useAppStore()

const totalTokens = computed(() => {
  return Object.values(store.modelUsageMap)
    .filter(u => u.usageType === 'token')
    .reduce((sum, u) => sum + (u.total || 0), 0)
})

const usedTokens = computed(() => {
  return Object.values(store.modelUsageMap)
    .filter(u => u.usageType === 'token')
    .reduce((sum, u) => sum + (u.used || 0), 0)
})

const remainingTokens = computed(() => {
  return Object.values(store.modelUsageMap)
    .filter(u => u.usageType === 'token')
    .reduce((sum, u) => sum + (u.remaining || 0), 0)
})

const usagePercent = computed(() => {
  if (totalTokens.value === 0) return 0
  return Math.round((usedTokens.value / totalTokens.value) * 10000) / 100
})

const activeModels = computed(() => {
  return Object.keys(store.modelUsageMap).length
})

function getUsage(modelId: string) {
  return store.modelUsageMap[modelId]
}

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    mimo: 'MIMO',
    openai: 'OpenAI',
    claude: 'Claude',
    deepseek: 'DeepSeek',
    kimi: 'Kimi'
  }
  return labels[provider] || provider
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + 'T'
  if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B'
  if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M'
  if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K'
  return num.toFixed(2)
}

async function fetchUsage(model: ModelConfig) {
  try {
    await store.requestRefresh(model.id)
    ElMessage.success({ message: `${model.name} 额度获取成功`, duration: 2000 })
  } catch {
    ElMessage.error({ message: '数据解析失败', duration: 2500 })
  }
}

async function refreshAll() {
  await store.requestRefreshAll()
}

onMounted(async () => {
  // 数据已在 loadConfig 时从主进程缓存获取
  // 不需要再调用 refreshAll
})
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
}

/* ═══════════════════════════════════════════════════════════
   Hero Section
   ═══════════════════════════════════════════════════════════ */
.hero-section {
  animation: fadeSlideUp var(--duration-slow) var(--ease-spring) both;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 16px;
}

.hero-main {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 20px;
  border-radius: 16px;
  position: relative;
  overflow: hidden;
}

.hero-main::before {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 300px;
  height: 300px;
  background: radial-gradient(circle, var(--accent-glow) 0%, transparent 70%);
  opacity: 0.3;
  pointer-events: none;
}

.hero-ring-wrap {
  flex-shrink: 0;
}

.hero-ring-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.hero-ring-value {
  font-size: 28px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1;
}

.hero-ring-unit {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-secondary);
}

.hero-stats {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.hero-stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.hero-stat-label {
  font-size: 13px;
  color: var(--text-secondary);
}

.hero-stat-value {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.hero-stat-value.warn {
  color: var(--neon-amber);
}

.hero-stat-value.ok {
  color: var(--neon-green);
}

.hero-divider {
  height: 1px;
  background: var(--border-light);
}

/* ── Hero Side ── */
.hero-side {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.quick-stat {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-radius: 12px;
  animation: fadeSlideUp var(--duration-slow) var(--ease-spring) both;
  transition: transform var(--duration-normal) var(--ease-spring);
}

.quick-stat:hover {
  transform: translateX(4px);
}

.qs-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--glow);
  box-shadow: 0 0 12px var(--glow);
}

.qs-info {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.qs-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
}

.qs-label {
  font-size: 11px;
  color: var(--text-secondary);
}

/* ═══════════════════════════════════════════════════════════
   Models Section
   ═══════════════════════════════════════════════════════════ */
.models-section {
  animation: fadeSlideUp var(--duration-slow) var(--ease-spring) both;
  animation-delay: 200ms;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.section-title-wrap {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.section-title {
  font-size: 20px;
  font-weight: 700;
}

.section-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 20px;
  border-radius: 10px;
  border: none;
  background: var(--accent-gradient);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-smooth);
  box-shadow: 0 2px 12px var(--accent-glow);
}

.btn-primary:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 24px var(--accent-glow);
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Empty State ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 60px 0;
  border-radius: 20px;
}

.empty-visual {
  position: relative;
  width: 100px;
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-ring {
  position: absolute;
  inset: 0;
  border: 2px dashed var(--border-color);
  border-radius: 50%;
  animation: spin 20s linear infinite;
}

.empty-icon {
  color: var(--text-placeholder);
  animation: float 3s ease-in-out infinite;
}

.empty-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-hint {
  font-size: 13px;
  color: var(--text-secondary);
}

/* ═══════════════════════════════════════════════════════════
   Model Grid
   ═══════════════════════════════════════════════════════════ */
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.model-card {
  border-radius: 16px;
  overflow: hidden;
  animation: fadeSlideUp var(--duration-slow) var(--ease-spring) both;
  transition: transform var(--duration-normal) var(--ease-spring),
              box-shadow var(--duration-normal) var(--ease-smooth);
}

.model-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--glass-shadow-hover);
}

/* ── Card Header ── */
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-light);
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.model-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.provider-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 3px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.provider-badge.mimo { background: rgba(255, 107, 0, 0.12); color: #ff6b00; }
.provider-badge.openai { background: rgba(16, 163, 127, 0.12); color: #10a37f; }
.provider-badge.claude { background: rgba(204, 132, 63, 0.12); color: #cc843f; }
.provider-badge.deepseek { background: rgba(59, 130, 246, 0.12); color: #3b82f6; }
.provider-badge.kimi { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; }

.card-refresh {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border-light);
  background: var(--glass-bg);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-smooth);
}

.card-refresh:hover {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
  border-color: var(--glass-border);
}

/* ── Card Body ── */
.card-body {
  padding: 16px;
}

/* Token Type */
.token-type {
  display: flex;
  align-items: center;
  gap: 20px;
}

.token-ring-section {
  flex-shrink: 0;
}

.token-details {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
}

.detail-key {
  color: var(--text-secondary);
}

.detail-val {
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.detail-row.highlight .detail-val {
  color: var(--neon-green);
}

/* Percent Type */
.percent-type {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Balance Type */
.balance-type {
  display: flex;
  justify-content: center;
}

/* Empty Type */
.empty-type {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 80px;
}

.btn-fetch {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  border-radius: 10px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-smooth);
}

.btn-fetch:hover:not(:disabled) {
  background: var(--glass-bg-strong);
  border-color: var(--accent);
  box-shadow: 0 0 12px var(--accent-glow);
}

.btn-fetch:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

/* ── Responsive ── */
@media (max-width: 1200px) {
  .hero-grid {
    grid-template-columns: 1fr;
  }
  
  .hero-side {
    flex-direction: row;
  }
}

@media (max-width: 768px) {
  .hero-main {
    flex-direction: column;
    text-align: center;
  }
  
  .model-grid {
    grid-template-columns: 1fr;
  }
}
</style>
