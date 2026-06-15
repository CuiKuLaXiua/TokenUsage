<template>
  <div class="export-page">
    <!-- 套餐上下文栏 -->
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
    </div>

    <!-- 不支持的 provider -->
    <div
      v-if="selectedModelId && !supportsExport"
      class="section-card glass-surface"
      style="animation-delay: 60ms"
    >
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <el-icon :size="48"><Download /></el-icon>
        </div>
        <p class="empty-text">暂不支持该模型</p>
        <p class="empty-hint">
          当前仅支持 MiMo 和 OpenCode 模型的数据导出，其他模型后续迭代
        </p>
      </div>
    </div>

    <!-- 未选择模型 -->
    <div
      v-if="!selectedModelId"
      class="section-card glass-surface"
      style="animation-delay: 60ms"
    >
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <el-icon :size="48"><Download /></el-icon>
        </div>
        <p class="empty-text">请先选择套餐</p>
        <p class="empty-hint">选择一个套餐后即可配置导出选项</p>
      </div>
    </div>

    <!-- 导出配置卡片 -->
    <div
      v-if="supportsExport"
      class="section-card glass-surface export-config"
      style="animation-delay: 60ms"
    >
      <div class="section-header">
        <h3 class="section-title">导出配置</h3>
      </div>

      <div class="config-body">
        <!-- 月份选择 -->
        <div class="config-row">
          <span class="config-label">月份</span>
          <GlassMonthPicker
            v-model="selectedMonth"
            placeholder="选择月份"
          >
            <template #prefix-icon>
              <el-icon :size="14"><Calendar /></el-icon>
            </template>
          </GlassMonthPicker>
        </div>

        <!-- 数据类型 -->
        <div class="config-row">
          <span class="config-label">数据类型</span>
          <div class="config-options">
            <button
              v-for="opt in availableDataTypes"
              :key="opt.value"
              class="option-chip"
              :class="{ active: exportType === opt.value }"
              @click="exportType = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
        </div>

        <!-- OpenCode 逐条记录：Key 筛选 -->
        <div v-if="isOpencode && exportType === 'records' && ocKeys.length > 1" class="config-row">
          <span class="config-label">API Key</span>
          <GlassSelect
            v-model="filterKeyId"
            :options="keyOptions"
            placeholder="全部 Key"
            size="small"
            :matchWidth="false"
          >
            <template #prefix-icon>
              <el-icon :size="14"><Filter /></el-icon>
            </template>
          </GlassSelect>
        </div>

        <!-- 导出格式 -->
        <div class="config-row">
          <span class="config-label">格式</span>
          <span class="config-value">CSV</span>
        </div>
      </div>

      <!-- 导出按钮 -->
      <div class="config-footer">
        <button
          class="btn-primary"
          :disabled="exporting"
          @click="handleExport"
        >
          <el-icon v-if="exporting" class="spin"><Loading /></el-icon>
          <el-icon v-else><Download /></el-icon>
          <span>{{ exporting ? '导出中...' : '导出 CSV' }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { Download, Cpu, Calendar, Filter, Loading } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import GlassSelect from '@/components/GlassSelect.vue'
import GlassMonthPicker from '@/components/GlassMonthPicker.vue'
import type { ModelConfig } from '@/stores/app'
import type { MimoTokenPlanItem, OpenCodeUsageItem, OpenCodeKey, OpenCodeUsageRecord } from '@/types/electron'
import { arrayToCsv, downloadCsv } from '@/utils/export'
import { formatCost } from '@/utils/format'

const store = useAppStore()

const now = new Date()
const selectedMonth = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
)
const selectedModelId = ref('')
const exportType = ref<'mimo-daily' | 'oc-daily' | 'records'>('mimo-daily')
const filterKeyId = ref('')
const exporting = ref(false)

// ── 模型相关 ──

const currentModel = computed(() =>
  store.models.find((m) => m.id === selectedModelId.value),
)
const isMimo = computed(() => currentModel.value?.provider === 'mimo')
const isOpencode = computed(() => currentModel.value?.provider === 'opencode')
const supportsExport = computed(() => isMimo.value || isOpencode.value)

