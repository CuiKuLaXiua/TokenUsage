<template>
  <div class="usage-page">
    <!-- 套餐上下文栏 (Level 1) -->
    <div class="model-context-bar glass-surface" style="animation-delay: 0ms">
      <div class="model-context-bar__left">
        <el-icon :size="14"><Cpu /></el-icon>
        <span class="model-context-bar__label">当前套餐</span>
      </div>
      <GlassSelect
        v-model="selectedModelId"
        :options="modelOptions"
        placeholder="选择套餐"
        :matchWidth="false"
        @change="onModelChange"
      >
        <template #option="{ option }">
          <div class="model-option">
            <span
              class="provider-dot"
              :style="{ background: providerColor(option.provider) }"
            ></span>
            <span>{{ option.label }}</span>
            <span class="provider-tag">{{ option.provider }}</span>
          </div>
        </template>
      </GlassSelect>
      <IconButton :icon="Refresh" :loading="loading" @click="fetchData" />
    </div>

    <!-- 不支持的 provider -->
    <div
      v-if="!isMimo && selectedModelId"
      class="section-card glass-surface"
      style="animation-delay: 0ms"
    >
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <el-icon :size="48"><TrendCharts /></el-icon>
        </div>
        <p class="empty-text">暂不支持该模型</p>
        <p class="empty-hint">
          当前仅支持 MiMo 模型的用量详情查询，其他模型后续迭代
        </p>
      </div>
    </div>

    <!-- 汇总 + 图表/表格 共用模块 -->
    <div
      v-if="items.length"
      class="section-card glass-surface"
      style="animation-delay: 60ms"
    >
      <!-- 汇总卡片 -->
      <div v-if="filteredItems.length" class="summary-row">
        <div class="summary-item summary-item--token">
          <div class="summary-item__icon">
            <el-icon :size="18"><Coin /></el-icon>
          </div>
          <div class="summary-item__body">
            <span class="summary-label">本月总 Token</span>
            <span class="summary-value">{{
              formatTokensFull(totalTokens)
            }}</span>
          </div>
        </div>
        <div class="summary-item summary-item--request">
          <div class="summary-item__icon">
            <el-icon :size="18"><DataAnalysis /></el-icon>
          </div>
          <div class="summary-item__body">
            <span class="summary-label">总请求数</span>
            <span class="summary-value">{{
              totalRequests.toLocaleString()
            }}</span>
          </div>
        </div>
        <div class="summary-item summary-item--daily">
          <div class="summary-item__icon">
            <el-icon :size="18"><TrendCharts /></el-icon>
          </div>
          <div class="summary-item__body">
            <span class="summary-label">日均 Token</span>
            <span class="summary-value">{{ formatTokensFull(avgTokens) }}</span>
          </div>
        </div>
        <div class="summary-item summary-item--output">
          <div class="summary-item__icon">
            <el-icon :size="18"><Upload /></el-icon>
          </div>
          <div class="summary-item__body">
            <span class="summary-label">输出 Token</span>
            <span class="summary-value">{{
              formatTokensFull(totalOutput)
            }}</span>
          </div>
        </div>
      </div>

      <!-- Section header + Level 2 筛选栏 -->
      <div class="section-header">
        <h3 class="section-title">每日 Token 消耗</h3>
        <div class="chart-filters">
          <GlassMonthPicker
            v-model="selectedMonth"
            placeholder="选择月份"
            @change="onMonthChange"
          >
            <template #prefix-icon
              ><el-icon :size="14"><Calendar /></el-icon
            ></template>
          </GlassMonthPicker>
          <div class="chart-filters__separator"></div>
          <ToggleGroup
            v-model="dataMode"
            :options="dataModeOptions"
            @update:model-value="onDataModeChange"
          />
          <ToggleGroup v-model="viewMode" :options="viewModeOptions" />
          <div
            class="chart-filters__conditional"
            :class="{ 'is-active': viewMode === 'chart' }"
          >
            <ToggleGroup v-model="chartStyle" :options="chartStyleOptions" />
          </div>
          <div
            class="chart-filters__conditional"
            :class="{ 'is-active': dataMode === 'single' }"
          >
            <GlassSelect
              v-model="filterModel"
              :options="availableModelOptions"
              placeholder="筛选模型"
              size="small"
              :matchWidth="false"
              class="chart-filters__model-select"
            >
              <template #prefix-icon
                ><el-icon :size="14"><Filter /></el-icon
              ></template>
            </GlassSelect>
          </div>
        </div>
      </div>

      <!-- 图表视图 -->
      <div v-if="viewMode === 'chart'" class="chart-wrap">
        <v-chart
          v-if="filteredItems.length"
          :option="chartOption"
          autoresize
          style="height: 300px"
        />
        <div v-else class="chart-empty">该模型本月无数据</div>
      </div>

      <!-- 列表视图 -->
      <div v-if="viewMode === 'table'" class="table-wrap">
        <el-table
          :data="filteredItems"
          stripe
          style="width: 100%"
          max-height="360"
        >
          <el-table-column prop="date" label="日期" width="110" sortable>
            <template #default="{ row }">
              <span class="cell-date">{{ row.date.slice(5) }}</span>
            </template>
          </el-table-column>
          <el-table-column prop="model" label="模型" min-width="140">
            <template #default="{ row }">
              <span class="model-badge">{{ row.model }}</span>
            </template>
          </el-table-column>
          <el-table-column
            label="总 Token"
            min-width="130"
            sortable
            sort-by="totalToken"
          >
            <template #default="{ row }">
              <span class="cell-number">{{
                row.totalToken.toLocaleString()
              }}</span>
            </template>
          </el-table-column>
          <el-table-column
            label="输入命中"
            min-width="130"
            sortable
            sort-by="inputHitToken"
          >
            <template #default="{ row }">
              <span class="cell-number hit">{{
                row.inputHitToken.toLocaleString()
              }}</span>
            </template>
          </el-table-column>
          <el-table-column
            label="输入未命中"
            min-width="130"
            sortable
            sort-by="inputMissToken"
          >
            <template #default="{ row }">
              <span class="cell-number miss">{{
                row.inputMissToken.toLocaleString()
              }}</span>
            </template>
          </el-table-column>
          <el-table-column
            label="输出"
            min-width="110"
            sortable
            sort-by="outputToken"
          >
            <template #default="{ row }">
              <span class="cell-number output">{{
                row.outputToken.toLocaleString()
              }}</span>
            </template>
          </el-table-column>
          <el-table-column
            prop="requestCount"
            label="请求数"
            width="90"
            sortable
            align="right"
          >
            <template #default="{ row }">
              <span class="cell-number">{{
                row.requestCount.toLocaleString()
              }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    </div>

    <!-- 空态 -->
    <div
      v-if="isMimo && !loading && !items.length && fetched"
      class="section-card glass-surface"
      style="animation-delay: 0ms"
    >
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <el-icon :size="48"><TrendCharts /></el-icon>
        </div>
        <p class="empty-text">暂无用量数据</p>
        <p class="empty-hint">该月份没有用量记录，请确认已登录 MiMo</p>
      </div>
    </div>

    <!-- 加载态 -->
    <div
      v-if="loading"
      class="section-card glass-surface"
      style="animation-delay: 0ms"
    >
      <div class="loading-state">
        <el-icon class="is-loading" :size="32"><Loading /></el-icon>
        <p class="loading-text">加载中...</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from "vue";
import { useAppStore } from "@/stores/app";
import { formatTokensAxis, formatTokensFull } from "@/utils/format";
import {
  TrendCharts,
  Refresh,
  Loading,
  Calendar,
  Cpu,
  Filter,
  Coin,
  DataAnalysis,
  Upload,
} from "@element-plus/icons-vue";
import VChart from "vue-echarts";
import { use } from "echarts/core";
import { graphic } from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { MimoTokenPlanItem } from "@/types/electron";
import GlassSelect from "@/components/GlassSelect.vue";
import GlassMonthPicker from "@/components/GlassMonthPicker.vue";
import ToggleGroup from "@/components/ToggleGroup.vue";
import IconButton from "@/components/IconButton.vue";
import { useThemeStore } from "@/stores/theme";

use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const store = useAppStore();
const themeStore = useThemeStore();

const accentColorMap: Record<string, string> = {
  forest: "#6b9e7a",
  moss: "#8fa87a",
  matcha: "#a8c27a",
};

const now = new Date();
const selectedMonth = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`,
);
const selectedModelId = ref<string>("");
const items = ref<MimoTokenPlanItem[]>([]);
const loading = ref(false);
const fetched = ref(false);

const viewMode = ref<"chart" | "table">("chart");
const dataMode = ref<"total" | "single">("total");
const chartStyle = ref<"bar" | "area">("bar");
const filterModel = ref<string>("");

const currentModel = computed(() =>
  store.models.find((m) => m.id === selectedModelId.value),
);
const isMimo = computed(() => currentModel.value?.provider === "mimo");

const providerColors: Record<string, string> = {
  mimo: "#d4a855",
  kimi: "#b8a088",
  deepseek: "#7cc48a",
  opencode: "#6b9e7a",
};
function providerColor(p: string) {
  return providerColors[p] || "var(--text-tertiary)";
}

// -- GlassSelect options --
const modelOptions = computed(() =>
  store.models.map((m) => ({
    label: m.name,
    value: m.id,
    provider: m.provider,
  })),
);
const availableModels = computed(() =>
  [...new Set(items.value.map((i) => i.model))].sort(),
);
const availableModelOptions = computed(() =>
  availableModels.value.map((m) => ({ label: m, value: m })),
);

// -- ToggleGroup options --
const dataModeOptions = [
  { label: "总消耗", value: "total" },
  { label: "单模型", value: "single" },
];
const viewModeOptions = [
  { label: "图表", value: "chart" },
  { label: "列表", value: "table" },
];
const chartStyleOptions = [
  { label: "柱状", value: "bar" },
  { label: "面积", value: "area" },
];

const filteredItems = computed(() => {
  if (dataMode.value === "single" && filterModel.value) {
    return items.value.filter((i) => i.model === filterModel.value);
  }
  return items.value;
});

const totalTokens = computed(() =>
  filteredItems.value.reduce((s, i) => s + i.totalToken, 0),
);
const totalRequests = computed(() =>
  filteredItems.value.reduce((s, i) => s + i.requestCount, 0),
);
const totalOutput = computed(() =>
  filteredItems.value.reduce((s, i) => s + i.outputToken, 0),
);
const avgTokens = computed(() => {
  const days = new Set(filteredItems.value.map((i) => i.date)).size;
  return days > 0 ? Math.round(totalTokens.value / days) : 0;
});

function getMonthDays(yearMonth: string): string[] {
  const [y, m] = yearMonth.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  return Array.from({ length: days }, (_, i) => {
    const d = String(i + 1).padStart(2, "0");
    return `${y}-${m.toString().padStart(2, "0")}-${d}`;
  });
}

const chartOption = computed(() => {
  const allDays = getMonthDays(selectedMonth.value);
  const dayLabels = allDays.map((d) => d.slice(5));
  const dataMap = new Map<string, MimoTokenPlanItem[]>();
  for (const item of filteredItems.value) {
    const arr = dataMap.get(item.date) || [];
    arr.push(item);
    dataMap.set(item.date, arr);
  }
  const sumField = (date: string, field: keyof MimoTokenPlanItem) => {
    const arr = dataMap.get(date) || [];
    return arr.reduce((s, i) => s + (i[field] as number), 0);
  };

  const isDark = themeStore.isDark;
  const accentHex = accentColorMap[themeStore.accent] || "#6b9e7a";
  const tooltipBg = isDark ? "rgba(15,22,16,0.94)" : "rgba(255,252,245,0.96)";
  const tooltipText = isDark ? "#e4e0d8" : "#2c3028";
  const tooltipBorder = isDark ? "rgba(74,124,89,0.15)" : "rgba(74,124,89,0.2)";
  const axisColor = isDark ? "#5a6358" : "#8a9186";
  const splitLineColor = isDark
    ? "rgba(74,124,89,0.05)"
    : "rgba(74,124,89,0.08)";
  const pointerShadow = isDark
    ? "rgba(74,124,89,0.06)"
    : "rgba(74,124,89,0.08)";

  const seriesDefs = [
    {
      name: "输入命中",
      data: allDays.map((d) => sumField(d, "inputHitToken")),
      topColor: "rgba(91,143,249,0.92)",
      bottomColor: "rgba(91,143,249,0.35)",
      fadeColor: "rgba(91,143,249,0.03)",
    },
    {
      name: "输入未命中",
      data: allDays.map((d) => sumField(d, "inputMissToken")),
      topColor: "rgba(97,221,170,0.92)",
      bottomColor: "rgba(97,221,170,0.35)",
      fadeColor: "rgba(97,221,170,0.03)",
    },
    {
      name: "输出",
      data: allDays.map((d) => sumField(d, "outputToken")),
      topColor: "rgba(246,144,61,0.92)",
      bottomColor: "rgba(246,144,61,0.35)",
      fadeColor: "rgba(246,144,61,0.03)",
    },
  ];

  const isArea = chartStyle.value === "area";

  const series = seriesDefs.map((def) => {
    if (isArea) {
      return {
        name: def.name,
        type: "line" as const,
        stack: "token",
        smooth: 0.35,
        symbol: "none",
        lineStyle: { width: 2, color: def.topColor },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: def.bottomColor },
            { offset: 1, color: def.fadeColor },
          ]),
        },
        itemStyle: { color: def.topColor },
        data: def.data,
        animationDuration: 1000,
        animationEasing: "cubicOut" as const,
      };
    }
    return {
      name: def.name,
      type: "bar" as const,
      stack: "token",
      data: def.data,
      barMaxWidth: 24,
      itemStyle: {
        color: new graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: def.topColor },
          { offset: 1, color: def.bottomColor },
        ]),
        borderRadius: [3, 3, 0, 0],
      },
      animationDuration: 800,
      animationEasing: "elasticOut" as const,
      animationDelay: (idx: number) => idx * 25,
    };
  });

  return {
    tooltip: {
      trigger: "axis" as const,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      padding: [12, 16],
      textStyle: { color: tooltipText, fontSize: 12 },
      axisPointer: {
        type: (isArea ? "line" : "shadow") as "line" | "shadow",
        shadowStyle: { color: pointerShadow },
        lineStyle: {
          color: "rgba(74,124,89,0.2)",
          type: "dashed" as const,
        },
      },
      formatter(params: any[]) {
        const colorMap: Record<string, string> = {
          输入命中: "rgba(91,143,249,0.92)",
          输入未命中: "rgba(97,221,170,0.92)",
          输出: "rgba(246,144,61,0.92)",
        };
        const date = params[0]?.axisValue;
        const total = params.reduce((s: number, p: any) => s + p.value, 0);
        const lines = params.map((p: any) => {
          const dotColor = colorMap[p.seriesName] || p.color;
          return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${dotColor};margin-right:6px"></span>${p.seriesName}: <b>${p.value.toLocaleString()}</b>`;
        });
        return `<div style="font-weight:600;margin-bottom:6px;font-size:13px">${date}<span style="float:right;margin-left:16px;color:${axisColor}">${total.toLocaleString()}</span></div>${lines.join("<br/>")}`;
      },
    },
    legend: {
      top: 4,
      right: 8,
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 16,
      textStyle: { color: axisColor, fontSize: 11 },
    },
    grid: {
      left: 62,
      right: 16,
      top: 44,
      bottom: 42,
    },
    xAxis: {
      type: "category" as const,
      data: dayLabels,
      boundaryGap: !isArea,
      axisLabel: {
        color: axisColor,
        fontSize: 10,
        interval: allDays.length > 20 ? 2 : allDays.length > 10 ? 1 : 0,
        margin: 10,
      },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value" as const,
      axisLabel: {
        color: axisColor,
        fontSize: 10,
        formatter(v: number) {
          return formatTokensAxis(v);
        },
      },
      splitLine: {
        lineStyle: { color: splitLineColor, type: "dashed" as const },
      },
    },
    dataZoom: [
      {
        type: "slider" as const,
        show: true,
        start: 0,
        end: 100,
        height: 20,
        bottom: 2,
        borderColor: "transparent",
        backgroundColor: isDark
          ? "rgba(74,124,89,0.04)"
          : "rgba(74,124,89,0.06)",
        fillerColor: isDark ? "rgba(74,124,89,0.08)" : "rgba(74,124,89,0.12)",
        handleStyle: { color: accentHex, borderColor: "transparent" },
        textStyle: { color: axisColor, fontSize: 10 },
        dataBackground: {
          lineStyle: { color: "rgba(74,124,89,0.15)" },
          areaStyle: { color: "rgba(74,124,89,0.04)" },
        },
      },
    ],
    series,
  };
});

