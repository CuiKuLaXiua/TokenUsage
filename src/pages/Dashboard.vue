<template>
  <div class="dashboard" :class="{ 'first-mount': firstMount }">
    <!-- Hero Stats -->
    <div class="hero-section">
      <div class="hero-grid">
        <!-- Main Token Ring -->
        <div class="hero-main glass-surface">
          <div class="hero-ring-wrap">
            <TokenRing
              :percent="agg.mainRing.value.percent"
              :size="120"
              :stroke="6"
            >
              <div class="hero-ring-inner">
                <span class="hero-ring-value">
                  {{
                    agg.mainRing.value.source !== "none"
                      ? agg.mainRing.value.percent.toFixed(1)
                      : "—"
                  }}
                </span>
                <span class="hero-ring-unit">{{
                  agg.mainRing.value.source !== "none" ? "%" : ""
                }}</span>
              </div>
            </TokenRing>
          </div>
          <div class="hero-stats">
            <!-- 主环标注 -->
            <div class="hero-alert" v-if="agg.mainRing.value.source !== 'none'">
              <span class="hero-alert-dot unified"></span>
              <span class="hero-alert-text">{{
                agg.mainRing.value.label
              }}</span>
              <span
                class="hero-alert-sub"
                v-if="agg.unifiedTokenPool.value.total > 0"
              >
                {{ formatLargeNumber(agg.unifiedTokenPool.value.used) }} /
                {{ formatLargeNumber(agg.unifiedTokenPool.value.total) }}
              </span>
            </div>
            <div class="hero-alert ok" v-else-if="agg.hasAnyData.value">
              <span class="hero-alert-dot ok"></span>
              <span class="hero-alert-text">{{
                agg.mainRing.value.label
              }}</span>
            </div>

            <!-- Token 汇总行 -->
            <template v-if="agg.tokenAgg.value">
              <div class="hero-divider"></div>
              <div class="hero-stat-item">
                <span class="hero-stat-label">总配额</span>
                <span class="hero-stat-value accent-text">{{
                  formatLargeNumber(agg.tokenAgg.value.total)
                }}</span>
              </div>
              <div class="hero-stat-item">
                <span class="hero-stat-label">已使用</span>
                <span class="hero-stat-value warn">{{
                  formatLargeNumber(agg.tokenAgg.value.used)
                }}</span>
              </div>
              <div class="hero-stat-item">
                <span class="hero-stat-label">剩余</span>
                <span class="hero-stat-value ok">{{
                  formatLargeNumber(agg.tokenAgg.value.remaining)
                }}</span>
              </div>
            </template>

            <!-- Balance 汇总行 -->
            <template v-if="agg.balanceAgg.value">
              <div class="hero-divider"></div>
              <div class="hero-stat-item">
                <span class="hero-stat-label">账户余额</span>
                <span class="hero-stat-value accent-text">
                  {{
                    agg.balanceAgg.value.currency === "CNY"
                      ? "¥"
                      : agg.balanceAgg.value.currency
                  }}
                  {{ agg.balanceAgg.value.totalBalance.toFixed(2) }}
                </span>
              </div>
            </template>

            <!-- 无数据 -->
            <div v-if="!agg.hasAnyData.value" class="hero-stat-empty">
              <span class="hero-stat-label">点击下方模型卡获取额度</span>
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
              <span class="qs-value"
                ><CountUp :value="store.models.length" :duration="800"
              /></span>
              <span class="qs-label">配置模型</span>
            </div>
          </div>
          <div class="quick-stat glass-surface" style="animation-delay: 200ms">
            <div class="qs-icon" style="--glow: var(--neon-green)">
              <el-icon :size="20"><CircleCheck /></el-icon>
            </div>
            <div class="qs-info">
              <span class="qs-value">
                <CountUp :value="activeModels" :duration="800" />
              </span>
              <span class="qs-label">已获取额度</span>
            </div>
          </div>
          <div class="quick-stat glass-surface" style="animation-delay: 300ms">
            <div class="qs-icon" style="--glow: var(--neon-amber)">
              <el-icon :size="20"><DataBoard /></el-icon>
            </div>
            <div class="qs-info">
              <span class="qs-value qs-type-counts">
                <span class="qs-tag t">{{ agg.typeCounts.value.token }}</span>
                <span class="qs-tag p">{{ agg.typeCounts.value.percent }}</span>
                <span class="qs-tag b">{{ agg.typeCounts.value.balance }}</span>
              </span>
              <span class="qs-label">Token / 窗口 / 余额</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Type Summary Cards -->
      <div class="type-summary" v-show="agg.hasAnyData.value">
        <!-- Token 汇总卡 -->
        <div v-if="agg.tokenAgg.value" class="type-card glass-surface">
          <div class="tc-header">
            <span class="tc-title">📦 Token 额度</span>
            <span class="tc-count"
              >{{ agg.tokenAgg.value.modelCount }} 个模型</span
            >
          </div>
          <div class="tc-bar-track">
            <div
              class="tc-bar-fill"
              :style="{
                width: '100%',
                background: 'var(--progress-gradient)',
                clipPath: `inset(0 calc(100% - ${Math.min(100, agg.tokenAgg.value.percent)}%) 0 0)`,
              }"
            ></div>
          </div>
          <div class="tc-meta">
            <span
              >{{ formatLargeNumber(agg.tokenAgg.value.used) }} /
              {{ formatLargeNumber(agg.tokenAgg.value.total) }}</span
            >
            <span class="tc-pct"
              >{{ agg.tokenAgg.value.percent.toFixed(1) }}%</span
            >
          </div>
        </div>

        <!-- 时间窗口汇总卡 -->
        <div v-if="agg.percentAgg.value" class="type-card glass-surface">
          <div class="tc-header">
            <span class="tc-title">⏱ 时间窗口</span>
            <span class="tc-count"
              >{{ agg.percentAgg.value.modelCount }} 个模型</span
            >
          </div>
          <div class="tc-bar-track">
            <div
              class="tc-bar-fill"
              :style="{
                width: '100%',
                background: 'var(--progress-gradient)',
                clipPath: `inset(0 calc(100% - ${Math.min(100, agg.percentAgg.value.worstPercent)}%) 0 0)`,
              }"
            ></div>
          </div>
          <div class="tc-meta">
            <span>最紧张: {{ agg.percentAgg.value.worstLabel }}</span>
            <span class="tc-pct"
              >{{ agg.percentAgg.value.worstPercent.toFixed(1) }}%</span
            >
          </div>
        </div>

        <!-- 余额汇总卡 -->
        <div v-if="agg.balanceAgg.value" class="type-card glass-surface">
          <div class="tc-header">
            <span class="tc-title">💰 账户余额</span>
            <span class="tc-count"
              >{{ agg.balanceAgg.value.modelCount }} 个模型</span
            >
          </div>
          <div class="tc-balance">
            <span class="tc-currency">{{
              agg.balanceAgg.value.currency === "CNY"
                ? "¥"
                : agg.balanceAgg.value.currency
            }}</span>
            <span class="tc-amount">{{
              agg.balanceAgg.value.totalBalance.toFixed(2)
            }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Models Section -->
    <div class="models-section">
      <div class="section-header">
        <div class="section-title-wrap">
          <h3 class="section-title accent-text">模型额度</h3>
          <span class="section-subtitle">实时监控各平台 Token 使用情况</span>
        </div>
        <div class="section-actions">
          <button
            class="btn-primary"
            @click="refreshAll"
            :disabled="store.refreshing"
          >
            <el-icon :size="16" :class="{ spin: store.refreshing }"
              ><Refresh
            /></el-icon>
            <span>刷新全部</span>
          </button>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="enabledModels.length === 0" class="empty-state glass-surface">
        <div class="empty-visual">
          <div class="empty-ring"></div>
          <el-icon :size="48" class="empty-icon"><Coin /></el-icon>
        </div>
        <p class="empty-text">{{ store.models.length === 0 ? '暂无配置的模型' : '暂无启用的模型' }}</p>
        <p class="empty-hint">{{ store.models.length === 0 ? '添加模型后即可监控 Token 使用情况' : '请在配置管理中启用模型' }}</p>
        <button class="btn-primary" @click="$router.push('/config')">
          <el-icon :size="16"><Plus /></el-icon>
          添加模型
        </button>
      </div>

      <!-- Model Grid -->
      <draggable
        v-else
        v-model="store.models"
        item-key="id"
        tag="div"
        class="model-grid"
        ghost-class="card-ghost"
        drag-class="card-drag"
        :force-fallback="true"
        :animation="0"
        @end="onDragEnd"
      >
        <template #item="{ element: model }">
          <div v-show="model.enabled" class="model-card glass-surface">
            <!-- Card Header -->
            <div class="card-header">
              <div class="card-title-row">
                <span class="model-name">{{ model.name }}</span>
                <span class="provider-badge" :class="model.provider">{{
                  getProviderLabel(model.provider)
                }}</span>
              </div>
                <button
                  class="card-refresh"
                  @click="fetchUsage(model)"
                  :disabled="store.fetching[model.id]"
                  title="刷新"
                >
                  <el-icon :size="14" :class="{ spin: store.fetching[model.id] }">
                    <component :is="store.fetching[model.id] ? Loading : Refresh" />
                  </el-icon>
                </button>
              </div>

              <!-- Token Type -->
              <template v-if="getUsage(model.id)?.usageType === 'token'">
                <div class="card-body token-type">
                  <div class="token-ring-section">
                    <TokenRing
                      :percent="getUsage(model.id)?.percent || 0"
                      :size="90"
                    />
                  </div>
                  <div class="token-details">
                    <div class="detail-row">
                      <span class="detail-key">套餐</span>
                      <span class="detail-val">{{
                        getUsage(model.id)?.planName
                      }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-key">已用</span>
                      <span class="detail-val">{{
                        formatFullNumber(getUsage(model.id)?.used || 0)
                      }}</span>
                    </div>
                    <div class="detail-row">
                      <span class="detail-key">总计</span>
                      <span class="detail-val">{{
                        formatFullNumber(getUsage(model.id)?.total || 0)
                      }}</span>
                    </div>
                    <div class="detail-row highlight">
                      <span class="detail-key">剩余</span>
                      <span class="detail-val">{{
                        formatFullNumber(getUsage(model.id)?.remaining || 0)
                      }}</span>
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
                  <BalanceCard
                    :balance="getUsage(model.id)?.balance || 0"
                    :currency="getUsage(model.id)?.currency || 'CNY'"
                  />
                </div>
              </template>

              <!-- No Data -->
              <div v-else class="card-body empty-type">
                <button
                  class="btn-fetch"
                  @click="fetchUsage(model)"
                  :disabled="store.fetching[model.id]"
                >
                  <el-icon v-if="store.fetching[model.id]" :size="14" class="spin"
                    ><Loading
                  /></el-icon>
                  <span>{{
                    store.fetching[model.id] ? "获取中..." : "获取额度"
                  }}</span>
                </button>
              </div>
            </div>
        </template>
      </draggable>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, onMounted } from "vue";
import { ElMessage } from "element-plus";
import {
  Coin,
  Refresh,
  Loading,
  Plus,
  CircleCheck,
  DataBoard,
} from "@element-plus/icons-vue";
import type { ModelConfig } from "@/stores/app";
import { useAppStore } from "@/stores/app";
import { formatTokens } from "@/utils/format";
import { useUsageAggregation } from "@/composables/useUsageAggregation";
import draggable from "vuedraggable";
import TokenRing from "@/components/TokenRing.vue";
import PercentBar from "@/components/PercentBar.vue";
import BalanceCard from "@/components/BalanceCard.vue";
import CountUp from "@/components/CountUp.vue";

const store = useAppStore();
const agg = useUsageAggregation();

const firstMount = ref(true);
onMounted(() => {
  requestAnimationFrame(() => {
    firstMount.value = false;
  });
});

const activeModels = computed(() => {
  return Object.keys(store.modelUsageMap).length;
});

const enabledModels = computed(() => {
  return store.models.filter(m => m.enabled);
});

function getUsage(modelId: string) {
  return store.modelUsageMap[modelId];
}

function getProviderLabel(provider: string): string {
  const labels: Record<string, string> = {
    mimo: "MIMO",
    openai: "OpenAI",
    claude: "Claude",
    deepseek: "DeepSeek",
    kimi: "Kimi",
    opencode: "OpenCode",
  };
  return labels[provider] || provider;
}

function formatLargeNumber(num: number): string {
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(2);
}

function formatFullNumber(num: number): string {
  return num.toLocaleString("zh-CN");
}

// ── 拖拽排序 ──
function onDragEnd() {
  store.saveConfig();
}

async function fetchUsage(model: ModelConfig) {
  try {
    await store.requestRefresh(model.id);
    ElMessage.success({
      message: `${model.name} 额度获取成功`,
      duration: 2000,
    });
  } catch {
    ElMessage.error({ message: "数据解析失败", duration: 2500 });
  }
}

async function refreshAll() {
  await store.requestRefreshAll();
}
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 0;
  width: 100%;
}