const providerColors: Record<string, string> = {
  mimo: '#d4a855',
  kimi: '#b8a088',
  deepseek: '#7cc48a',
  opencode: '#6b9e7a',
}
function providerColor(p: string) {
  return providerColors[p] || 'var(--text-tertiary)'
}

const modelOptions = computed(() =>
  store.models.map((m) => ({
    label: m.name,
    value: m.id,
    provider: m.provider,
  })),
)

// ── 数据类型选项 ──

interface DataTypeOption {
  label: string
  value: 'mimo-daily' | 'oc-daily' | 'records'
}

const mimoDataTypes: DataTypeOption[] = [
  { label: '每日用量汇总', value: 'mimo-daily' },
]

const opencodeDataTypes: DataTypeOption[] = [
  { label: '每日花费汇总', value: 'oc-daily' },
  { label: '逐条调用记录', value: 'records' },
]

const availableDataTypes = computed(() =>
  isMimo.value ? mimoDataTypes : opencodeDataTypes,
)

// ── OpenCode Key 筛选 ──

const ocKeys = ref<OpenCodeKey[]>([])

const keyOptions = computed(() => [
  { label: '全部 Key', value: '' },
  ...ocKeys.value
    .filter((k) => !k.deleted)
    .map((k) => ({ label: k.displayName, value: k.id })),
])

// ── 切换模型时重置 ──

watch(selectedModelId, () => {
  if (isMimo.value) {
    exportType.value = 'mimo-daily'
  } else {
    exportType.value = 'oc-daily'
  }
  filterKeyId.value = ''
  ocKeys.value = []
})

onMounted(() => {
  if (store.models.length && !selectedModelId.value) {
    selectedModelId.value = store.models[0].id
  }
})

watch(
  () => store.isConfigLoaded,
  (v) => {
    if (v && store.models.length && !selectedModelId.value) {
      selectedModelId.value = store.models[0].id
    }
  },
)

// ── OpenCode 参数提取（复用 OpenCodeUsagePanel 模式）──

function extractOpencodeParams(model: ModelConfig) {
  let workspaceId = ''
  if (model.baseUrl) {
    try {
      const u = new URL(model.baseUrl)
      const argsStr = u.searchParams.get('args') || ''
      if (argsStr) {
        const args = JSON.parse(argsStr)
        workspaceId = args?.t?.a?.[0]?.s || ''
      }
    } catch {}
  }

  // 汇总用 dailyServerId，逐条用 recordsServerId
  const dailyServerId = model.dailyServerId || model.serverId || ''
  const recordsServerId = model.recordsServerId || model.dailyServerId || model.serverId || ''

  let fallbackServerId = ''
  if (model.baseUrl) {
    try {
      const u = new URL(model.baseUrl)
      fallbackServerId = u.searchParams.get('id') || ''
    } catch {}
  }

  return {
    workspaceId,
    dailyServerId: dailyServerId || fallbackServerId,
    recordsServerId: recordsServerId || fallbackServerId,
    dailyServerInstance: model.dailyServerInstance || model.serverInstance || model.postServerInstance || '',
    recordsServerInstance: model.recordsServerInstance || model.dailyServerInstance || model.serverInstance || '',
  }
}

// ── 数据获取 ──

async function fetchMimoData(model: ModelConfig, year: number, month: number): Promise<MimoTokenPlanItem[]> {
  const res = await window.electronAPI.fetchMimoTokenPlan({
    year,
    month,
    cookies: model.cookies,
  })
  if (res.code !== 0 || !res.data) return []
  return res.data
}