function onModelChange() {
  items.value = [];
  fetched.value = false;
  filterModel.value = "";
  dataMode.value = "total";
  fetchData();
}

function onMonthChange() {
  fetchData();
}

function onDataModeChange() {
  filterModel.value = availableModels.value.length
    ? availableModels.value[0]
    : "";
}

async function fetchData() {
  const model = currentModel.value;
  if (!model) return;

  if (model.provider !== "mimo" || !model.cookies) {
    items.value = [];
    fetched.value = true;
    return;
  }

  const [yearStr, monthStr] = selectedMonth.value.split("-");
  loading.value = true;
  fetched.value = false;
  try {
    const res = await window.electronAPI.fetchMimoTokenPlan({
      year: Number(yearStr),
      month: Number(monthStr),
      cookies: model.cookies,
    });
    items.value = res.code === 0 ? (res.data ?? []) : [];
  } catch (e: any) {
    if (e?.code === "COOKIE_EXPIRED") {
      items.value = [];
    } else {
      console.error("[Usage] fetch error:", e);
      items.value = [];
    }
  } finally {
    loading.value = false;
    fetched.value = true;
  }
}

onMounted(() => {
  if (store.models.length && !selectedModelId.value) {
    selectedModelId.value = store.models[0].id;
  }
  if (store.isConfigLoaded) {
    fetchData();
  }
});

