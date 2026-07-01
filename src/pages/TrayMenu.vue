<template>
  <div
    ref="menuRef"
    class="tray-menu"
    :class="{ ready: isReady }"
    role="menu"
    aria-label="托盘菜单"
    tabindex="-1"
    :data-theme="theme"
    :data-accent="accent"
    :data-preset="preset"
    @mouseenter="onMouseEnter"
    @mouseleave="onMouseLeave"
    @keydown="onMenuKeydown"
  >
    <!-- 模型状态区 -->
    <template v-if="models.length > 0">
      <div class="tm-section-label" aria-hidden="true">模型状态</div>
      <div class="tm-models" role="group" aria-label="模型状态">
        <div
          v-for="m in models"
          :key="m.id"
          class="tm-model-row"
          role="menuitem"
          tabindex="-1"
          :aria-label="`刷新模型 ${m.name}`"
          :class="{ active: isActiveItem(m.id) }"
          @mouseenter="focusItemById(m.id)"
          @click="act('refresh-model:' + m.id)"
        >
          <span class="tm-dot" :class="m.status" aria-hidden="true"></span>
          <span class="tm-model-name">{{ m.name }}</span>
          <span v-if="m.status === 'normal' && m.percent != null" class="tm-pct" aria-hidden="true">
            {{ m.percent.toFixed(0) }}%
          </span>
          <span v-if="m.status === 'refreshing'" class="tm-spinner" aria-hidden="true"></span>
          <span v-if="m.status === 'error'" class="tm-error" aria-hidden="true">错误</span>
          <span v-if="m.status === 'needs-login'" class="tm-login" aria-hidden="true">登录</span>
        </div>
      </div>
      <div class="tm-sep" role="separator" aria-hidden="true"></div>
    </template>

    <!-- 操作区 -->
    <div
      data-menu-id="toggle-main"
      class="tm-item"
      role="menuitem"
      tabindex="-1"
      :aria-label="mainWindowActive ? '隐藏主窗口' : '打开主窗口'"
      :class="{ active: isActiveItem('toggle-main') }"
      @mouseenter="focusItemById('toggle-main')"
      @click="act('toggle-main')"
    >
      <el-icon :size="14"><Monitor /></el-icon>
      <span>{{ mainWindowActive ? '隐藏主窗口' : '打开主窗口' }}</span>
    </div>
    <div
      data-menu-id="toggle-float"
      class="tm-switch-row"
      role="menuitem"
      tabindex="-1"
      aria-label="切换悬浮窗显示"
      :aria-checked="floatActive ? 'true' : 'false'"
      :class="{ active: isActiveItem('toggle-float') }"
      @mouseenter="focusItemById('toggle-float')"
      @click="toggleFloat"
    >
      <el-icon :size="14"><Grid /></el-icon>
      <span class="tm-switch-label">悬浮窗</span>
      <div class="tm-switch" :class="{ on: floatActive }" aria-hidden="true">
        <div class="tm-switch-thumb"></div>
      </div>
    </div>
    <div
      data-menu-id="refresh-all"
      class="tm-item"
      role="menuitem"
      tabindex="-1"
      aria-label="刷新全部数据"
      :class="{ active: isActiveItem('refresh-all') }"
      @mouseenter="focusItemById('refresh-all')"
      @click="act('refresh-all')"
    >
      <el-icon :size="14"><Refresh /></el-icon><span>刷新全部数据</span>
    </div>

    <div class="tm-sep" role="separator" aria-hidden="true"></div>

    <!-- 快捷设置 -->
    <div
      data-menu-id="toggle-theme"
      class="tm-item"
      role="menuitem"
      tabindex="-1"
      :aria-label="theme === 'dark' ? '切换浅色模式' : '切换深色模式'"
      :class="{ active: isActiveItem('toggle-theme') }"
      @mouseenter="focusItemById('toggle-theme')"
      @click="act('toggle-theme')"
    >
      <el-icon :size="14"><Moon /></el-icon>
      <span>{{ theme === 'dark' ? '切换浅色模式' : '切换深色模式' }}</span>
    </div>

    <!-- 强调色色盘 -->
    <div class="tm-accent-row" role="group" aria-label="选择强调色">
      <span
        v-for="c in accentColors"
        :key="c.name"
        :data-menu-id="'accent:' + c.name"
        class="tm-swatch"
        role="menuitem"
        tabindex="-1"
        :aria-label="`强调色 ${c.name}`"
        :class="{ active: accent.value === c.name }"
        :style="{ background: c.color }"
        @mouseenter="focusItemById('accent:' + c.name)"
        @click.stop="act('set-accent:' + c.name)"
      ></span>
    </div>

    <!-- 预设标签 -->
    <div class="tm-preset-row" role="group" aria-label="选择预设主题">
      <span
        v-for="p in presetNames"
        :key="p.key"
        :data-menu-id="'preset:' + p.key"
        class="tm-preset"
        role="menuitem"
        tabindex="-1"
        :aria-label="`预设 ${p.label}`"
        :class="{ active: preset.value === p.key }"
        @mouseenter="focusItemById('preset:' + p.key)"
        @click.stop="act('set-preset:' + p.key)"
      >{{ p.label }}</span>
    </div>

    <div class="tm-sep" role="separator" aria-hidden="true"></div>

    <!-- 退出 -->
    <div
      data-menu-id="quit"
      class="tm-item danger"
      role="menuitem"
      tabindex="-1"
      aria-label="退出应用"
      :class="{ active: isActiveItem('quit') }"
      @mouseenter="focusItemById('quit')"
      @click="act('quit')"
    >
      <el-icon :size="14"><Close /></el-icon><span>退出</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, onUpdated, watch, computed } from 'vue'
