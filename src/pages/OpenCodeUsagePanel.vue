<template>
  <div
    class="section-card section-card--main glass-surface"
    style="animation-delay: 60ms"
  >
    <!-- 汇总卡片 -->
    <div v-if="filteredItems.length" class="summary-row summary-row--compact">
      <div class="summary-item summary-item--cost">
        <div class="summary-item__icon">
          <el-icon :size="18"><Wallet /></el-icon>
        </div>
        <div class="summary-item__body">
          <span class="summary-label">本月总花费</span>
          <span class="summary-value">{{ formatCost(totalCost) }}</span>
        </div>
      </div>
      <div class="summary-item summary-item--daily">
        <div class="summary-item__icon">
          <el-icon :size="18"><TrendCharts /></el-icon>
        </div>
        <div class="summary-item__body">
          <span class="summary-label">日均花费</span>
          <span class="summary-value">{{ formatCost(avgCost) }}</span>
        </div>
      </div>
    </div>

    <!-- Section header + 筛选栏 -->
    <div class="section-header">
      <h3 class="section-title">每日花费</h3>
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
          <div
            v-if="availableKeyOptions.length > 1"
            class="chart-filters__conditional"
            :class="{ 'is-active': true }"
          >
            <GlassSelect
              v-model="filterKey"
              :options="availableKeyOptions"
              placeholder="全部 Key"
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

    <!-- API3 逐条明细表 -->
    <div
      v-if="viewMode === 'table'"
      class="table-wrap"
      style="max-height: 500px"
    >
      <el-table :data="ocRecords" stripe style="width: 100%" max-height="420">
        <el-table-column label="时间" width="160" align="center">
          <template #default="{ row }">
            <span class="cell-date">{{
              formatRecordTime(row.timeCreated)
            }}</span>
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
          label="输入"
          width="90"
          sortable
          sort-by="inputTokens"
          align="center"
        >
          <template #default="{ row }">
            <span class="cell-number">{{
              formatTokensFull(row.inputTokens)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="输出"
          width="90"
          sortable
          sort-by="outputTokens"
          align="center"
        >
          <template #default="{ row }">
            <span class="cell-number">{{
              formatTokensFull(row.outputTokens)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="推理"
          width="90"
          sortable
          sort-by="reasoningTokens"
          align="center"
        >
          <template #default="{ row }">
            <span class="cell-number">{{
              formatTokensFull(row.reasoningTokens)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="缓存读取"
          width="100"
          sortable
          sort-by="cacheReadTokens"
          align="center"
        >
          <template #default="{ row }">
            <span class="cell-number">{{
              formatTokensFull(row.cacheReadTokens)
            }}</span>
          </template>
        </el-table-column>
        <el-table-column
          label="花费"
          width="100"
          sortable
          sort-by="cost"
          align="center"
        >
          <template #default="{ row }">
            <span class="cell-number cost">{{ formatCost(row.cost) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="API Key" min-width="180" align="center">
          <template #default="{ row }">
            <span class="cell-plan">{{ row.keyName || row.keyID }}</span>
          </template>
        </el-table-column>
      </el-table>
      <div v-if="ocRecordsLoading" class="table-loading">加载中...</div>
      <div v-else-if="ocRecordsTotal > 0" class="table-pagination">
        <span class="table-pagination__total"
          >共 {{ ocRecordsTotal }}{{ ocHasMore ? "+" : "" }} 条记录</span
        >
        <el-pagination
          v-model:current-page="ocRecordsPageNum"
          :page-size="ocRecordsPageSize"
          :total="ocRecordsTotal"
          layout="prev, pager, next"
          :pager-count="5"
          small
          background
        />
      </div>
      <div v-else-if="fetched" class="chart-empty">暂无明细数据</div>
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
      <p class="empty-hint">该月份没有用量记录，请确认已登录 OpenCode</p>
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
import { formatTokensFull, formatCost, formatCostAxis } from "@/utils/format";
import {
  TrendCharts,
  Loading,
  Calendar,
  Filter,
  Wallet,
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
import type { OpenCodeDailyItem, UsagePanelExpose } from "@/types/usage";
import type { OpenCodeKey, OpenCodeUsageRecord } from "@/types/electron";
import { extractOpencodeServerInfo } from "@/utils/provider";

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

const items = ref<OpenCodeDailyItem[]>([]);
const loading = ref(false);
const fetched = ref(false);
const error = ref<string | null>(null);
const viewMode = ref<"chart" | "table">("chart");
const dataMode = ref<"total" | "single">("total");
const filterModel = ref("");
const filterKey = ref("");
const showAdvancedFilters = ref(false);

// OpenCode 专用状态
const ocKeys = ref<OpenCodeKey[]>([]);
const ocRecords = ref<OpenCodeUsageRecord[]>([]);
const ocRecordsLoading = ref(false);
const ocRecordsPageNum = ref(1);
const ocRecordsPageSize = 50;
const ocRecordsTotal = ref(0);
const ocHasMore = ref(false);

const currentModel = computed(() =>
  store.models.find((m) => m.id === props.modelId),
);

const availableModels = computed(() =>
  [...new Set(items.value.map((i) => i.model))].sort(),
);
const availableModelOptions = computed(() =>
  availableModels.value.map((m) => ({ label: m, value: m })),
);
const availableKeyOptions = computed(() => [
  { label: "全部 Key", value: "" },
  ...ocKeys.value
    .filter((k) => !k.deleted)
    .map((k) => ({ label: k.displayName, value: k.id })),
]);

const dataModeOptions = [
  { label: "总消耗", value: "total" },
  { label: "单模型", value: "single" },
];

const viewModeOptions = [
  { label: "图表", value: "chart" },
  { label: "列表", value: "table" },
];

const filteredItems = computed(() => {
  let result = items.value;
  if (dataMode.value === "single" && filterModel.value) {
    result = result.filter((i) => i.model === filterModel.value);
  }
  if (filterKey.value) {
    result = result.filter((i) => i.keyId === filterKey.value);
  }
  return result;
});

const totalCost = computed(() =>
  filteredItems.value.reduce((s, i) => s + i.totalCost, 0),
);
const avgCost = computed(() => {
  const days = new Set(filteredItems.value.map((i) => i.date)).size;
  return days > 0 ? Math.round(totalCost.value / days) : 0;
});

// OpenCode 模型色板
const ocModelColors = [
  [139, 92, 246], // 紫
  [59, 130, 246], // 蓝
  [16, 185, 129], // 绿
  [245, 158, 11], // 橙
  [239, 68, 68], // 红
  [236, 72, 153], // 粉
  [20, 184, 166], // 青
  [168, 85, 247], // 亮紫
];

const chartOption = computed(() => {
  const c = colors.value;
  const allDays = getMonthDays(props.selectedMonth);
  const dayLabels = allDays.map((d) => d.slice(5));

  const models = [...new Set(filteredItems.value.map((i) => i.model))].sort();
  const seriesDefs = models.map((modelName, idx) => {
    const rgb = ocModelColors[idx % ocModelColors.length];
    const modelItems = filteredItems.value.filter((i) => i.model === modelName);
    const dayCostMap = new Map<string, number>();
    for (const item of modelItems) {
      dayCostMap.set(
        item.date,
        (dayCostMap.get(item.date) || 0) + item.totalCost,
      );
    }
    return {
      name: modelName,
      data: allDays.map((d) => dayCostMap.get(d) || 0),
      topColor: `rgba(${rgb.join(",")},0.92)`,
      bottomColor: `rgba(${rgb.join(",")},0.35)`,
      fadeColor: `rgba(${rgb.join(",")},0.03)`,
    };
  });

  const series = seriesDefs.map((def) => ({
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
  }));

  const colorMap = Object.fromEntries(
    seriesDefs.map((def) => [def.name, def.topColor]),
  );

  return {
    ...buildTooltipShell(c, false),
    tooltip: {
      ...buildTooltipShell(c, false),
      formatter(params: unknown) {
        const p = params as Array<{
          axisValue: string;
          value: number;
          seriesName: string;
          color: string;
        }>;
        const date = p[0]?.axisValue;
        const [yearStr] = props.selectedMonth.split('-');
        const fullDate = `${yearStr}-${date}`; // 转换为完整日期格式
        const total = p.reduce((s, item) => s + item.value, 0);
        // 没有数据的日期不显示tooltip
        if (total === 0) return '';

        // 从 ocRecords 中获取该日期的 token 汇总数据
        const dayRecords = ocRecords.value.filter((r) => r.timeCreated && r.timeCreated.startsWith(fullDate));
        const totalTokens = dayRecords.reduce((s, r) => s + (r.inputTokens || 0) + (r.outputTokens || 0) + (r.reasoningTokens || 0) + (r.cacheReadTokens || 0), 0);
        const inputTokens = dayRecords.reduce((s, r) => s + (r.inputTokens || 0), 0);
        const outputTokens = dayRecords.reduce((s, r) => s + (r.outputTokens || 0), 0);

        const lines = p.map((item) => {
          const dotColor = colorMap[item.seriesName] || item.color;
          return `<span style="display:inline-block;width:8px;height:8px;border-radius:2px;background:${dotColor};margin-right:6px"></span>${item.seriesName}: <b>${formatCost(item.value)}</b>`;
        });

        // 构建 token 信息行
        const tokenInfo =
          totalTokens > 0
            ? `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.1);font-size:11px;color:${c.axisColor}">
              <div>Token 总量: <b style="color:${c.tooltipText}">${formatTokensFull(totalTokens)}</b></div>
              <div style="margin-top:4px">输入: ${formatTokensFull(inputTokens)} | 输出: ${formatTokensFull(outputTokens)}</div>
            </div>`
            : "";

        return `<div style="font-weight:600;margin-bottom:6px;font-size:13px">${date}<span style="float:right;margin-left:16px;color:${c.axisColor}">${formatCost(total)}</span></div>${lines.join("<br/>")}${tokenInfo}`;
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
      boundaryGap: true,
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
        formatter: (v: number) => formatCostAxis(v),
      },
      splitLine: {
        lineStyle: { color: c.splitLineColor, type: "dashed" as const },
      },
    },
    dataZoom: buildDataZoom(c),
    series,
  };
});

function formatRecordTime(isoStr: string): string {
  if (!isoStr) return "-";
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return isoStr;
  }
}

function onDataModeChange() {
  filterModel.value = availableModels.value.length
    ? availableModels.value[0]
    : "";
}

async function fetchRecords(page: number) {
  const model = currentModel.value;
  if (!model || model.provider !== "opencode" || !model.cookies) return;

  const info = extractOpencodeServerInfo(model, 'records');
  if (!info) return;

  const { workspaceId, serverId, serverInstance } = info;

  const body = JSON.stringify({
    t: {
      t: 9,
      i: 0,
      l: 2,
      a: [
        { t: 1, s: workspaceId },
        { t: 0, s: page },
      ],
      o: 0,
    },
    f: 31,
    m: [],
  });

  ocRecordsLoading.value = true;
  try {
    const res = await window.electronAPI.fetchOpenCodeUsageRecords({
      cookies: model.cookies,
      serverId,
      serverInstance,
      body,
    });
    const batch = (res.records ?? []) as OpenCodeUsageRecord[];
    ocRecords.value = batch.map((r) => ({
      ...r,
      keyName:
        ocKeys.value.find((k) => k.id === r.keyID)?.displayName || r.keyID,
    }));
    // 根据返回数量推算总数：不满一页说明是最后一页
    if (batch.length < ocRecordsPageSize) {
      ocRecordsTotal.value = page * ocRecordsPageSize + batch.length;
      ocHasMore.value = false;
    } else {
      // 满页，至少还有下一页
      ocRecordsTotal.value = (page + 1) * ocRecordsPageSize + 1;
      ocHasMore.value = true;
    }
  } catch (e: unknown) {
    ocRecords.value = [];
    const err = e as { code?: string };
    if (err?.code !== "COOKIE_EXPIRED") {
      console.error("[OpenCodeUsagePanel] API3 error:", e);
    }
  } finally {
    ocRecordsLoading.value = false;
  }
}

async function fetchData() {
  if (loading.value) return;
  const model = currentModel.value;
  if (!model || model.provider !== "opencode" || !model.cookies) return;

  const [yearStr, monthStr] = props.selectedMonth.split("-");
  const year = Number(yearStr);
  const month = Number(monthStr);

  const info = extractOpencodeServerInfo(model, 'daily');
  if (!info) {
    items.value = [];
    fetched.value = true;
    return;
  }

  const { workspaceId, serverId, serverInstance } = info;

  // 动态构造时区偏移
  const offsetMin = -new Date().getTimezoneOffset();
  const sign = offsetMin >= 0 ? "+" : "-";
  const absMin = Math.abs(offsetMin);
  const tzH = String(Math.floor(absMin / 60)).padStart(2, "0");
  const tzM = String(absMin % 60).padStart(2, "0");
  const timezone = `${sign}${tzH}:${tzM}`;

  const body = JSON.stringify({
    t: {
      t: 9,
      i: 0,
      l: 4,
      a: [
        { t: 1, s: workspaceId },
        { t: 0, s: year },
        { t: 0, s: month - 1 },
        { t: 1, s: timezone },
      ],
      o: 0,
    },
    f: 31,
    m: [],
  });

  loading.value = true;
  emit("update:loading", true);
  fetched.value = false;
  error.value = null;
  try {
    const res = await window.electronAPI.fetchOpenCodeUsageDetail({
      cookies: model.cookies,
      serverId,
      serverInstance,
      body,
    });
    const monthPrefix = `${year}-${monthStr}`;
    ocKeys.value = res.keys ?? [];
    const monthItems: OpenCodeDailyItem[] = [];

    for (const item of res.usage ?? []) {
      if (!item.date.startsWith(monthPrefix)) continue;
      const keyInfo = ocKeys.value.find((k) => k.id === item.keyId);
      const inputTokens = item.inputTokens || 0;
      const outputTokens = item.outputTokens || 0;
      const reasoningTokens = item.reasoningTokens || 0;
      const cacheReadTokens = item.cacheReadTokens || 0;
      monthItems.push({
        date: item.date,
        model: item.model,
        provider: "opencode",
        totalCost: item.totalCost,
        keyId: item.keyId,
        keyName: keyInfo?.displayName || item.keyId,
        plan: item.plan,
        inputTokens,
        outputTokens,
        reasoningTokens,
        cacheReadTokens,
        totalTokens:
          inputTokens + outputTokens + reasoningTokens + cacheReadTokens,
      });
    }
    items.value = monthItems.sort((a, b) => a.date.localeCompare(b.date));
    fetchRecords(0);
  } catch (e: unknown) {
    items.value = [];
    const err = e as { code?: string };
    if (err?.code === "COOKIE_EXPIRED") {
      error.value = "登录已过期，请重新配置 Cookie";
    } else {
      console.error("[OpenCodeUsagePanel] fetch error:", e);
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
      filterKey.value = "";
      ocKeys.value = [];
      ocRecords.value = [];
      ocRecordsPageNum.value = 1;
      ocRecordsTotal.value = 0;
      dataMode.value = "total";
      viewMode.value = "chart";
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
      filterKey.value = "";
      ocKeys.value = [];
      ocRecords.value = [];
      ocRecordsPageNum.value = 1;
      ocRecordsTotal.value = 0;
      viewMode.value = "chart";
      fetchData();
    }
  },
);

// 分页切换时请求对应页（跳过初始化阶段）
watch(ocRecordsPageNum, (newPage) => {
  if (ocKeys.value.length > 0 && !ocRecordsLoading.value) {
    fetchRecords(newPage - 1);
  }
});
</script>

<style scoped>
@import "@/styles/usage-shared.css";

/* OpenCode 供应商特定颜色 */
.summary-item--cost::before {
  background: rgba(139, 92, 246, 0.8);
}
.summary-item--cost::after {
  background: rgba(139, 92, 246, 1);
}
.summary-item--cost .summary-item__icon {
  color: rgba(139, 92, 246, 0.9);
  background: rgba(139, 92, 246, 0.08);
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

.cell-number.cost {
  color: #8b5cf6;
}

/* 列表视图：确保表格内部滚动 */
.table-wrap {
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.table-wrap :deep(.el-table) {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

.table-wrap :deep(.el-table__body-wrapper) {
  overflow: auto;
}
</style>