watch(
  () => store.isConfigLoaded,
  (v) => {
    if (v && !fetched.value) {
      if (store.models.length && !selectedModelId.value) {
        selectedModelId.value = store.models[0].id;
      }
      fetchData();
    }
  },
);
</script>

<style scoped>
.usage-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding-bottom: 20px;
}

.section-card {
  padding: 20px 24px;
  border-radius: 16px;
  flex-shrink: 0;
}

/* ── 套餐上下文栏 (Level 1) ── */
.model-context-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-radius: 14px;
}

.model-context-bar__left {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  color: var(--text-secondary);
}

.model-context-bar__label {
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
}

.model-context-bar :deep(.glass-select) {
  width: 200px;
  flex-shrink: 0;
}

/* ── 汇总卡片 ── */
.summary-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--border-light);
}

.summary-item {
  position: relative;
  padding: 16px;
  border-radius: 14px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  display: flex;
  align-items: flex-start;
  gap: 12px;
  overflow: hidden;
  transition:
    transform 0.3s var(--ease-spring),
    box-shadow 0.3s var(--ease-smooth),
    border-color 0.3s var(--ease-smooth);
  animation: summarySlideUp 0.5s var(--ease-spring) both;
}

.summary-item:nth-child(1) {
  animation-delay: 0ms;
}
.summary-item:nth-child(2) {
  animation-delay: 60ms;
}
.summary-item:nth-child(3) {
  animation-delay: 120ms;
}
.summary-item:nth-child(4) {
  animation-delay: 180ms;
}

