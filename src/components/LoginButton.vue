<template>
  <div class="login-actions">
    <el-button
      :type="buttonType"
      :loading="isLoading"
      :disabled="isDisabled"
      @click="handleClick"
      class="login-button"
    >
      <span v-if="loginState === 'complete'">✅ 已登录</span>
      <span v-else-if="loginState === 'failed'">❌ 登录失败，重试</span>
      <span v-else-if="loginState === 'logging-in'">登录中...</span>
      <span v-else>🔑 登录 MiMo</span>
    </el-button>
    
    <el-button
      type="info"
      @click="showPasteDialog = true"
      class="paste-button"
    >
      📋 粘贴 Cookies
    </el-button>

    <el-dialog
      v-model="showPasteDialog"
      title="粘贴 Cookies"
      width="500px"
    >
      <div class="paste-content">
        <p class="paste-hint">
          请在 Chrome 浏览器中登录 MiMo 平台后，按 F12 打开开发者工具，
          在 Console 中执行 <code>document.cookie</code> 复制 cookies，然后粘贴到下方：
        </p>
        <el-input
          v-model="cookiesInput"
          type="textarea"
          :rows="6"
          placeholder="粘贴 cookies 字符串..."
        />
      </div>
      <template #footer>
        <el-button @click="showPasteDialog = false">取消</el-button>
        <el-button type="primary" @click="handlePaste">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import { ElMessage } from 'element-plus'

const props = defineProps<{
  modelId: string
}>()

const store = useAppStore()
const showPasteDialog = ref(false)
const cookiesInput = ref('')

const loginState = computed(() => store.loginState)
const isLoading = computed(() => loginState.value === 'logging-in')
const isDisabled = computed(() => loginState.value === 'logging-in')

const buttonType = computed(() => {
  switch (loginState.value) {
    case 'complete':
      return 'success'
    case 'failed':
      return 'danger'
    case 'logging-in':
      return 'warning'
    default:
      return 'primary'
  }
})

function handleClick() {
  if (loginState.value === 'logging-in') {
    return
  }
  store.startMimoLogin()
}

async function handlePaste() {
  if (!cookiesInput.value.trim()) {
    ElMessage.warning('请输入 cookies')
    return
  }
  
  await store.setMimoCookies(cookiesInput.value.trim())
  showPasteDialog.value = false
  cookiesInput.value = ''
  ElMessage.success('Cookies 已保存')
}

// 2 秒后恢复 idle
watch(loginState, (newState) => {
  if (newState === 'complete') {
    setTimeout(() => {
      store.resetLoginState()
    }, 2000)
  }
})
</script>

<style scoped>
.login-actions {
  display: flex;
  gap: 8px;
}

.login-button {
  min-width: 120px;
}

.paste-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.paste-hint {
  font-size: 13px;
  color: var(--el-text-color-secondary);
  line-height: 1.6;
}

.paste-hint code {
  background: var(--el-fill-color-light);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: monospace;
}
</style>
