<template>
  <Transition name="dialog-fade">
    <div v-if="visible" class="dialog-overlay" @click.self="handleClose">
      <div class="dialog-box glass-surface">
        <div class="dialog-header">
          <div class="header-content">
            <div class="header-icon">
              <el-icon :size="24"><Key /></el-icon>
            </div>
            <div class="header-text">
              <h3 class="dialog-title">更新 API Key</h3>
              <p class="dialog-subtitle">{{ modelName }} ({{ provider }})</p>
            </div>
          </div>
          <button class="icon-btn" @click="handleClose">
            <el-icon :size="16"><Close /></el-icon>
          </button>
        </div>

        <div class="dialog-body">
          <div class="form-field">
            <label class="form-label">新的 API Key</label>
            <div class="input-with-suffix">
              <input
                ref="inputRef"
                v-model="newApiKey"
                class="form-input"
                :type="showApiKey ? 'text' : 'password'"
                placeholder="请输入新的 API Key"
                @keyup.enter="handleSave"
              />
              <button
                type="button"
                class="suffix-btn"
                @click="showApiKey = !showApiKey"
                :title="showApiKey ? '隐藏' : '显示'"
              >
                <el-icon :size="14">
                  <component :is="showApiKey ? Hide : View" />
                </el-icon>
              </button>
            </div>
            <p class="form-hint">
              请前往 {{ providerName }} 官网获取新的 API Key
            </p>
          </div>

          <div v-if="error" class="error-message">
            <el-icon :size="14"><WarningFilled /></el-icon>
            <span>{{ error }}</span>
          </div>
        </div>

        <div class="dialog-footer">
          <button class="btn-ghost" @click="handleClose">取消</button>
          <button
            class="btn-primary"
            @click="handleSave"
            :disabled="!newApiKey.trim() || saving"
          >
            <el-icon v-if="saving" :size="14" class="spin"><Loading /></el-icon>
            <span>{{ saving ? '保存中...' : '保存' }}</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Key, Close, View, Hide, WarningFilled, Loading } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'

interface Props {
  visible: boolean
  modelId: string
  modelName: string
  provider: string
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'close'): void
  (e: 'saved'): void
}>()

const store = useAppStore()
const inputRef = ref<HTMLInputElement | null>(null)
const newApiKey = ref('')
const showApiKey = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)

const providerName = computed(() => {
  const names: Record<string, string> = {
    kimi: 'Kimi',
    deepseek: 'DeepSeek',
    openai: 'OpenAI',
    claude: 'Claude',
    mimo: 'MiMo'
  }
  return names[props.provider] || props.provider
})

// 打开时自动聚焦输入框
watch(() => props.visible, (newVal) => {
  if (newVal) {
    newApiKey.value = ''
    error.value = null
    showApiKey.value = false
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
})

function handleClose() {
  if (saving.value) return
  emit('close')
}

async function handleSave() {
  if (!newApiKey.value.trim()) {
    error.value = '请输入 API Key'
    return
  }

  saving.value = true
  error.value = null

  try {
    // 找到模型并更新 API key
    const model = store.models.find(m => m.id === props.modelId)
    if (model) {
      model.apiKey = newApiKey.value.trim()
      await store.saveConfig()
      ElMessage.success({ message: 'API Key 更新成功', duration: 2000 })
      emit('saved')
      emit('close')
    } else {
      error.value = '找不到对应的模型配置'
    }
  } catch (e) {
    error.value = '保存失败，请重试'
    console.error('[ApiKeyUpdateDialog] 保存失败:', e)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped>
.dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.4);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.dialog-box {
  width: 420px;
  max-width: 90vw;
  border-radius: 16px;
  padding: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid var(--border-light);
}

.header-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--accent-glow);
  border-radius: 12px;
  color: var(--accent);
}

.header-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.dialog-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text-primary);
  margin: 0;
}

.dialog-subtitle {
  font-size: 12px;
  color: var(--text-secondary);
  margin: 0;
}

.dialog-body {
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}

.input-with-suffix {
  position: relative;
  display: flex;
  align-items: center;
}

.input-with-suffix .form-input {
  padding-right: 42px;
}

.form-input {
  width: 100%;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-primary);
  font-size: 14px;
  font-family: 'Monaco', 'Menlo', monospace;
  outline: none;
  transition: all 0.2s ease;
}

.form-input::placeholder {
  color: var(--text-placeholder);
}

.form-input:focus {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

.suffix-btn {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 30px;
  height: 30px;
  border-radius: 6px;
  border: none;
  background: transparent;
  color: var(--text-placeholder);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.suffix-btn:hover {
  background: var(--glass-bg-strong);
  color: var(--text-secondary);
}

.form-hint {
  font-size: 12px;
  color: var(--text-placeholder);
  margin: 0;
  line-height: 1.4;
}

.error-message {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px;
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
  color: #ef4444;
  font-size: 13px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding: 16px 24px;
  border-top: 1px solid var(--border-light);
}

.btn-ghost {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 18px;
  border-radius: 10px;
  border: 1px solid var(--glass-border);
  background: var(--glass-bg);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-ghost:hover {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.btn-primary {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 10px 18px;
  border-radius: 10px;
  border: none;
  background: var(--accent);
  color: white;
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover:not(:disabled) {
  background: var(--accent-hover);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px var(--accent-glow);
}

.btn-primary:active:not(:disabled) {
  transform: translateY(0);
}

.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 动画 */
.dialog-fade-enter-active {
  transition: all 0.3s ease;
}

.dialog-fade-leave-active {
  transition: all 0.2s ease;
}

.dialog-fade-enter-from {
  opacity: 0;
}

.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .dialog-box {
  transform: scale(0.95) translateY(10px);
  opacity: 0;
}

.dialog-fade-leave-to .dialog-box {
  transform: scale(0.98) translateY(5px);
  opacity: 0;
}

/* 响应式 */
@media (max-width: 480px) {
  .dialog-box {
    width: 100%;
    max-width: 100%;
    margin: 16px;
    border-radius: 12px;
  }
}
</style>