/* 顶部彩色光带 */
.summary-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 3px;
  border-radius: 14px 14px 0 0;
  opacity: 0.8;
  transition: opacity 0.3s var(--ease-smooth);
}

/* 底部微光背景 */
.summary-item::after {
  content: "";
  position: absolute;
  bottom: -20px;
  right: -20px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  opacity: 0.06;
  filter: blur(20px);
  transition: opacity 0.3s var(--ease-smooth);
  pointer-events: none;
}

.summary-item:hover {
  transform: translateY(-3px);
  box-shadow: var(--glass-shadow-hover);
  border-color: var(--glass-border);
}

.summary-item:hover::before {
  opacity: 1;
}
.summary-item:hover::after {
  opacity: 0.12;
}

/* 四张卡片各自配色 */
.summary-item--token::before {
  background: rgba(91, 143, 249, 0.8);
}
.summary-item--token::after {
  background: rgba(91, 143, 249, 1);
}
.summary-item--token .summary-item__icon {
  color: rgba(91, 143, 249, 0.9);
  background: rgba(91, 143, 249, 0.08);
}

.summary-item--request::before {
  background: rgba(97, 221, 170, 0.8);
}
.summary-item--request::after {
  background: rgba(97, 221, 170, 1);
}
.summary-item--request .summary-item__icon {
  color: rgba(97, 221, 170, 0.9);
  background: rgba(97, 221, 170, 0.08);
}

