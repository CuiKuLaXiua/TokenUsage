<template>
  <button
    class="icon-btn"
    :style="{ width: size + 'px', height: size + 'px' }"
    :disabled="disabled"
    @click="$emit('click')"
  >
    <el-icon :size="iconSize">
      <component :is="loading ? Loading : icon" :class="{ spin: loading }" />
    </el-icon>
  </button>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Loading } from '@element-plus/icons-vue'
import type { Component } from 'vue'

const props = withDefaults(defineProps<{
  icon: Component
  loading?: boolean
  size?: number
  disabled?: boolean
}>(), {
  loading: false,
  size: 36,
  disabled: false,
})

defineEmits<{ (e: 'click'): void }>()

const iconSize = computed(() => Math.round(props.size * 0.44))
</script>

<style scoped>
.icon-btn {
  flex-shrink: 0;
  border-radius: 50%;
  background: var(--bg-secondary);
  border: 1px solid var(--border-light);
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-family: inherit;
  outline: none;
  transition: all 0.3s var(--ease-smooth),
              transform 0.15s var(--ease-spring);
}

.icon-btn:hover:not(:disabled) {
  background: var(--glass-bg);
  border-color: var(--glass-border);
  color: var(--text-primary);
  transform: translateY(-1px);
  box-shadow: var(--glass-shadow);
}

.icon-btn:active:not(:disabled) {
  transform: scale(0.9);
}

.icon-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.spin {
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