async function fetchOpencodeSummary(model: ModelConfig, year: number, month: number): Promise<{ items: OpenCodeUsageItem[]; keys: OpenCodeKey[] }> {
  const params = extractOpencodeParams(model)
  if (!params.workspaceId || !params.dailyServerId) {
    throw new Error('缺少 serverId 或 workspaceId，请检查配置')
  }

  const monthStr = String(month).padStart(2, '0')
  const offsetMin = -new Date().getTimezoneOffset()
  const sign = offsetMin >= 0 ? '+' : '-'
  const absMin = Math.abs(offsetMin)
  const tzH = String(Math.floor(absMin / 60)).padStart(2, '0')
  const tzM = String(absMin % 60).padStart(2, '0')
  const timezone = `${sign}${tzH}:${tzM}`

  const body = JSON.stringify({
    t: {
      t: 9,
      i: 0,
      l: 4,
      a: [
        { t: 1, s: params.workspaceId },
        { t: 0, s: year },
        { t: 0, s: month - 1 },
        { t: 1, s: timezone },
      ],
      o: 0,
    },
    f: 31,
    m: [],
  })

  const res = await window.electronAPI.fetchOpenCodeUsageDetail({
    cookies: model.cookies,
    serverId: params.dailyServerId,
    serverInstance: params.dailyServerInstance,
    body,
  })

  const monthPrefix = `${year}-${monthStr}`
  const items = (res.usage ?? []).filter((item) => item.date.startsWith(monthPrefix))
  const keys = res.keys ?? []

  // 缓存 keys 供后续筛选使用
  ocKeys.value = keys

  return { items, keys }
}

async function fetchOpencodeRecords(model: ModelConfig): Promise<OpenCodeUsageRecord[]> {
  const params = extractOpencodeParams(model)
  if (!params.workspaceId || !params.recordsServerId) {
    throw new Error('缺少 serverId 或 workspaceId，请检查配置')
  }

  const allRecords: OpenCodeUsageRecord[] = []
  const pageSize = 50
  let page = 0
  let hasMore = true

  while (hasMore) {
    const body = JSON.stringify({
      t: {
        t: 9,
        i: 0,
        l: 2,
        a: [
          { t: 1, s: params.workspaceId },
          { t: 0, s: page },
        ],
        o: 0,
      },
      f: 31,
      m: [],
    })

    const res = await window.electronAPI.fetchOpenCodeUsageRecords({
      cookies: model.cookies,
      serverId: params.recordsServerId,
      serverInstance: params.recordsServerInstance,
      body,
    })

    const batch = (res.records ?? []) as OpenCodeUsageRecord[]
    allRecords.push(...batch)

    if (batch.length < pageSize) {
      hasMore = false
    } else {
      page++
    }
  }

  return allRecords
}

// ── 导出逻辑 ──