import { Monitor, Grid, Refresh, Moon, Close } from '@element-plus/icons-vue'

// ── 数据 ──

interface ModelStatus {
  id: string
  name: string
  provider: string
  status: 'normal' | 'refreshing' | 'error' | 'needs-login'
  error?: string
  percent?: number
}

const theme = ref('dark')
const accent = ref('forest')
const preset = ref('default')
const models = ref<ModelStatus[]>([])
const floatActive = ref(false)
const mainWindowActive = ref(false)
const isReady = ref(false)

let unsubUpdate: (() => void) | null = null
let leaveTimer: ReturnType<typeof setTimeout> | null = null
let suppressUntilApplied = false  // toggle 期间屏蔽事件，直到 IPC 返回值被应用后解除

function applyThemeToHtml(t: { mode: string, accent: string, preset: string }) {
  const html = document.documentElement
  html.setAttribute('data-theme', t.mode)
  html.setAttribute('data-accent', t.accent)
  html.setAttribute('data-preset', t.preset)
}

// ── 键盘导航 ──

const menuRef = ref<HTMLElement | null>(null)
const itemEls = ref<HTMLElement[]>([])
const activeId = ref<string | null>(null)

const orderedIds = computed(() => {
  const ids: string[] = []
  for (const m of models.value) ids.push(m.id)
  ids.push('toggle-main', 'toggle-float', 'refresh-all', 'toggle-theme')
  for (const c of accentColors) ids.push('accent:' + c.name)
  for (const p of presetNames) ids.push('preset:' + p.key)
  ids.push('quit')
  return ids
})

function refreshItems() {
  itemEls.value = Array.from(menuRef.value?.querySelectorAll('[role="menuitem"]') ?? [])
}

function isActiveItem(id: string) {
  return activeId.value === id
}

function focusItemById(id: string) {
  activeId.value = id
  const el = itemEls.value.find((item) => item.getAttribute('data-menu-id') === id)
  el?.focus()
}

function focusNext() {
  if (orderedIds.value.length === 0) return
  const currentIndex = activeId.value ? orderedIds.value.indexOf(activeId.value) : -1
  const nextIndex = currentIndex < orderedIds.value.length - 1 ? currentIndex + 1 : 0
  focusItemById(orderedIds.value[nextIndex])
}