.summary-item--daily::before {
  background: rgba(246, 144, 61, 0.8);
}
.summary-item--daily::after {
  background: rgba(246, 144, 61, 1);
}
.summary-item--daily .summary-item__icon {
  color: rgba(246, 144, 61, 0.9);
  background: rgba(246, 144, 61, 0.08);
}

.summary-item--output::before {
  background: var(--accent, #6b9e7a);
}
.summary-item--output::after {
  background: var(--accent, #6b9e7a);
}
.summary-item--output .summary-item__icon {
  color: var(--accent, #6b9e7a);
  background: var(--accent-glow, rgba(107, 158, 122, 0.08));
}

.summary-item__icon {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s var(--ease-spring);
}

.summary-item:hover .summary-item__icon {
  transform: scale(1.08);
}

.summary-item__body {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.summary-label {
  font-size: 12px;
  color: var(--text-tertiary);
  letter-spacing: 0.3px;
}

.summary-value {
  font-size: 18px;
  font-weight: 700;
  color: var(--text-primary);
  font-variant-numeric: tabular-nums;
  word-break: break-all;
}

@keyframes summarySlideUp {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* ── 模型下拉选项 ── */
.model-option {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.provider-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.provider-tag {
  margin-left: auto;
  font-size: 11px;
  color: var(--text-tertiary);
  text-transform: capitalize;
}

/* ── Section header + Level 2 筛选栏 ── */
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  flex-wrap: wrap;
  gap: 12px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  padding-top: 4px;
}

.chart-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.chart-filters__separator {
  width: 1px;
  height: 20px;
  background: var(--border-light);
  flex-shrink: 0;
}

.chart-filters :deep(.glass-select) {
  width: 140px;
  flex-shrink: 0;
}

.chart-filters__model-select {
  width: 160px;
}

/* 条件筛选项：始终占位，通过 max-width/margin 过渡避免布局跳动 */
.chart-filters__conditional {
  display: flex;
  align-items: center;
  overflow: hidden;
  max-width: 0;
  margin-left: 0;
  opacity: 0;
  pointer-events: none;
  transition:
    max-width 0.3s var(--ease-spring),
    margin-left 0.3s var(--ease-spring),
    opacity 0.2s var(--ease-smooth);
}

.chart-filters__conditional.is-active {
  max-width: 200px;
  margin-left: 4px;
  opacity: 1;
  pointer-events: auto;
}

/* ── 图表 ── */
.chart-wrap {
  width: 100%;
}

.chart-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  font-size: 14px;
  color: var(--text-tertiary);
}

/* ── 表格 ── */
.table-wrap {
  border-radius: 14px;
  overflow: hidden;
  border: 1px solid var(--border-light);
  background: var(--bg-secondary);
}

:deep(.el-table) {
  --el-table-bg-color: transparent;
  --el-table-tr-bg-color: transparent;
  --el-table-header-bg-color: transparent;
  --el-table-row-hover-bg-color: transparent;
  --el-table-border-color: transparent;
  --el-table-text-color: var(--text-primary);
  --el-table-header-text-color: var(--text-secondary);
  font-size: 13px;
  background: transparent;
}

/* 表头 */
:deep(.el-table th.el-table__cell) {
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: var(--text-tertiary);
  padding: 12px 0;
  background: var(--bg-tertiary) !important;
  border-bottom: 1px solid var(--border-light);
  position: relative;
}

:deep(.el-table th.el-table__cell.is-leaf) {
  border-bottom: 1px solid var(--border-light);
}

/* 表头排序图标 */
:deep(.el-table th.el-table__cell .caret-wrapper) {
  height: 18px;
}

:deep(.el-table th.el-table__cell .sort-caret) {
  border-width: 4px;
}

:deep(.el-table th.el-table__cell .sort-caret.ascending) {
  border-bottom-color: var(--accent, #6b9e7a);
}

:deep(.el-table th.el-table__cell .sort-caret.descending) {
  border-top-color: var(--accent, #6b9e7a);
}

:deep(.el-table .el-table__body-wrapper) {
  background: transparent;
}

/* 行 */
:deep(.el-table .el-table__row) {
  transition: background-color 0.2s var(--ease-smooth);
}

:deep(
  .el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell
) {
  background: rgba(255, 255, 255, 0.015) !important;
}

:deep(
  .el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell
) {
  background-color: var(--glass-bg) !important;
}

/* 单元格 */
:deep(.el-table td.el-table__cell) {
  padding: 10px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.025);
}

:deep(.el-table--striped .el-table__body tr:last-child td.el-table__cell) {
  border-bottom: none;
}

/* 去掉表格底部边框（由外层 .table-wrap 控制） */
:deep(.el-table::before),
:deep(.el-table::after) {
  display: none;
}

.cell-date {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  color: var(--text-secondary);
  font-size: 13px;
}

.model-badge {
  display: inline-block;
  padding: 2px 10px;
  border-radius: 8px;
  background: var(--glass-bg);
  border: 1px solid var(--border-light);
  font-size: 12px;
  color: var(--text-primary);
  font-weight: 500;
  transition: border-color 0.2s var(--ease-smooth);
}

.cell-number {
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  font-size: 13px;
  color: var(--text-primary);
}

.cell-number.hit {
  color: #5b8ff9;
}
.cell-number.miss {
  color: #61ddaa;
}
.cell-number.output {
  color: #f6903d;
}

/* ── 空态 / 加载态 ── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 0;
  gap: 14px;
}

.empty-icon-wrap {
  width: 80px;
  height: 80px;
  border-radius: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-secondary);
  color: var(--text-tertiary);
}

.empty-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.empty-hint {
  font-size: 13px;
  color: var(--text-placeholder);
  text-align: center;
  max-width: 280px;
  line-height: 1.5;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 0;
  gap: 12px;
  color: var(--text-tertiary);
}

.loading-text {
  font-size: 13px;
  color: var(--text-tertiary);
}
</style>
