<template>
  <div
    class="section-card section-card--main glass-surface"
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
          <span class="summary-value">{{ formatTokensFull(totalTokens) }}</span>
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
          <span class="summary-value">{{ formatTokensFull(totalOutput) }}</span>
        </div>
      </div>
    </div>

    <!-- Section header + 筛选栏 -->
    <div class="section-header">
      <h3 class="section-title">每日 Token 消耗</h3>
      <div class="chart-filters">
        <GlassMonthPicker
          :model-value="selectedMonth"
          placeholder="选择月份"
          @update:model-value="emit('update:selectedMonth', $event)"
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
        <button
          class="chart-filters__toggle"
          :class="{ 'is-active': showAdvancedFilters }"
          title="高级筛选"
          @click="showAdvancedFilters = !showAdvancedFilters"
        >
          <el-icon :size="14"><Setting /></el-icon>
        </button>
      </div>
      <Transition name="filters-expand">
        <div v-show="showAdvancedFilters" class="chart-filters-advanced">
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
      </Transition>
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
        max-height="500"
      >
        <el-table-column
          prop="date"
          label="日期"
          width="130"
          sortable
          align="center"
        >
          <template #default="{ row }">
            <span class="cell-date">{{ row.date }}</span>
          </template>
        </el-table-column>
        <el-table-column
          prop="model"
          label="模型"
          min-width="140"
          align="center"
        >
          <template #default="{ row }">
            <span class="model-badge">{{ row.model }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="总 Token"
          min-width="130"
          sortable
          sort-by="totalToken"
          align="center"
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
          align="center"
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
          align="center"
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
          align="center"
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
          align="center"
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

  <!-- 错误态 -->
  <div
    v-if="error && !loading"
    class="section-card glass-surface"
    style="animation-delay: 0ms"
  >
    <div class="error-state">
      <div class="error-icon-wrap">
        <el-icon :size="48"><CircleCloseFilled /></el-icon>
      </div>
      <p class="error-text">{{ error }}</p>
      <button class="btn-primary btn-sm" @click="fetchData">重新加载</button>
    </div>
  </div>

  <!-- 空态 -->
  <div
    v-if="!loading && !items.length && fetched && !error"
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
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useAppStore } from "@/stores/app";
import { formatTokensFull, formatTokensAxis } from "@/utils/format";
import {
  TrendCharts,
  Loading,
  Calendar,
  Filter,
  Coin,
  DataAnalysis,
  Upload,
  CircleCloseFilled,
  Setting,
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
import GlassMonthPicker from "@/components/GlassMonthPicker.vue";
import GlassSelect from "@/components/GlassSelect.vue";
import ToggleGroup from "@/components/ToggleGroup.vue";
import { useChartTheme } from "@/composables/useChartTheme";
import { getMonthDays } from "@/composables/useMonthDays";
import type { MimoDailyItem, UsagePanelExpose } from "@/types/usage";

use([
  BarChart,
  LineChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  DataZoomComponent,
  CanvasRenderer,
]);

const props = defineProps<{
  selectedMonth: string;
  modelId: string;
}>();

const emit = defineEmits<{
  (e: "update:loading", value: boolean): void;
  (e: "update:selectedMonth", value: string): void;
}>();

const store = useAppStore();
const { colors, buildDataZoom, buildTooltipShell } = useChartTheme();

const items = ref<MimoDailyItem[]>([]);
const loading = ref(false);
const fetched = ref(false);
const error = ref<string | null>(null);
const viewMode = ref<"chart" | "table">("chart");
const dataMode = ref<"total" | "single">("total");
const chartStyle = ref<"bar" | "area">("bar");
const filterModel = ref("");
const showAdvancedFilters = ref(false);

const currentModel = computed(() =>
  store.models.find((m) => m.id === props.modelId),
);

const availableModels = computed(() =>
  [...new Set(items.value.map((i) => i.model))].sort(),
);
const availableModelOptions = computed(() =>
  availableModels.value.map((m) => ({ label: m, value: m })),
);

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

const chartOption = computed(() => {
  const c = colors.value;
  const allDays = getMonthDays(props.selectedMonth);
  const dayLabels = allDays.map((d) => d.slice(5));
  const dataMap = new Map<string, MimoDailyItem[]>();
  for (const item of filteredItems.value) {
    const arr = dataMap.get(item.date) || [];
    arr.push(item);
    dataMap.set(item.date, arr);
  }
  const sumField = (date: string, field: keyof MimoDailyItem) => {
    const arr = dataMap.get(date) || [];
    return arr.reduce((s, i) => s + ((i[field] as number) || 0), 0);
  };

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

  const colorMap: Record<string, string> = {
    输入命中: "rgba(91,143,249,0.92)",
    输入未命中: "rgba(97,221,170,0.92)",
    输出: "rgba(246,144,61,0.92)",
  };

  return {
    ...buildTooltipShell(c, isArea),
    tooltip: {
      ...buildTooltipShell(c, isArea),
      formatter(params: unknown) {
        const p = params as Array<{
          axisValue: string;
          value: number;
          seriesName: string;
          color: string;
        }>;
        const date = p[0]?.axisValue;
        const total = p.reduce((s, item) => s + item.value, 0);
        // 没有数据的日期不显示tooltip
        if (total === 0) return '';
        const lines = p.map((item) => {
          const dotColor = colorMap[item.seriesName] || item.color;
          return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${dotColor};margin-right:6px"></span>${item.seriesName}: <b>${item.value.toLocaleString()}</b>`;
        });
        return `<div style="font-weight:600;margin-bottom:6px;font-size:13px">${date}<span style="float:right;margin-left:16px;color:${c.axisColor}">${total.toLocaleString()}</span></div>${lines.join("<br/>")}`;
      },
    },
    legend: {
      top: 4,
      right: 8,
      itemWidth: 12,
      itemHeight: 8,
      itemGap: 16,
      textStyle: { color: c.axisColor, fontSize: 11 },
    },
    grid: { left: 62, right: 16, top: 44, bottom: 42 },
    xAxis: {
      type: "category" as const,
      data: dayLabels,
      boundaryGap: !isArea,
      axisLabel: {
        color: c.axisColor,
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
        color: c.axisColor,
        fontSize: 10,
        formatter: (v: number) => formatTokensAxis(v),
      },
      splitLine: {
        lineStyle: { color: c.splitLineColor, type: "dashed" as const },
      },
    },
    dataZoom: buildDataZoom(c),
    series,
  };
});

function onDataModeChange() {
  filterModel.value = availableModels.value.length
    ? availableModels.value[0]
    : "";
}

async function fetchData() {
  if (loading.value) return;
  const model = currentModel.value;
  if (!model || model.provider !== "mimo" || !model.cookies) return;

  const [yearStr, monthStr] = props.selectedMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  loading.value = true;
  emit("update:loading", true);
  fetched.value = false;
  error.value = null;
  try {
    const res = await window.electronAPI.fetchMimoTokenPlan({
      year,
      month,
      cookies: model.cookies,
    });
    items.value =
      res.code === 0
        ? (res.data ?? []).map((item) => ({
            ...item,
            provider: "mimo" as const,
          }))
        : [];
  } catch (e: unknown) {
    items.value = [];
    const err = e as { code?: string };
    if (err?.code === "COOKIE_EXPIRED") {
      error.value = "登录已过期，请重新配置 Cookie";
    } else {
      console.error("[MimoUsagePanel] fetch error:", e);
      error.value = "数据加载失败，请检查网络后重试";
    }
  } finally {
    loading.value = false;
    emit("update:loading", false);
    fetched.value = true;
  }
}

function refresh() {
  fetchData();
}

defineExpose<UsagePanelExpose>({ refresh });

watch(
  () => props.modelId,
  () => {
    if (props.modelId) {
      items.value = [];
      fetched.value = false;
      error.value = null;
      filterModel.value = "";
      dataMode.value = "total";
      fetchData();
    }
  },
  { immediate: true },
);

watch(
  () => props.selectedMonth,
  () => {
    if (props.modelId && fetched.value) {
      items.value = [];
      fetched.value = false;
      error.value = null;
      filterModel.value = "";
      fetchData();
    }
  },
);
</script>

<style scoped>
@import "@/styles/usage-shared.css";

/* MiMo 供应商特定颜色 */
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

.cell-number.hit {
  color: #5b8ff9;
}
.cell-number.miss {
  color: #61ddaa;
}
.cell-number.output {
  color: #f6903d;
}
</style>
