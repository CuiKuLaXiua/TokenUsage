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
      <IconButton :icon="Refresh" :loading="panelLoading" @click="fetchData" />
    </div>

    <!-- 不支持的 provider -->
    <div
      v-if="!supportsDetail && selectedModelId"
      class="section-card glass-surface"
      style="animation-delay: 0ms"
    >
      <div class="empty-state">
        <div class="empty-icon-wrap">
          <el-icon :size="48"><TrendCharts /></el-icon>
        </div>
        <p class="empty-text">暂不支持该模型</p>
        <p class="empty-hint">
          当前仅支持 MiMo 和 OpenCode 模型的用量详情查询，其他模型后续迭代
        </p>
      </div>
    </div>

    <!-- 供应商面板派发 -->
    <MimoUsagePanel
      v-if="isMimo"
      ref="panelRef"
      v-model:selected-month="selectedMonth"
      :model-id="selectedModelId"
      @update:loading="panelLoading = $event"
    />
    <OpenCodeUsagePanel
      v-if="isOpenCode"
      ref="panelRef"
      v-model:selected-month="selectedMonth"
      :model-id="selectedModelId"
      @update:loading="panelLoading = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { TrendCharts, Refresh, Cpu } from '@element-plus/icons-vue'
import GlassSelect from '@/components/GlassSelect.vue'
import IconButton from '@/components/IconButton.vue'
import MimoUsagePanel from '@/pages/MimoUsagePanel.vue'
import OpenCodeUsagePanel from '@/pages/OpenCodeUsagePanel.vue'
import type { UsagePanelExpose } from '@/types/usage'

const store = useAppStore()

const now = new Date()
const selectedMonth = ref(
  `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
)
const selectedModelId = ref('')
const panelLoading = ref(false)
const panelRef = ref<UsagePanelExpose>()

const currentModel = computed(() =>
  store.models.find((m) => m.id === selectedModelId.value),
)
const isMimo = computed(() => currentModel.value?.provider === 'mimo')
const isOpenCode = computed(() => currentModel.value?.provider === 'opencode')
const supportsDetail = computed(() => isMimo.value || isOpenCode.value)

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

function onModelChange() {
  // v-if 切换会自动销毁旧面板、创建新面板
  // 新面板 onMounted 会自动 fetchData
}

function fetchData() {
  panelRef.value?.refresh()
}

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
</script>

<style scoped>
.usage-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
  min-height: 0;
  padding-bottom: 20px;
  overflow-y: auto;        /* 启用垂直滚动 */
  flex: 1;                 /* 填满父容器剩余空间 */
  max-height: 100vh;       /* 限制最大高度为视口高度 */
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

/* ── 不支持的 provider 空态 ── */
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
</style>
