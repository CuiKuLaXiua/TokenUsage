<template>
  <!-- 占位层：ready 前用不透明背景遮挡，防止透明窗口透出主页面内容 -->
  <div v-if="!ready" class="ctx-menu-placeholder"></div>
  <div
    v-else
    class="ctx-menu-page"
    :data-theme="theme"
    :data-accent="accent"
    :data-preset="preset"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
  >
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
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Refresh, Close, Grid, List, Top, Check } from '@element-plus/icons-vue'
import { useThemeSync } from '@/composables/useThemeSync'

const { theme, accent, preset } = useThemeSync()
const modelId = ref<string | null>(null)
const modelName = ref<string | null>(null)
const layoutMode = ref('list')
const alwaysOnTop = ref(true)
const ready = ref(false)

let unsubCfg: (() => void) | null = null
let leaveTimer: ReturnType<typeof setTimeout> | null = null

onMounted(async () => {
  // 主动拉取配置（避免页面加载与 IPC 推送的竞态问题）
  try {
    const config = await window.electronAPI.getCtxMenuConfig()
    if (config) {
      theme.value = config.theme
      preset.value = config.preset
      modelId.value = config.modelId
      modelName.value = config.modelName
      layoutMode.value = config.layoutMode
      alwaysOnTop.value = config.alwaysOnTop
    }
  } catch {}
  // 保留推送监听，用于窗口已存在时的后续更新
  unsubCfg = window.electronAPI.onCtxMenuConfig((config) => {
    theme.value = config.theme
    preset.value = config.preset
    modelId.value = config.modelId
    modelName.value = config.modelName
    layoutMode.value = config.layoutMode
    alwaysOnTop.value = config.alwaysOnTop
  })

  // 数据就绪后才渲染菜单，避免透明窗口透出主页面内容闪烁
  ready.value = true
})

onUnmounted(() => {
  unsubCfg?.()
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = null
  }
})

function act(action: string) {
  // 主进程处理后会关闭菜单窗口
  window.electronAPI.sendCtxMenuAction(action)
}

function onMouseEnter() {
  // 鼠标重新进入菜单，取消关闭计时器
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = null
  }
}

function onMouseLeave() {
  // 小延迟防止快速划过误关闭
  leaveTimer = setTimeout(() => {
    leaveTimer = null
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

/* 占位层：ready 前覆盖不透明背景，防止透明窗口透出主页面内容 */
.ctx-menu-placeholder {
  width: 100vw;
  height: 100vh;
  background: #1a1a2e;
}
</style>

<style scoped>
.ctx-menu-page {
  background: var(--bg-secondary);
  border: 1px solid var(--glass-border);
  border-radius: 12px;
  padding: 5px;
  box-sizing: border-box;
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
  color: var(--danger);
}

.ctx-item.danger:hover {
  background: rgba(212, 119, 106, 0.1);
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
