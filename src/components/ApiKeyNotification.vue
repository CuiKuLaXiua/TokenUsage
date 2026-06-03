<template>
  <div>
    <Transition name="notification-fade">
      <div v-if="visible" class="api-key-notification" @click="handleClick">
        <div class="notification-content">
          <div class="notification-icon">
            <el-icon :size="20"><WarningFilled /></el-icon>
          </div>
          <div class="notification-text">
            <div class="notification-title">API Key 已失效</div>
            <div class="notification-message">
              <template v-if="failedModels.length === 1">
                {{ failedModels[0].name }} 的 API key 已失效
              </template>
              <template v-else>
                {{ failedModels.length }} 个模型的 API key 已失效
              </template>
            </div>
          </div>
          <div class="notification-actions">
            <button class="btn-update" @click.stop="handleUpdate">
              <el-icon :size="14"><Edit /></el-icon>
              <span>更新</span>
            </button>
            <button class="btn-close" @click.stop="handleClose">
              <el-icon :size="14"><Close /></el-icon>
            </button>
          </div>
        </div>
        <!-- 显示多个模型的详细信息 -->
        <div v-if="failedModels.length > 1" class="notification-details">
          <div class="details-label">点击更新：</div>
          <div v-for="model in failedModels" :key="model.id" class="detail-item clickable" @click.stop="handleUpdateModel(model)">
            <span class="model-name">{{ model.name }}</span>
            <span class="provider-badge" :class="model.provider">{{ model.provider }}</span>
            <el-icon :size="12" class="edit-icon"><Edit /></el-icon>
          </div>
        </div>
      </div>
    </Transition>

    <!-- API Key 更新弹窗 -->
    <ApiKeyUpdateDialog
      v-if="updatingModel"
      :visible="showUpdateDialog"
      :modelId="updatingModel.id"
      :modelName="updatingModel.name"
      :provider="updatingModel.provider"
      @close="handleDialogClose"
      @saved="handleDialogSaved"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'
import { WarningFilled, Edit, Close } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import ApiKeyUpdateDialog from './ApiKeyUpdateDialog.vue'

interface FailedModel {
  id: string
  name: string
  provider: string
}

const store = useAppStore()
const visible = ref(false)
const failedModels = ref<FailedModel[]>([])
const debounceTimer = ref<ReturnType<typeof setTimeout> | null>(null)

// 弹窗相关状态
const showUpdateDialog = ref(false)
const updatingModel = ref<FailedModel | null>(null)

// 监听 modelUsageMap 的变化，收集所有 API key 失效的模型
watch(() => store.modelUsageMap, (newMap) => {
  const failed: FailedModel[] = []

  for (const [modelId, status] of Object.entries(newMap)) {
    if (status?.usageType === 'error' && status?.error?.includes('API key')) {
      const model = store.models.find(m => m.id === modelId)
      if (model) {
        failed.push({
          id: model.id,
          name: model.name,
          provider: model.provider
        })
      }
    }
  }

  if (failed.length > 0) {
    // 防抖处理：延迟显示通知，避免扎堆提示
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value)
    }
    debounceTimer.value = setTimeout(() => {
      failedModels.value = failed
      visible.value = true
    }, 1000) // 1秒防抖
  } else {
    failedModels.value = []
    visible.value = false
  }
}, { deep: true })

function handleClick() {
  // 点击整个通知区域不做任何操作
}

function handleUpdate() {
  // 如果只有一个模型，直接打开更新弹窗
  if (failedModels.value.length === 1) {
    openUpdateDialog(failedModels.value[0])
  } else {
    // 多个模型时，显示第一个的更新弹窗
    openUpdateDialog(failedModels.value[0])
  }
}

function handleUpdateModel(model: FailedModel) {
  openUpdateDialog(model)
}

function openUpdateDialog(model: FailedModel) {
  updatingModel.value = model
  showUpdateDialog.value = true
}

function handleDialogClose() {
  showUpdateDialog.value = false
  updatingModel.value = null
}