async function handleExport() {
  const model = currentModel.value
  if (!model) return

  const [yearStr, monthStr] = selectedMonth.value.split('-')
  const year = Number(yearStr)
  const month = Number(monthStr)

  exporting.value = true
  try {
    let csvContent = ''
    let defaultFilename = ''

    if (isMimo.value) {
      const data = await fetchMimoData(model, year, month)
      if (!data.length) {
        ElMessage.warning('该月份暂无数据')
        return
      }

      csvContent = arrayToCsv(data, [
        { key: 'date', label: '日期' },
        { key: 'model', label: '模型' },
        { key: 'totalToken', label: '总Token' },
        { key: 'inputHitToken', label: '输入命中' },
        { key: 'inputMissToken', label: '输入未命中' },
        { key: 'outputToken', label: '输出' },
        { key: 'requestCount', label: '请求数' },
      ])
      defaultFilename = `token-usage-mimo-${selectedMonth.value}.csv`
    } else if (isOpencode.value) {
      if (exportType.value === 'oc-daily') {
        const { items, keys } = await fetchOpencodeSummary(model, year, month)
        if (!items.length) {
          ElMessage.warning('该月份暂无数据')
          return
        }

        const enriched = items.map((item) => {
          const keyInfo = keys.find((k) => k.id === item.keyId)
          return {
            ...item,
            keyName: keyInfo?.displayName || item.keyId,
            totalTokens: (item.inputTokens || 0) + (item.outputTokens || 0) + (item.reasoningTokens || 0) + (item.cacheReadTokens || 0),
          }
        })

        csvContent = arrayToCsv(enriched, [
          { key: 'date', label: '日期' },
          { key: 'model', label: '模型' },
          { key: 'totalCost', label: '总花费(原始值)', format: (v: number) => v ?? 0 },
          { key: 'totalCost', label: '总花费($)', format: (v: number) => (v / 1e8).toFixed(4) },
          { key: 'inputTokens', label: '输入Token' },
          { key: 'outputTokens', label: '输出Token' },
          { key: 'reasoningTokens', label: '推理Token' },
          { key: 'cacheReadTokens', label: '缓存读取' },
          { key: 'totalTokens', label: '总Token' },
          { key: 'keyName', label: 'Key名称' },
          { key: 'plan', label: '套餐' },
        ])
        defaultFilename = `token-usage-opencode-daily-${selectedMonth.value}.csv`
      } else {
        // 逐条记录
        let records = await fetchOpencodeRecords(model)

        // 应用 Key 筛选
        if (filterKeyId.value) {
          records = records.filter((r) => r.keyID === filterKeyId.value)
        }

        if (!records.length) {
          ElMessage.warning('暂无调用记录')
          return
        }

        // 用缓存的 keys 补充 keyName
        const keys = ocKeys.value
        const enriched = records.map((r) => ({
          ...r,
          keyName: keys.find((k) => k.id === r.keyID)?.displayName || r.keyID || '',
        }))

        csvContent = arrayToCsv(enriched, [
          { key: 'timeCreated', label: '时间' },
          { key: 'model', label: '模型' },
          { key: 'inputTokens', label: '输入Token' },
          { key: 'outputTokens', label: '输出Token' },
          { key: 'reasoningTokens', label: '推理Token' },
          { key: 'cacheReadTokens', label: '缓存读取' },
          { key: 'cost', label: '花费(原始值)' },
          { key: 'cost', label: '花费($)', format: (v: number) => (v / 1e8).toFixed(4) },
          { key: 'keyName', label: 'API Key' },
          { key: 'keyID', label: 'Key ID' },
          { key: 'plan', label: '套餐' },
        ])
        defaultFilename = `token-usage-opencode-records-${selectedMonth.value}.csv`
      }
    }

    if (!csvContent) return

    const saved = await downloadCsv(csvContent, defaultFilename)
    if (saved) {
      ElMessage.success('导出成功')
    }
  } catch (e: unknown) {
    const err = e as { code?: string; message?: string }
    if (err?.code === 'COOKIE_EXPIRED') {
      ElMessage.error('登录已过期，请重新配置 Cookie')
    } else {
      console.error('[Export] error:', e)
      ElMessage.error(err?.message || '导出失败，请检查网络后重试')
    }
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.export-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding-bottom: 20px;
  overflow-y: auto;
  flex: 1;
  max-height: 100vh;
}

.section-card {
  padding: 20px 24px;
  border-radius: 16px;
  flex-shrink: 0;
}

/* ── 套餐上下文栏 ── */
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

/* ── 模型选项 ── */
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

/* ── 空态 ── */
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

/* ── 导出配置卡片 ── */
.export-config .section-header {
  margin-bottom: 20px;
}

.section-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.config-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.config-row {
  display: flex;
  align-items: center;
  gap: 16px;
}

.config-label {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  width: 72px;
  flex-shrink: 0;
  text-align: right;
}

.config-value {
  font-size: 13px;
  color: var(--text-tertiary);
  font-weight: 500;
  padding: 6px 12px;
  background: var(--glass-bg);
  border-radius: 8px;
}

.config-options {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.option-chip {
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-smooth);
}

.option-chip:hover {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.option-chip.active {
  background: var(--accent-glow);
  color: var(--accent);
  border-color: var(--accent);
}

/* ── 导出按钮 ── */
.config-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
}

.btn-primary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 24px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-smooth);
}

.btn-primary:hover:not(:disabled) {
  opacity: 0.9;
  box-shadow: 0 4px 20px var(--accent-glow);
  transform: translateY(-1px);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
}

.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
