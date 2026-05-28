<template>
  <div v-if="shouldShow" class="login-notification">
    <el-alert
      :title="notificationTitle"
      :type="notificationType"
      :closable="true"
      show-icon
      @close="handleClose"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const dismissed = ref(false)

const loginState = computed(() => store.loginState)

// 重置 dismissed 状态
watch(loginState, (newState) => {
  if (newState === 'idle') {
    dismissed.value = false
  }
})

const shouldShow = computed(() => {
  if (dismissed.value) return false
  
  // 首次触发登录不弹通知（按钮已有反馈）
  // 只在以下情况显示通知：
  // 1. 登录窗口已打开时再次触发登录（防重提示）
  // 2. 登录失败/超时
  return loginState.value === 'failed'
})

const notificationTitle = computed(() => {
  switch (loginState.value) {
    case 'logging-in':
      return '登录窗口已打开，请完成登录'
    case 'failed':
      return store.loginError || '登录失败或已超时，请重试'
    default:
      return ''
  }
})

const notificationType = computed(() => {
  switch (loginState.value) {
    case 'logging-in':
      return 'warning'
    case 'failed':
      return 'error'
    default:
      return 'info'
  }
})

function handleClose() {
  dismissed.value = true
}
</script>

<style scoped>
.login-notification {
  position: fixed;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 9999;
  min-width: 300px;
  max-width: 500px;
}
</style>