function focusPrev() {
  if (orderedIds.value.length === 0) return
  const currentIndex = activeId.value ? orderedIds.value.indexOf(activeId.value) : 0
  const prevIndex = currentIndex > 0 ? currentIndex - 1 : orderedIds.value.length - 1
  focusItemById(orderedIds.value[prevIndex])
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
      focusItemById(orderedIds.value[0])
      break
    case 'End':
      e.preventDefault()
      focusItemById(orderedIds.value[orderedIds.value.length - 1])
      break
    case 'Enter':
    case ' ':
      e.preventDefault()
      if (activeId.value) {
        const el = itemEls.value.find((item) => item.getAttribute('data-menu-id') === activeId.value)
        el?.click()
      }
      break
    case 'Escape':
      e.preventDefault()
      window.electronAPI.sendTrayMenuAction('__hide').catch(() => {})
      break
  }
}

// ── 强调色数据（与 theme.css 对应） ──

const accentColors = [
  { name: 'forest',  color: '#6b9e7a' },
  { name: 'moss',    color: '#8fa870' },
  { name: 'matcha',  color: '#82a888' },
  { name: 'cyber',   color: '#00e5ff' },
  { name: 'sunset',  color: '#f97316' },
  { name: 'sakura',  color: '#f472b6' },
  { name: 'mono',    color: '#a3a3a3' },
]

// ── 预设数据 ──

const presetNames = [
  { key: 'default',  label: '默认' },
  { key: 'midnight', label: '午夜' },
  { key: 'aurora',   label: '极光' },
  { key: 'cyber',    label: '霓虹' },
  { key: 'sunset',   label: '日落' },
  { key: 'sakura',   label: '樱花' },
  { key: 'mono',     label: '极简' },
]

// ── 生命周期 ──

onMounted(async () => {
  refreshItems()

  // 拉取初始配置
  try {
    const config = await window.electronAPI.getTrayMenuConfig()
    if (config) {
      applyPayload(config)
    }
  } catch {}

  // 监听实时更新（toggle 期间屏蔽，IPC 返回值到达后解除）
  unsubUpdate = window.electronAPI.onTrayMenuUpdate((payload) => {
    if (suppressUntilApplied) return
    applyPayload(payload)
  })

  // 菜单显示后聚焦容器
  menuRef.value?.focus()
})

onUpdated(() => {
  refreshItems()
})

onUnmounted(() => {
  unsubUpdate?.()
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = null
  }
})

function applyPayload(payload: {
  models: ModelStatus[]
  floatActive: boolean
  mainWindowActive: boolean
  theme: string
  accent: string
  preset: string
}) {
  isReady.value = true
  models.value = payload.models
  floatActive.value = payload.floatActive
  mainWindowActive.value = payload.mainWindowActive
  theme.value = payload.theme
  accent.value = payload.accent
  preset.value = payload.preset
  applyThemeToHtml(payload)
}

// ── 操作 ──

async function act(action: string) {
  try {
    const result = await window.electronAPI.sendTrayMenuAction(action)
    if (result && typeof result === 'object' && 'models' in result) {
      applyPayload(result as any)
    }
  } catch (e) {
    console.error('[TrayMenu] action failed:', action, e)
  } finally {
    suppressUntilApplied = false
  }
}

function toggleFloat() {
  suppressUntilApplied = true
  act('toggle-float')
}

// ── 鼠标进出 ──

function onMouseEnter() {
  if (leaveTimer) {
    clearTimeout(leaveTimer)
    leaveTimer = null
  }
}

function onMouseLeave() {
  leaveTimer = setTimeout(() => {
    leaveTimer = null
    window.electronAPI.sendTrayMenuAction('__hide').catch(() => {})
  }, 500)
}
</script>

<style>
/* 非透明窗口：body 使用实色背景 */
html, body {
  margin: 0;
  padding: 0;
  background: transparent !important;
  overflow: hidden;
}
</style>

<style scoped>
.tray-menu {
  background: var(--bg-secondary);
  padding: 6px;
  box-sizing: border-box;
  min-height: 100%;
  overflow: hidden;
  border-radius: 12px;
  opacity: 0;
  transition: opacity 0.08s ease;
  animation: traySlideIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  outline: none;
}

.tray-menu.ready {
  opacity: 1;
}

@keyframes traySlideIn {
  from {
    opacity: 0;
    transform: translateY(-8px) scale(0.96);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

/* ── 区域标题 ── */
.tm-section-label {
  padding: 6px 10px 4px;
  font-size: 10px;
  font-weight: 600;
  color: var(--text-placeholder);
  letter-spacing: 0.5px;
  text-transform: uppercase;
}

/* ── 模型列表 ── */
.tm-models {
  max-height: 200px;
  overflow-y: auto;
}

.tm-model-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s ease;
  outline: none;
}

.tm-model-row:hover,
.tm-model-row:focus,
.tm-model-row.active {
  background: var(--glass-bg);
}

.tm-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  flex-shrink: 0;
}

