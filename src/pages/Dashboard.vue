<template>
  <div class="dashboard">
    <!-- Summary Cards -->
    <div class="summary-grid">
      <div class="summary-card glass-surface" style="animation-delay: 0ms">
        <div class="summary-icon" style="background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple))">
          <div class="icon-glow" style="background: linear-gradient(135deg, var(--neon-blue), var(--neon-purple))"></div>
          <el-icon :size="22" color="#fff"><Coin /></el-icon>
        </div>
        <div class="summary-info">
          <div class="summary-value">
            <CountUp :value="totalTokens" :decimals="2" :duration="1000" />
          </div>
          <div class="summary-label">总配额</div>
        </div>
      </div>

      <div class="summary-card glass-surface" style="animation-delay: 80ms">
        <div class="summary-icon" style="background: linear-gradient(135deg, var(--neon-pink), var(--neon-purple))">
          <div class="icon-glow" style="background: linear-gradient(135deg, var(--neon-pink), var(--neon-purple))"></div>
          <el-icon :size="22" color="#fff"><DataAnalysis /></el-icon>
        </div>
        <div class="summary-info">
          <div class="summary-value">
            <CountUp :value="usedTokens" :decimals="2" :duration="1000" />
          </div>
          <div class="summary-label">已使用</div>
        </div>
      </div>

      <div class="summary-card glass-surface" style="animation-delay: 160ms">
        <div class="summary-icon" style="background: linear-gradient(135deg, var(--neon-green), var(--neon-blue))">
          <div class="icon-glow" style="background: linear-gradient(135deg, var(--neon-green), var(--neon-blue))"></div>
          <el-icon :size="22" color="#fff"><Document /></el-icon>
        </div>
        <div class="summary-info">
          <div class="summary-value">
            <CountUp :value="remainingTokens" :decimals="2" :duration="1000" />
          </div>
          <div class="summary-label">剩余额度</div>
        </div>
      </div>

      <div class="summary-card glass-surface" style="animation-delay: 240ms">
        <div class="summary-icon" style="background: linear-gradient(135deg, var(--neon-amber), var(--neon-green))">
          <div class="icon-glow" style="background: linear-gradient(135deg, var(--neon-amber), var(--neon-green))"></div>
          <el-icon :size="22" color="#fff"><TrendCharts /></el-icon>
        </div>
        <div class="summary-info">
          <div class="summary-value">
            <CountUp :value="usagePercent" :decimals="1" suffix="%" :duration="1000" />
          </div>
          <div class="summary-label">使用率</div>
        </div>
      </div>
    </div>

    <!-- Models Section -->
    <div class="section-card glass-surface" style="animation-delay: 360ms">
      <div class="section-header">
        <h3 class="section-title neon-text">模型额度</h3>
        <button class="btn-primary" @click="refreshAll" :disabled="store.refreshing">
          <el-icon :size="16" :class="{ 'spin': store.refreshing }"><Refresh /></el-icon>
          <span>刷新全部</span>
        </button>
      </div>

      <!-- Empty State -->
      <div v-if="store.models.length === 0" class="empty-state">
        <div class="empty-icon-wrap">
          <el-icon :size="48" class="empty-float"><Coin /></el-icon>
        </div>
        <p class="empty-text">暂无配置的模型</p>
        <button class="btn-primary" @click="$router.push('/config')">添加模型</button>
      </div>

      <!-- Model Grid -->
      <div v-else class="model-grid">
        <div
          v-for="(model, i) in store.models"
          :key="model.id"
          class="model-card glass-surface"
          :style="{ animationDelay: `${400 + i * 100}ms` }"
        >
          <div class="model-header">
            <span class="model-name">{{ model.name }}</span>
            <span class="provider-badge" :class="model.provider">{{ getProviderLabel(model.provider) }}</span>
          </div>

          <!-- Token Type (MIMO) -->
          <template v-if="getUsage(model.id)?.usageType === 'token'">
            <div class="model-body">
              <TokenRing :percent="getUsage(model.id)?.percent || 0" :size="100" />
              <div class="model-stats">
                <div class="plan-name">{{ getUsage(model.id)?.planName }}</div>
                <div class="stat-row">
                  <span class="stat-key">已用</span>
                  <span class="stat-val">{{ formatTokens(getUsage(model.id)?.used || 0) }}</span>
                </div>
                <div class="stat-row">
                  <span class="stat-key">总计</span>
                  <span class="stat-val">{{ formatTokens(getUsage(model.id)?.total || 0) }}</span>
                </div>
                <div class="stat-row highlight">
                  <span class="stat-key">剩余</span>
                  <span class="stat-val">{{ formatTokens(getUsage(model.id)?.remaining || 0) }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Percent Type (Kimi) -->
          <template v-else-if="getUsage(model.id)?.usageType === 'percent'">
            <div class="model-body">
              <PercentBar :tiers="getUsage(model.id)?.tiers || []" />
            </div>
          </template>

          <!-- Balance Type (DeepSeek) -->
          <template v-else-if="getUsage(model.id)?.usageType === 'balance'">
            <div class="model-body">
              <BalanceCard :balance="getUsage(model.id)?.balance || 0" :currency="getUsage(model.id)?.currency || 'CNY'" />
            </div>
          </template>

          <!-- No Data -->
          <div v-else class="model-empty">
            <button
              class="btn-primary btn-sm"
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
import { computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Coin,
  DataAnalysis,
  Document,
  TrendCharts,
  Refresh,
  Loading
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

async function fetchUsage(model: ModelConfig) {
  const result = await store.fetchModelUsage(model)
  if (result) {
    ElMessage.success({ message: `${model.name} 额度获取成功`, duration: 2000 })
  } else {
    ElMessage.error({ message: '数据解析失败', duration: 2500 })
  }
}

async function refreshAll() {
  await store.refreshAll()
}

onMounted(async () => {
  await store.loadConfig()
  await refreshAll()
})
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ── Summary grid ── */
.summary-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 18px;
}

.summary-card {
  border-radius: 16px;
  padding: 22px;
  display: flex;
  align-items: center;
  gap: 18px;
  animation: fadeSlideUp var(--duration-slow) var(--ease-spring) both;
}

.summary-card:hover {
  transform: translateY(-4px);
}

.summary-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
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
  opacity: 0.3;
  filter: blur(12px);
  transition: opacity var(--duration-normal) var(--ease-smooth);
}