/* ═══════════════════════════════════════════════════════════
   Hero Section
   ═══════════════════════════════════════════════════════════ */
.hero-section {
  opacity: 1;
}

.first-mount .hero-section {
  animation: fadeSlideUp var(--duration-slow) var(--ease-smooth) both;
}

.hero-grid {
  display: grid;
  grid-template-columns: 1fr 240px;
  gap: 16px;
  min-width: 0; /* 防止 grid 溢出 */
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
  content: "";
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
  gap: 7px;
}

.hero-alert {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--glass-bg);
  border: 1px solid var(--border-light);
}

.hero-alert-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.hero-alert-dot.token {
  background: var(--neon-amber);
  box-shadow: 0 0 6px var(--neon-amber);
}

.hero-alert-dot.percent {
  background: var(--neon-red);
  box-shadow: 0 0 6px var(--neon-red);
}

.hero-alert-dot.unified {
  background: var(--accent);
  box-shadow: 0 0 6px var(--accent);
}

.hero-alert-dot.ok {
  background: var(--neon-green);
  box-shadow: 0 0 6px var(--neon-green);
}

.hero-alert-text {
  font-size: 13px;
  color: var(--text-primary);
  font-weight: 600;
}

.hero-alert-sub {
  font-size: 11px;
  color: var(--text-secondary);
  margin-left: auto;
  font-variant-numeric: tabular-nums;
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

.hero-stat-empty {
  display: flex;
  justify-content: center;
  padding: 10px 0;
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
  animation: fadeSlideUp var(--duration-slow) var(--ease-smooth) both;
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
  gap: 2px;
  min-height: 40px;
  justify-content: center;
}

.qs-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  line-height: 1.2;
}

