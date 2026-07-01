<template>
  <div
    ref="menuRef"
    class="ctx-menu-page"
    role="menu"
    aria-label="悬浮窗菜单"
    tabindex="-1"
    :data-theme="theme"
    :data-accent="accent"
    :data-preset="preset"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @keydown="onMenuKeydown"
  >
    <!-- Model-specific header -->
    <template v-if="modelName">
      <div class="ctx-header" aria-hidden="true">
        <span class="ctx-header-name">{{ modelName }}</span>
      </div>
      <div
        class="ctx-item"
        role="menuitem"
        tabindex="-1"
        aria-label="刷新该模型额度"
        :class="{ active: activeIndex === 0 }"
        @mouseenter="focusItem(0)"
        @click="act('fetch-model')"
      >
        <el-icon :size="13"><Refresh /></el-icon><span>刷新额度</span>
      </div>
      <div class="ctx-sep" role="separator" aria-hidden="true"></div>
    </template>

    <!-- Global actions -->
    <div
      class="ctx-item"
      role="menuitem"
      tabindex="-1"
      aria-label="刷新全部模型"
      :class="{ active: activeIndex === (modelName ? 1 : 0) }"
      @mouseenter="focusItem(modelName ? 1 : 0)"
      @click="act('refresh-all')"
    >
      <el-icon :size="13"><Refresh /></el-icon><span>刷新全部</span>
    </div>
    <div class="ctx-sep" role="separator" aria-hidden="true"></div>
    <div
      class="ctx-item"
      role="menuitem"
      tabindex="-1"
      aria-label="切换为列表模式"
      :aria-checked="layoutMode === 'list' ? 'true' : 'false'"
      :class="{ active: activeIndex === (modelName ? 2 : 1) }"
      @mouseenter="focusItem(modelName ? 2 : 1)"
      @click="act('set-layout:list')"
    >
      <el-icon :size="13"><List /></el-icon><span>列表模式</span>
      <el-icon v-if="layoutMode === 'list'" :size="12" class="ctx-check"><Check /></el-icon>
    </div>
    <div
      class="ctx-item"
      role="menuitem"
      tabindex="-1"
      aria-label="切换为轮播模式"
      :aria-checked="layoutMode === 'carousel' ? 'true' : 'false'"
      :class="{ active: activeIndex === (modelName ? 3 : 2) }"
      @mouseenter="focusItem(modelName ? 3 : 2)"
      @click="act('set-layout:carousel')"
    >
      <el-icon :size="13"><Grid /></el-icon><span>轮播模式</span>
      <el-icon v-if="layoutMode === 'carousel'" :size="12" class="ctx-check"><Check /></el-icon>
    </div>
    <div class="ctx-sep" role="separator" aria-hidden="true"></div>
    <div
      class="ctx-item"
      role="menuitem"
      tabindex="-1"
      aria-label="切换窗口置顶"
      :aria-checked="alwaysOnTop ? 'true' : 'false'"
      :class="{ active: activeIndex === (modelName ? 4 : 3) }"
      @mouseenter="focusItem(modelName ? 4 : 3)"
      @click="act('toggle-top')"
    >
      <el-icon :size="13"><Top /></el-icon><span>窗口置顶</span>
      <el-icon v-if="alwaysOnTop" :size="12" class="ctx-check"><Check /></el-icon>
    </div>
    <div class="ctx-sep" role="separator" aria-hidden="true"></div>
    <div
      class="ctx-item danger"
      role="menuitem"
      tabindex="-1"
      aria-label="关闭悬浮窗"
      :class="{ active: activeIndex === (modelName ? 5 : 4) }"
      @mouseenter="focusItem(modelName ? 5 : 4)"
      @click="act('close-float')"
    >
      <el-icon :size="13"><Close /></el-icon><span>关闭悬浮窗</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, onUpdated, computed } from 'vue'
import { Refresh, Close, Grid, List, Top, Check } from '@element-plus/icons-vue'
import { useThemeSync } from '@/composables/useThemeSync'

const { theme, accent, preset } = useThemeSync()
const modelId = ref<string | null>(null)
const modelName = ref<string | null>(null)
const layoutMode = ref('list')
const alwaysOnTop = ref(true)

let unsubCfg: (() => void) | null = null
let leaveTimer: ReturnType<typeof setTimeout> | null = null

const menuRef = ref<HTMLElement | null>(null)
const itemEls = ref<HTMLElement[]>([])
const activeIndex = ref(-1)

const itemCount = computed(() => itemEls.value.length)

function refreshItems() {
  itemEls.value = Array.from(menuRef.value?.querySelectorAll('[role="menuitem"]') ?? [])
}

function focusItem(index: number) {
  if (index < 0 || index >= itemCount.value) return
  activeIndex.value = index
  itemEls.value[index]?.focus()
}

function focusNext() {
  if (itemCount.value === 0) return
  activeIndex.value = activeIndex.value < itemCount.value - 1 ? activeIndex.value + 1 : 0
  focusItem(activeIndex.value)
}

function focusPrev() {
  if (itemCount.value === 0) return
  activeIndex.value = activeIndex.value > 0 ? activeIndex.value - 1 : itemCount.value - 1
  focusItem(activeIndex.value)
}

function activateCurrent() {
  const idx = activeIndex.value
  if (idx >= 0 && idx < itemCount.value) {
    itemEls.value[idx]?.click()
  }
}

function onMenuKeydown(e: KeyboardEvent) {
  switch (e.key) {
    case 'ArrowDown':
      e.preventDefault()
      focusNext()
      break
    case 'ArrowUp':
      e.preventDefault()
      focusPrev()
      break
    case 'Home':
      e.preventDefault()
      focusItem(0)
      break
    case 'End':
      e.preventDefault()
      focusItem(itemCount.value - 1)
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      activateCurrent()
      break
    case 'Escape':
      e.preventDefault()
      window.electronAPI.hideCtxMenu()
      break
  }
}

onMounted(async () => {
  refreshItems()

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

  // 菜单显示后聚焦到容器，以便键盘事件生效
  menuRef.value?.focus()
})

onUpdated(() => {
  refreshItems()
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
  outline: none;
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
  outline: none;
}

.ctx-item:hover,
.ctx-item:focus,
.ctx-item.active {
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

.ctx-item.danger:hover,
.ctx-item.danger:focus,
.ctx-item.danger.active {
  background: rgba(212, 119, 106, 0.1);
}

.ctx-sep {
  height: 1px;
  background: var(--border-light);
  margin: 3px 8px;
  opacity: 0.6;
}

.ctx-item:hover .el-icon,
.ctx-item:focus .el-icon,
.ctx-item.active .el-icon {
  animation: iconBounce 0.25s ease;
}

@keyframes iconBounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.15); }
}
</style>
