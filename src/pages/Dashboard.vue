<template>
  <div class="dashboard" :class="{ 'first-mount': firstMount }">
    <!-- Hero Stats -->
    <div class="hero-section">
      <!-- 多模型 Hero -->
      <div v-if="!agg.isSingleModel.value" class="hero-grid">
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

      <!-- 单模型 Hero：仅显示当前状态 -->
      <div v-else-if="agg.singleModelSummary.value" class="hero-grid single-model">
        <div class="hero-main glass-surface single-model-main single-status">
          <div class="hero-status-body">
            <div class="hero-status-icon" :style="singleStatusIconStyle">
              <el-icon :size="28"><component :is="singleStatusIcon" /></el-icon>
            </div>
            <div class="hero-status-info">
              <div class="hero-status-title">{{ agg.singleModelSummary.value.title }}</div>
              <div class="hero-status-value" :style="{ color: singleKpiColor }">
                {{ singleStatusValue }}
              </div>
              <div
                v-if="agg.singleModelSummary.value.secondaryText"
                class="hero-status-sub"
              >
                {{ agg.singleModelSummary.value.secondaryText }}
              </div>
            </div>
          </div>

          <div class="hero-status-meta">
            <span class="hero-provider-badge" :class="agg.singleModelSummary.value.model.provider">
              {{ getProviderLabel(agg.singleModelSummary.value.model.provider) }}
            </span>
            <span class="hero-update-at">{{ singleModelLastUpdated }}更新</span>
          </div>
        </div>
      </div>

      <!-- 单模型但暂无 usage 数据：回退多模型 Hero -->
      <div v-else class="hero-grid">
        <div class="hero-main glass-surface">
          <div class="hero-stats">
            <div class="hero-stat-empty">
              <span class="hero-stat-label">点击下方模型卡获取额度</span>
            </div>
          </div>
        </div>
        <div class="hero-side">
          <div class="quick-stat glass-surface">
            <div class="qs-info">
              <span class="qs-value">1</span>
              <span class="qs-label">已启用模型</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Type Summary Cards：仅多模型显示 -->
      <div class="type-summary" v-show="agg.hasAnyData.value && !agg.isSingleModel.value">
        <!-- 多模型：原有 3 列聚合卡 -->
        <template v-if="!agg.isSingleModel.value">
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
                  clipPath: `inset(0 ${safeClip(agg.tokenAgg.value.percent)} 0 0)`,
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
            <PercentBar
              variant="mini-tiers"
              :tiers="agg.percentAgg.value.tiers"
              :show-detail="false"
            />
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
        </template>
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
              ><Refresh /></el-icon>
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
        <p class="empty-text">
          {{ store.models.length === 0 ? "暂无配置的模型" : "暂无启用的模型" }}
        </p>
        <p class="empty-hint">
          {{
            store.models.length === 0
              ? "添加模型后即可监控 Token 使用情况"
              : "请在配置管理中启用模型"
          }}
        </p>
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
                <el-icon :size="14" :class="{ spin: store.fetching[model.id] }"
                >
                  <component
                    :is="store.fetching[model.id] ? Loading : Refresh"
                  />
                </el-icon>
              </button>
            </div>

            <!-- Token Type -->
            <template v-if="getUsage(model.id)?.usageType === 'token'">
              <div class="card-body token-type">
                <div class="token-ring-section">
                  <TokenRing
                    :percent="getUsage(model.id)?.percent || 0"
                    :size="110"
                  />
                </div>
                <div class="token-details">
                  <div class="detail-row">
                    <span class="detail-key">套餐类型</span>
                    <span class="detail-val">{{
                      getUsage(model.id)?.planName
                    }}</span>
                  </div>
                  <div
                    v-if="getUsage(model.id)?.currentPeriodEnd"
                    class="detail-row"
                  >
                    <span class="detail-key">到期时间</span>
                    <span class="detail-val">{{
                      getUsage(model.id)?.currentPeriodEnd?.slice(0, 10)
                    }}</span>
                  </div>
                  <div
                    v-if="getUsage(model.id)?.enableAutoRenew !== undefined"
                    class="detail-row"
                  >
                    <span class="detail-key">自动续费</span>
                    <span
                      class="auto-renew-badge"
                      :class="{ on: getUsage(model.id)?.enableAutoRenew }"
                    >
                      {{ getUsage(model.id)?.enableAutoRenew ? 'ON' : 'OFF' }}
                    </span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-key">总计额度</span>
                    <span class="detail-val">{{
                      formatFullNumber(getUsage(model.id)?.total || 0)
                    }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-key">已用额度</span>
                    <span class="detail-val">{{
                      formatFullNumber(getUsage(model.id)?.used || 0)
                    }}</span>
                  </div>
                  <div class="detail-row highlight">
                    <span class="detail-key">剩余额度</span>
                    <span class="detail-val">{{
                      formatFullNumber(getUsage(model.id)?.remaining || 0)
                    }}</span>
                  </div>
                </div>
              </div>
            </template>

            <!-- Percent Type (Kimi / OpenCode) -->
            <template v-else-if="getUsage(model.id)?.usageType === 'percent'">
              <div class="card-body percent-type">
                <PercentBar :tiers="getUsage(model.id)?.tiers || []" />
                <!-- 当 tiers 包含 total/used 数据时展示详情 -->
                <div v-if="hasPercentDetails(model.id)" class="percent-details">
                  <div class="detail-row">
                    <span class="detail-key">套餐类型</span>
                    <span class="detail-val">{{ getUsage(model.id)?.planName }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-key">总计额度</span>
                    <span class="detail-val">{{ formatFullNumber(getPercentTotal(model.id)) }}</span>
                  </div>
                  <div class="detail-row">
                    <span class="detail-key">已用额度</span>
                    <span class="detail-val warn">{{ formatFullNumber(getPercentUsed(model.id)) }}</span>
                  </div>
                  <div class="detail-row highlight">
                    <span class="detail-key">剩余额度</span>
                    <span class="detail-val ok">{{ formatFullNumber(getPercentRemaining(model.id)) }}</span>
                  </div>
                </div>
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

            <!-- No Data or Error -->
            <div v-else class="card-body empty-type">
              <!-- 错误状态 -->
              <div
                v-if="getUsage(model.id)?.usageType === 'error'"
                class="error-card-content"
              >
                <div class="error-info">
                  <span class="error-label">{{
                    getUsage(model.id)?.error?.includes("Cookie")
                      ? "Cookie 过期"
                      : "错误"
                  }}</span>
                  <span class="error-detail">{{
                    getUsage(model.id)?.error || "未知错误"
                  }}</span>
                </div>
                <button class="btn-relogin" @click="handleErrorAction(model)">
                  <span>{{
                    getUsage(model.id)?.error?.includes("Cookie")
                      ? "重新登录"
                      : "查看详情"
                  }}</span>
                </button>
              </div>
              <!-- 加载中状态 -->
              <div
                v-else-if="store.fetching[model.id]"
                class="loading-card-content"
              >
                <el-icon :size="20" class="spin"><Loading /></el-icon>
                <span class="loading-text">加载中...</span>
              </div>

              <!-- 无数据状态 -->
              <button v-else class="btn-fetch" @click="fetchUsage(model)">
                <span>获取额度</span>
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
  Clock,
  MostlyCloudy,
  Histogram,
  Wallet,
} from "@element-plus/icons-vue";
import type { ModelConfig } from "@/stores/app";
import { useAppStore } from "@/stores/app";
import { formatTokens, getProgressColorSmooth } from "@/utils/format";
import { useUsageAggregation } from "@/composables/useUsageAggregation";
import draggable from "vuedraggable";
import TokenRing from "@/components/TokenRing.vue";
import PercentBar from "@/components/PercentBar.vue";
import BalanceCard from "@/components/BalanceCard.vue";
import CountUp from "@/components/CountUp.vue";

/** 计算 clip-path 右侧 inset，保证 0% 时完全隐藏，NaN 时安全回退 */
function safeClip(percent: number): string {
  const p = Number.isFinite(percent) ? Math.min(Math.max(percent, 0), 100) : 0
  return p === 0 ? '100%' : `calc(100% - ${p}%)`
}

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
  return store.models.filter((m) => m.enabled);
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

function hasPercentDetails(modelId: string): boolean {
  const usage = getUsage(modelId);
  if (!usage?.tiers) return false;
  return usage.tiers.some((t) => (t.total || 0) > 0);
}

function getPercentTotal(modelId: string): number {
  const usage = getUsage(modelId);
  if (!usage?.tiers) return 0;
  return usage.tiers.reduce((sum, t) => sum + (t.total || 0), 0);
}

function getPercentUsed(modelId: string): number {
  const usage = getUsage(modelId);
  if (!usage?.tiers) return 0;
  return usage.tiers.reduce((sum, t) => sum + (t.used || 0), 0);
}

function getPercentRemaining(modelId: string): number {
  const usage = getUsage(modelId);
  if (!usage?.tiers) return 0;
  return usage.tiers.reduce((sum, t) => sum + (t.remaining || 0), 0);
}

const singleStatusIcon = computed(() => {
  const summary = agg.singleModelSummary.value;
  if (!summary) return MostlyCloudy;
  if (summary.type === "token") return Histogram;
  if (summary.type === "percent") return Clock;
  return Wallet;
});

const singleStatusIconStyle = computed(() => {
  const summary = agg.singleModelSummary.value;
  if (summary?.type === "balance") return { "--glow": "var(--neon-green)" };
  const percent = summary?.primaryValue ?? 0;
  return { "--glow": getProgressColorSmooth(percent) };
});

const singleStatusValue = computed(() => {
  const summary = agg.singleModelSummary.value;
  if (!summary) return "—";
  if (summary.type === "balance") {
    return `${summary.usage.currency === "CNY" ? "¥" : summary.usage.currency || ""}${(summary.usage.balance || 0).toFixed(2)}`;
  }
  return summary.primaryLabel;
});

// ── 单模型 Hero 右侧关键指标 --
const singleKpiValue = computed(() => {
  const summary = agg.singleModelSummary.value;
  if (!summary) return "—";
  if (summary.type === "token") {
    return summary.primaryLabel;
  }
  if (summary.type === "percent") {
    return summary.primaryLabel;
  }
  return summary.primaryLabel;
});

const singleKpiLabel = computed(() => {
  const summary = agg.singleModelSummary.value;
  if (!summary) return "状态";
  if (summary.type === "token") return "已用比例";
  if (summary.type === "percent") return "最紧张窗口";
  return "账户余额";
});

const singleKpiIcon = computed(() => {
  const summary = agg.singleModelSummary.value;
  if (!summary) return MostlyCloudy;
  if (summary.type === "token") return Histogram;
  if (summary.type === "percent") return Clock;
  return Wallet;
});

const singleKpiIconStyle = computed(() => {
  const summary = agg.singleModelSummary.value;
  const glow =
    summary?.type === "balance"
      ? "var(--neon-green)"
      : summary?.type === "percent"
      ? "var(--neon-red)"
      : "var(--neon-amber)";
  return { "--glow": glow };
});

const singleKpiColor = computed(() => {
  const summary = agg.singleModelSummary.value;
  if (!summary) return "var(--text-primary)";
  if (summary.type === "balance") return "var(--neon-green)";
  return getProgressColorSmooth(summary.primaryValue);
});

const singleModelLastUpdated = computed(() => {
  const usage = agg.singleModelUsage.value;
  if (!usage?.lastUpdated) return "—";
  const diff = Date.now() - usage.lastUpdated;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes}分钟前`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
});

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

async function handleErrorAction(model: ModelConfig) {
  const usage = getUsage(model.id);
  if (!usage?.error) return;

  // Cookie 过期 - 打开登录窗口
  if (usage.error.includes("Cookie")) {
    try {
      if (model.provider === "opencode") {
        await store.startOpenCodeLogin(model.id);
        ElMessage.success({
          message: "登录成功，正在刷新额度...",
          duration: 2000,
        });
        await fetchUsage(model);
      } else {
        await store.startMimoLogin(model.id);
        ElMessage.success({
          message: "登录成功，正在刷新额度...",
          duration: 2000,
        });
        await fetchUsage(model);
      }
    } catch (error) {
      console.error("登录失败:", error);
    }
  }
  // API key 失效 - 跳转到配置页面让用户修改
  else if (usage.error.includes("API key")) {
    ElMessage.warning({ message: "请在配置中更新 API key", duration: 3000 });
    // 这里可以跳转到配置页面或打开编辑对话框
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

/* 单模型极简状态 Hero */
.hero-grid.single-model {
  grid-template-columns: 1fr;
}

.hero-grid.single-model .hero-main {
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 18px;
  min-height: 0;
}

.hero-grid.single-model .hero-main.single-model-main {
  min-height: 0;
}

.hero-status-body {
  display: flex;
  align-items: center;
  gap: 14px;
  min-width: 0;
}

.hero-status-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: var(--glass-bg-strong);
  border: 1px solid var(--glass-border);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--glow);
  box-shadow: 0 0 12px var(--glow);
  flex-shrink: 0;
}

.hero-status-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.hero-status-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-status-value {
  font-size: 22px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  line-height: 1.2;
}

.hero-status-sub {
  font-size: 11px;
  color: var(--text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hero-status-meta {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  flex-shrink: 0;
}

.hero-update-at {
  font-size: 10px;
  color: var(--text-placeholder);
}

.hero-provider-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--glass-bg);
  color: var(--text-secondary);
}

.hero-provider-badge.mimo {
  background: rgba(212, 168, 85, 0.12);
  color: var(--provider-mimo);
}

.hero-provider-badge.openai {
  background: rgba(107, 158, 122, 0.12);
  color: var(--provider-openai);
}

.hero-provider-badge.claude {
  background: rgba(196, 168, 130, 0.12);
  color: var(--provider-claude);
}

.hero-provider-badge.deepseek {
  background: rgba(124, 196, 138, 0.12);
  color: var(--provider-deepseek);
}

.hero-provider-badge.kimi {
  background: rgba(184, 160, 136, 0.12);
  color: var(--provider-kimi);
}

.hero-provider-badge.opencode {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}

.hero-single-body {
  display: flex;
  align-items: center;
  gap: 24px;
}

.hero-single-stats {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.hss-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  border-radius: 10px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
}

.hss-label {
  font-size: 11px;
  color: var(--text-secondary);
}

.hss-value {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.hss-value.warn {
  color: var(--neon-amber);
}

.hss-value.ok {
  color: var(--neon-green);
}

.hero-model-footer {
  font-size: 12px;
  color: var(--text-secondary);
  padding-top: 4px;
}

.hero-model-meta {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.hero-model-title {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-primary);
}

.hero-model-subtitle {
  font-size: 13px;
  color: var(--text-secondary);
}

.hero-model-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.hpill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border-radius: 8px;
  background: var(--glass-bg);
  border: 1px solid var(--glass-border);
  font-size: 12px;
}

.hpill-k {
  color: var(--text-secondary);
}

.hpill-v {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.hpill-v.warn {
  color: var(--neon-amber);
}

.hpill-v.ok {
  color: var(--neon-green);
}

.hero-percent-hero {
  flex: 1;
  min-width: 0;
}

.hero-balance-hero {
  display: flex;
  align-items: center;
  gap: 16px;
}

.hero-balance-icon {
  width: 72px;
  height: 72px;
  border-radius: 18px;
  background: linear-gradient(135deg, var(--neon-amber) 0%, var(--accent) 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  box-shadow: 0 0 24px rgba(212, 168, 85, 0.25);
}

.hero-balance-value {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.hero-balance-currency {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-secondary);
}

.hero-balance-amount {
  font-size: 42px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

@media (max-width: 720px) {
  .hero-grid.single-model {
    grid-template-columns: 1fr;
  }

  .hero-status-body {
    gap: 12px;
  }

  .hero-status-value {
    font-size: 18px;
  }

  .hero-status-meta {
    align-items: flex-start;
  }
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

.hero-alert-dot.balance {
  background: var(--neon-green);
  box-shadow: 0 0 6px var(--neon-green);
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

.hero-side.single-model-side {
  justify-content: center;
  display: none;
}

.hero-grid.single-model .hero-side {
  gap: 12px;
}

.hero-grid.single-model .quick-stat.single-kpi {
  padding: 14px;
}

.hero-grid.single-model .qs-value {
  font-size: 16px;
}

.hero-grid.single-model .qs-label {
  font-size: 10px;
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

.quick-stat.single-kpi {
  flex: 1;
  min-height: 0;
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
  font-size: 18px;
  font-weight: 700;
  margin: 0;
}

.section-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 48px 24px;
  border-radius: 16px;
  gap: 14px;
  text-align: center;
}

.empty-visual {
  position: relative;
  width: 80px;
  height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 3px solid var(--border-light);
  border-top-color: var(--accent);
  animation: spin 1.2s linear infinite;
}

.empty-icon {
  color: var(--text-placeholder);
}

.empty-text {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.empty-hint {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

.model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.model-card {
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  transition:
    transform var(--duration-normal) var(--ease-spring),
    box-shadow var(--duration-normal) var(--ease-smooth);
}

.model-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--glass-shadow-hover);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  flex: 1;
}

.model-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.provider-badge {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 5px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  background: var(--glass-bg);
  color: var(--text-secondary);
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

.provider-badge.mimo {
  background: rgba(212, 168, 85, 0.12);
  color: var(--provider-mimo);
}

.provider-badge.opencode {
  background: rgba(139, 92, 246, 0.12);
  color: #8b5cf6;
}

.card-refresh {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.card-refresh:hover:not(:disabled) {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
}

.card-refresh:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.card-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

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
  gap: 6px;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.detail-row.highlight .detail-val {
  color: var(--neon-green);
  font-weight: 700;
}

.detail-key {
  color: var(--text-secondary);
}

.detail-val {
  font-weight: 600;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
}

.auto-renew-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 5px;
  background: rgba(248, 113, 113, 0.12);
  color: var(--neon-red);
}

.auto-renew-badge.on {
  background: rgba(34, 211, 238, 0.12);
  color: var(--neon-green);
}

.percent-type {
  gap: 10px;
}

.percent-details {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--border-light);
}

.balance-type {
  align-items: stretch;
}

.empty-type {
  align-items: center;
  justify-content: center;
  min-height: 160px;
  gap: 10px;
}

.error-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.error-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.error-label {
  font-size: 13px;
  font-weight: 700;
  color: var(--neon-red);
}

.error-detail {
  font-size: 11px;
  color: var(--text-secondary);
  max-width: 100%;
  word-break: break-all;
}

.btn-relogin {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-relogin:hover {
  background: var(--glass-bg-strong);
}

.loading-card-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary);
  font-size: 12px;
}

.btn-fetch {
  padding: 8px 18px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-fetch:hover {
  background: var(--glass-bg-strong);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: none;
  background: var(--accent);
  color: var(--bg-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.btn-primary:hover:not(:disabled) {
  filter: brightness(1.1);
  transform: translateY(-1px);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin {
  animation: spin 0.8s linear infinite;
}

.card-ghost {
  opacity: 0.5;
  background: var(--glass-bg-strong);
}

.card-drag {
  opacity: 0.95;
  transform: scale(1.02);
}

@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* 单模型时模型卡片区域顶部间距微调 */
.hero-grid.single-model + .type-summary {
  margin-top: 14px;
}

@media (max-width: 720px) {
  .hero-grid {
    grid-template-columns: 1fr;
  }

  .hero-side {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .quick-stat {
    flex: 1 1 calc(50% - 5px);
  }

  .token-type {
    grid-template-columns: 1fr;
  }
}
</style>