.qs-type-counts {
  display: flex;
  gap: 6px;
  align-items: center;
}

.qs-tag {
  font-size: 13px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 5px;
  line-height: 1.2;
}

.qs-tag.t {
  color: var(--neon-amber);
  background: rgba(251, 191, 36, 0.12);
}
.qs-tag.p {
  color: var(--neon-red);
  background: rgba(248, 113, 113, 0.12);
}
.qs-tag.b {
  color: var(--neon-green);
  background: rgba(34, 211, 238, 0.12);
}

.qs-label {
  font-size: 11px;
  color: var(--text-secondary);
  line-height: 1.2;
}

/* ═══════════════════════════════════════════════════════════
   Type Summary Cards
   ═══════════════════════════════════════════════════════════ */
.type-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 14px;
  animation: fadeSlideUp var(--duration-slow) var(--ease-smooth) both;
  animation-delay: 100ms;
}

.type-card {
  padding: 14px 16px;
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  transition:
    transform var(--duration-normal) var(--ease-spring),
    box-shadow var(--duration-normal) var(--ease-smooth);
}

.type-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--glass-shadow-hover);
}

.tc-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.tc-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
}

.tc-count {
  font-size: 11px;
  color: var(--text-secondary);
}

.tc-bar-track {
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: var(--border-light);
  overflow: hidden;
}