.tm-dot.normal       { background: var(--success); box-shadow: 0 0 6px var(--success); }
.tm-dot.refreshing    { background: var(--accent); box-shadow: 0 0 6px var(--accent); animation: dotPulse 1s ease-in-out infinite; }
.tm-dot.error         { background: var(--danger); box-shadow: 0 0 6px var(--danger); }
.tm-dot.needs-login   { background: var(--warning); box-shadow: 0 0 6px var(--warning); }

@keyframes dotPulse {
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.35; }
}

.tm-model-name {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tm-pct {
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  font-variant-numeric: tabular-nums;
}

.tm-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--glass-border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.tm-error {
  font-size: 10px;
  font-weight: 600;
  color: var(--danger);
  padding: 1px 6px;
  background: rgba(212, 119, 106, 0.1);
  border-radius: 4px;
}

.tm-login {
  font-size: 10px;
  font-weight: 600;
  color: var(--warning);
  padding: 1px 6px;
  background: rgba(212, 168, 85, 0.1);
  border-radius: 4px;
  cursor: pointer;
}

/* ── 分隔线 ── */
.tm-sep {
  height: 1px;
  background: var(--border-light);
  margin: 4px 8px;
  opacity: 0.6;
}

/* ── 开关行 ── */
.tm-switch-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  transition: background 0.12s ease;
  outline: none;
}

.tm-switch-row:hover,
.tm-switch-row:focus,
.tm-switch-row.active {
  background: var(--glass-bg);
}

.tm-switch-label {
  flex: 1;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
}

.tm-switch {
  position: relative;
  width: 34px;
  height: 18px;
  border-radius: 12px;
  background: var(--border-color);
  cursor: pointer;
  transition: background 0.25s cubic-bezier(0.4, 0, 0.2, 1),
              box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  flex-shrink: 0;
  will-change: background, box-shadow;
}

.tm-switch.on {
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent-glow);
}

.tm-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  will-change: transform;
}

.tm-switch.on .tm-switch-thumb {
  transform: translateX(16px);
}

/* ── 菜单项 ── */
.tm-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-primary);
  cursor: pointer;
  transition: all 0.12s ease;
  outline: none;
}

.tm-item:hover,
.tm-item:focus,
.tm-item.active {
  background: var(--glass-bg);
}

.tm-item:hover .el-icon,
.tm-item:focus .el-icon,
.tm-item.active .el-icon {
  animation: iconBounce 0.25s ease;
}

.tm-item.danger {
  color: var(--danger);
}

.tm-item.danger:hover,
.tm-item.danger:focus,
.tm-item.danger.active {
  background: rgba(212, 119, 106, 0.1);
}

@keyframes iconBounce {
  0%, 100% { transform: scale(1); }
  50%      { transform: scale(1.15); }
}

/* ── 强调色色盘 ── */
.tm-accent-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px 2px;
}

.tm-swatch {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 2px solid transparent;
  position: relative;
  outline: none;
}

.tm-swatch:hover,
.tm-swatch:focus,
.tm-swatch.active {
  transform: scale(1.2);
}

.tm-swatch.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 8px var(--accent-glow);
}

/* ── 预设标签 ── */
.tm-preset-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 2px 10px 4px;
}

.tm-preset {
  font-size: 10px;
  font-weight: 500;
  color: var(--text-secondary);
  padding: 2px 8px;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid var(--border-light);
  transition: all 0.12s ease;
  background: transparent;
  outline: none;
}

.tm-preset:hover,
.tm-preset:focus,
.tm-preset.active {
  background: var(--glass-bg);
  color: var(--text-primary);
}

.tm-preset.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-glow);
}

/* ── 自定义滚动条 ── */
.tm-models::-webkit-scrollbar {
  width: 3px;
}

.tm-models::-webkit-scrollbar-track {
  background: transparent;
}

.tm-models::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 3px;
}
</style>