.summary-card:hover .icon-glow {
  opacity: 0.5;
}

.summary-info {
  flex: 1;
  min-width: 0;
}

.summary-value {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
  font-variant-numeric: tabular-nums;
}

.summary-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 4px;
  font-weight: 500;
}

/* ── Section card ── */
.section-card {
  border-radius: 16px;
  padding: 24px;
  animation: fadeSlideUp var(--duration-slow) var(--ease-spring) both;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.section-title {
  font-size: 17px;
  font-weight: 700;
}

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 9px 18px;
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
  transform: translateY(-1px);
  box-shadow: 0 4px 20px var(--accent-glow);
}

.btn-primary:active:not(:disabled) {
  transform: scale(0.97);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-sm {
  padding: 8px 16px;
  font-size: 12px;
  border-radius: 9px;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ── Empty state ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 48px 0;
}

.empty-icon-wrap {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  background: var(--glass-bg);
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-float {
  color: var(--text-placeholder);
  animation: float 3s ease-in-out infinite;
}

.empty-text {
  font-size: 14px;
  color: var(--text-secondary);
}

/* ── Model grid ── */
.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 18px;
}

.model-card {
  border-radius: 16px;
  padding: 22px;
  animation: fadeSlideUp var(--duration-slow) var(--ease-spring) both;
}

.model-card:hover {
  transform: translateY(-4px);
}

.model-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
}

.model-name {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.provider-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--glass-bg);
  color: var(--text-secondary);
  border: 1px solid var(--border-light);
}

.provider-badge.openai { background: rgba(16, 163, 127, 0.12); color: #10a37f; border-color: rgba(16, 163, 127, 0.2); }
.provider-badge.claude { background: rgba(204, 132, 63, 0.12); color: #cc843f; border-color: rgba(204, 132, 63, 0.2); }
.provider-badge.deepseek { background: rgba(59, 130, 246, 0.12); color: #3b82f6; border-color: rgba(59, 130, 246, 0.2); }
.provider-badge.kimi { background: rgba(139, 92, 246, 0.12); color: #8b5cf6; border-color: rgba(139, 92, 246, 0.2); }
.provider-badge.mimo { background: rgba(255, 107, 0, 0.12); color: #ff6b00; border-color: rgba(255, 107, 0, 0.2); }

/* ── Model body ── */
.model-body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 18px;
}

.model-stats {
  width: 100%;
}

.plan-name {
  text-align: center;
  font-size: 12px;
  color: var(--text-placeholder);
  margin-bottom: 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--border-light);
  font-weight: 500;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 5px 0;
  font-size: 13px;
}

.stat-key {
  color: var(--text-secondary);
  font-weight: 500;
}

.stat-val {
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.stat-row.highlight .stat-val {
  color: var(--success);
}

/* ── Model empty ── */
.model-empty {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100px;
}

/* ── Responsive ── */
@media (max-width: 900px) {
  .summary-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