.tc-bar-fill {
  height: 100%;
  border-radius: 3px;
  transition: clip-path 1.2s var(--ease-spring);
}

.tc-meta {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--text-secondary);
  font-variant-numeric: tabular-nums;
}

.tc-pct {
  font-weight: 700;
  color: var(--text-primary);
}

.tc-balance {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.tc-currency {
  font-size: 18px;
  font-weight: 500;
  color: var(--text-secondary);
}

.tc-amount {
  font-size: 26px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

/* ═══════════════════════════════════════════════════════════
   Models Section
   ═══════════════════════════════════════════════════════════ */
.models-section {
  animation: fadeSlideUp var(--duration-slow) var(--ease-smooth) both;
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
  to {
    transform: rotate(360deg);
  }
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
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 12px;
  min-width: 0;
}

.model-card {
  border-radius: 16px;
  overflow: hidden;
  cursor: grab;
  transition:
    transform var(--duration-normal) var(--ease-spring),
    box-shadow var(--duration-normal) var(--ease-spring);
}
.model-card:active {
  cursor: grabbing;
}

.model-grid:has(.card-drag) .model-card:not(.card-drag):hover {
  transform: none !important;
  box-shadow: none !important;
}

/* ── 占位槽（原位置空框，不放任何内容）── */
.card-ghost {
  background: transparent !important;
  border: 2px dashed var(--accent) !important;
  border-radius: 16px !important;
  box-shadow: inset 0 0 24px var(--accent-glow) !important;
  opacity: 1 !important;
  overflow: hidden !important;
}

.card-ghost > * {
  visibility: hidden !important;
  pointer-events: none !important;
}

/* ── 拖拽中的实体卡片（Sortable.js forceFallback 克隆元素）──
   Sortable.js 用内联 style.transform:translate3d() 控制位置。
   不用 scale（会导致文字模糊），不用 rotate（干扰碰撞检测），
   不用 backdrop-filter（拖拽时性能差）。
   通过多层阴影 + 发光边框营造"拎起来"的立体感。 */
.card-drag {
  opacity: 1 !important;
  /* 禁用 glass-surface 继承的 backdrop-filter，每帧 20px 高斯模糊是性能杀手 */
  backdrop-filter: none !important;
  -webkit-backdrop-filter: none !important;
  /* 禁用 model-card 的 spring transition，避免与 SortableJS 的 translate3d 位置控制冲突 */
  transition: none !important;
  /* 多层阴影营造深度：远距离下沉 + 近距离弥散 + 边框高亮 + 外层辉光 */
  box-shadow:
    0 30px 70px rgba(0, 0, 0, 0.45),
    0 12px 24px rgba(0, 0, 0, 0.25),
    0 0 0 2px var(--accent),
    0 0 50px var(--accent-glow) !important;
  z-index: 9999 !important;
  cursor: grabbing !important;
  background: var(--glass-bg-strong) !important;
  border-radius: 16px !important;
  pointer-events: none !important;
  will-change: transform;
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

.provider-badge.mimo {
  background: rgba(212, 168, 85, 0.12);
  color: var(--provider-mimo);
}
.provider-badge.openai {
  background: rgba(107, 158, 122, 0.12);
  color: var(--provider-openai);
}
.provider-badge.claude {
  background: rgba(196, 168, 130, 0.12);
  color: var(--provider-claude);
}
.provider-badge.deepseek {
  background: rgba(124, 196, 138, 0.12);
  color: var(--provider-deepseek);
}
.provider-badge.kimi {
  background: rgba(184, 160, 136, 0.12);
  color: var(--provider-kimi);
}
.provider-badge.opencode {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}

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
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.token-ring-section {
  flex-shrink: 0;
}

.token-details {
  width: 100%;
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

  .type-summary {
    grid-template-columns: 1fr;
  }
}

/* 适配 Electron 最小宽度 1000px */
@media (max-width: 1000px) {
  .hero-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .hero-main {
    padding: 16px;
    gap: 16px;
  }

  .hero-ring-wrap {
    transform: scale(0.85);
  }

  .model-grid {
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: 10px;
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