function handleDialogSaved() {
  // API key 更新成功后，从失败列表中移除该模型
  if (updatingModel.value) {
    failedModels.value = failedModels.value.filter(m => m.id !== updatingModel.value?.id)

    // 如果没有失败的模型了，关闭通知
    if (failedModels.value.length === 0) {
      visible.value = false
    }
  }

  // 触发重新获取额度
  if (updatingModel.value) {
    store.requestRefresh(updatingModel.value.id)
  }

  handleDialogClose()
}

function handleClose() {
  visible.value = false
  // 延迟清除数据，等待动画完成
  setTimeout(() => {
    failedModels.value = []
  }, 300)
}

onUnmounted(() => {
  if (debounceTimer.value) {
    clearTimeout(debounceTimer.value)
  }
})
</script>

<style scoped>
.api-key-notification {
  position: fixed;
  top: 20px;
  right: 20px;
  z-index: 9999;
  min-width: 320px;
  max-width: 400px;
  background: var(--glass-bg-strong, rgba(255, 255, 255, 0.95));
  border: 1px solid var(--glass-border, rgba(0, 0, 0, 0.1));
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  cursor: default;
  overflow: hidden;
}

.notification-content {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 16px;
}

.notification-icon {
  flex-shrink: 0;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(245, 158, 11, 0.1);
  border-radius: 10px;
  color: #f59e0b;
}

.notification-text {
  flex: 1;
  min-width: 0;
}

.notification-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #1a1a1a);
  margin-bottom: 4px;
}

.notification-message {
  font-size: 13px;
  color: var(--text-secondary, #666);
  line-height: 1.4;
}

.notification-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}

.btn-update {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background: var(--accent, #6366f1);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-update:hover {
  background: var(--accent-hover, #4f46e5);
  transform: translateY(-1px);
}

.btn-update:active {
  transform: translateY(0);
}

.btn-close {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  background: transparent;
  border: none;
  border-radius: 8px;
  color: var(--text-secondary, #666);
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-close:hover {
  background: var(--glass-bg, rgba(0, 0, 0, 0.05));
  color: var(--text-primary, #1a1a1a);
}

.notification-details {
  padding: 0 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.details-label {
  font-size: 12px;
  color: var(--text-secondary, #666);
  font-weight: 500;
}

.detail-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: var(--glass-bg, rgba(0, 0, 0, 0.05));
  border-radius: 6px;
  font-size: 12px;
}

.detail-item.clickable {
  cursor: pointer;
  transition: all 0.2s ease;
}

.detail-item.clickable:hover {
  background: var(--glass-bg-strong, rgba(0, 0, 0, 0.1));
  transform: translateX(4px);
}

.detail-item.clickable:active {
  transform: translateX(2px);
}

.model-name {
  font-weight: 500;
  color: var(--text-primary, #1a1a1a);
}

.provider-badge {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
}

.provider-badge.kimi {
  background: rgba(99, 102, 241, 0.1);
  color: #6366f1;
}

.provider-badge.deepseek {
  background: rgba(16, 185, 129, 0.1);
  color: #10b981;
}

.provider-badge.mimo {
  background: rgba(245, 158, 11, 0.1);
  color: #f59e0b;
}

.provider-badge.openai {
  background: rgba(16, 163, 127, 0.1);
  color: #10a37f;
}

.provider-badge.claude {
  background: rgba(217, 119, 6, 0.1);
  color: #d97706;
}

.provider-badge.opencode {
  background: rgba(139, 92, 246, 0.1);
  color: #8b5cf6;
}

.edit-icon {
  margin-left: auto;
  color: var(--text-secondary, #666);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.detail-item.clickable:hover .edit-icon {
  opacity: 1;
}

/* 动画 */
.notification-fade-enter-active {
  transition: all 0.3s ease;
}

.notification-fade-leave-active {
  transition: all 0.3s ease;
}

.notification-fade-enter-from {
  opacity: 0;
  transform: translateX(100%);
}

.notification-fade-leave-to {
  opacity: 0;
  transform: translateX(100%);
}

/* 响应式 */
@media (max-width: 480px) {
  .api-key-notification {
    top: 10px;
    right: 10px;
    left: 10px;
    min-width: auto;
    max-width: none;
  }
}
</style>
