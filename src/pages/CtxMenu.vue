<template>
  <div
    class="ctx-menu-page"
    :data-theme="theme"
    @mouseleave="onMouseLeave"
  >
    <div class="ctx-menu">
      <!-- Model-specific header -->
      <template v-if="modelName">
        <div class="ctx-header">
          <span class="ctx-header-name">{{ modelName }}</span>
        </div>
        <div class="ctx-item" @click="act('fetch-model')">
          <el-icon :size="13"><Refresh /></el-icon><span>刷新额度</span>
        </div>
        <div class="ctx-sep"></div>
      </template>

      <!-- Global actions -->
      <div class="ctx-item" @click="act('refresh-all')">
        <el-icon :size="13"><Refresh /></el-icon><span>刷新全部</span>
      </div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" :class="{ active: layoutMode === 'list' }" @click="act('set-layout:list')">
        <el-icon :size="13"><List /></el-icon><span>列表模式</span>
        <el-icon v-if="layoutMode === 'list'" :size="12" class="ctx-check"><Check /></el-icon>
      </div>
      <div class="ctx-item" :class="{ active: layoutMode === 'carousel' }" @click="act('set-layout:carousel')">
        <el-icon :size="13"><Grid /></el-icon><span>轮播模式</span>
        <el-icon v-if="layoutMode === 'carousel'" :size="12" class="ctx-check"><Check /></el-icon>
      </div>
      <div class="ctx-sep"></div>
      <div class="ctx-item" :class="{ active: alwaysOnTop }" @click="act('toggle-top')">
        <el-icon :size="13"><Top /></el-icon><span>窗口置顶</span>
        <el-icon v-if="alwaysOnTop" :size="12" class="ctx-check"><Check /></el-icon>
      </div>
      <div class="ctx-sep"></div>
      <div class="ctx-item danger" @click="act('close-float')">
        <el-icon :size="13"><Close /></el-icon><span>关闭悬浮窗</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Refresh, Close, Grid, List, Top, Check } from '@element-plus/icons-vue'

const theme = ref('dark')
const modelId = ref<string | null>(null)
const modelName = ref<string | null>(null)
const layoutMode = ref('list')
const alwaysOnTop = ref(true)

let unsubCfg: (() => void) | null = null

onMounted(() => {
  unsubCfg = window.electronAPI.onCtxMenuConfig((config) => {
    theme.value = config.theme
    modelId.value = config.modelId
    modelName.value = config.modelName
    layoutMode.value = config.layoutMode
    alwaysOnTop.value = config.alwaysOnTop
  })
})

onUnmounted(() => {
  unsubCfg?.()
})

function act(action: string) {
  // 主进程处理后会关闭菜单窗口
  window.electronAPI.sendCtxMenuAction(action)
}

function onMouseLeave() {
  // 小延迟防止快速划过误关闭
  setTimeout(() => {
    window.electronAPI.hideCtxMenu()
  }, 150)
}
</script>

<style>
/* 透明窗口必须覆盖 body 背景 */
html, body {
  margin: 0;
  padding: 0;
  background: transparent !important;
  overflow: hidden;
}
</style>

<style scoped>
.ctx-menu-page {
  width: 100vw;
  height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  background: transparent;
}

.ctx-menu {
  min-width: 160px;
  background: var(--glass-bg-strong);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 5px;
  margin: 6px;
  box-shadow:
    0 16px 48px rgba(0, 0, 0, 0.4),
    0 0 0 1px rgba(255, 255, 255, 0.06) inset;
  animation: menuPop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1) both;
  transform-origin: top left;
}

@keyframes menuPop {
  0% {
    opacity: 0;
    transform: scale(0.88) translateY(-4px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.ctx-header {
  padding: 8px 12px 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.3px;
}

.ctx-header-name {
  color: var(--accent);
}

.ctx-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.12s ease;
  position: relative;
}

.ctx-item:hover {
  background: var(--glass-bg);
}

.ctx-item.active {
  color: var(--accent);
}

.ctx-check {
  margin-left: auto;
  color: var(--accent);
  opacity: 0.8;
}

.ctx-item.danger {
  color: #f87171;
}

.ctx-item.danger:hover {
  background: rgba(248, 113, 113, 0.1);
}

.ctx-sep {
  height: 1px;
  background: var(--border-light);
  margin: 3px 8px;
  opacity: 0.6;
}

.ctx-item:hover .el-icon {
  animation: iconBounce 0.25s ease;
}

@keyframes iconBounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
</style>
