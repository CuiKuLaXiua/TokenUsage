<template>
  <div class="app-layout">
    <ParticleBg />

    <!-- 自定义标题栏 -->
    <div class="title-bar" :class="{ 'is-mac': isMac }">
      <div class="title-bar-drag">
        <el-popover
          placement="bottom-start"
          :width="200"
          trigger="click"
          popper-class="title-menu-popover"
          transition="menu-pop"
          :show-arrow="false"
        >
          <template #reference>
            <button class="title-btn menu-btn" title="设置">
              <svg class="menu-icon" width="16" height="16" viewBox="0 0 16 16" fill="none">
                <line x1="2" y1="4" x2="14" y2="4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="2" y1="8" x2="14" y2="8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <line x1="2" y1="12" x2="14" y2="12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
                <circle class="knob knob-1" cx="6" cy="4" r="2" fill="var(--neon-amber)"/>
                <circle class="knob knob-2" cx="10" cy="8" r="2" fill="var(--accent)"/>
                <circle class="knob knob-3" cx="5" cy="12" r="2" fill="var(--neon-green)"/>
              </svg>
            </button>
          </template>
          <div class="title-menu">
            <div class="menu-item" @click="themeStore.toggleTheme()">
              <el-icon :size="16">
                <Sunny v-if="themeStore.isDark" />
                <Moon v-else />
              </el-icon>
              <span>{{ themeStore.isDark ? '浅色模式' : '深色模式' }}</span>
            </div>
            <div class="menu-divider"></div>
            <div class="menu-group">
              <span class="menu-label">主题色调</span>
              <div class="accent-group">
                <button
                  v-for="a in accents"
                  :key="a.name"
                  class="accent-dot"
                  :class="{ active: themeStore.accent === a.name }"
                  :style="{ background: a.color }"
                  :title="a.label"
                  @click="themeStore.setAccent(a.name)"
                ></button>
              </div>
            </div>
          </div>
        </el-popover>
        <button v-if="isMac" class="title-btn func-btn" :class="{ active: floatActive }" @click="openFloat" :title="floatActive ? '关闭悬浮窗' : '打开悬浮窗'">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
            <line x1="7" y1="10" x2="7" y2="11.5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="4" y1="11.5" x2="10" y2="11.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <circle class="float-dot" cx="7" cy="5.5" r="2" fill="var(--neon-blue)" opacity="0"/>
          </svg>
        </button>
        <span v-if="isMac" class="title-bar-text">Token Usage</span>
      </div>
      <div v-if="!isMac" class="title-bar-controls">
        <button class="title-btn func-btn" :class="{ active: floatActive }" @click="openFloat" :title="floatActive ? '关闭悬浮窗' : '打开悬浮窗'">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <rect x="1" y="1" width="12" height="9" rx="1.5" stroke="currentColor" stroke-width="1.2" fill="none"/>
            <line x1="7" y1="10" x2="7" y2="11.5" stroke="currentColor" stroke-width="1.2"/>
            <line x1="4" y1="11.5" x2="10" y2="11.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <circle class="float-dot" cx="7" cy="5.5" r="2" fill="var(--neon-blue)" opacity="0"/>
          </svg>
        </button>
        <span class="title-sep"></span>
        <div class="win-controls">
          <button class="title-btn win-btn minimize-btn" @click="minimize" title="最小化">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M0 5H10" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
              <circle class="minimize-dot" cx="9" cy="5" r="1.2" fill="var(--neon-green)"/>
            </svg>
          </button>
          <button class="title-btn win-btn maximize-btn" @click="maximize" title="最大化">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <rect x="0.6" y="0.6" width="8.8" height="8.8" rx="1.5" stroke="currentColor" stroke-width="1.2"/>
              <path class="maximize-bracket" d="M3 3v4M3 3h4" stroke="var(--accent)" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </button>
          <button class="title-btn win-btn close-btn" @click="close" title="关闭">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <circle class="close-dot" cx="5" cy="5" r="0" fill="var(--neon-red)" opacity="0"/>
              <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <aside class="sidebar" :class="{ collapsed: isCollapsed }">
      <div class="logo">
        <div class="logo-icon">
          <img src="/logo_rounded.png" alt="Token Usage" class="logo-img" />
        </div>
        <Transition name="logo-text">
          <span v-show="!isCollapsed" class="logo-text">Token Usage</span>
        </Transition>
      </div>

      <nav class="sidebar-nav">
        <router-link
          v-for="item in navItems"
          :key="item.path"
          :to="item.path"
          class="nav-item"
          :class="{ active: $route.path === item.path }"
        >
          <div class="nav-icon-wrap">
            <!-- 仪表盘：仪表盘弧线 + 指针 -->
            <svg v-if="item.iconName === 'dashboard'" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 14 A8 8 0 1 1 16 14" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
              <line class="gauge-needle" x1="10" y1="10" x2="10" y2="4" stroke="var(--neon-amber)" stroke-width="1.5" stroke-linecap="round"/>
              <circle cx="10" cy="10" r="1.5" fill="var(--neon-amber)"/>
            </svg>
            <!-- 配置管理：齿轮 -->
            <svg v-else-if="item.iconName === 'config'" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <g class="gear-group">
                <circle cx="10" cy="10" r="4" stroke="currentColor" stroke-width="1.5" fill="none"/>
                <circle cx="10" cy="10" r="1.5" fill="var(--accent)"/>
                <line x1="10" y1="1" x2="10" y2="4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="10" y1="16" x2="10" y2="19" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="1" y1="10" x2="4" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="16" y1="10" x2="19" y2="10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </g>
            </svg>
            <!-- 用量详情：坐标轴 + 折线 -->
            <svg v-else-if="item.iconName === 'usage'" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <polyline points="3,2 3,16 18,16" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              <polyline class="trend-line" points="5,12 8,9 11,11 14,6 17,8" stroke="var(--neon-green)" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-dasharray="30" stroke-dashoffset="30"/>
              <circle class="trend-dot" cx="17" cy="8" r="2" fill="var(--neon-green)" opacity="0"/>
            </svg>
            <!-- 数据导出：箭头 + 托盘 -->
            <svg v-else-if="item.iconName === 'export'" width="20" height="20" viewBox="0 0 20 20" fill="none">
              <g class="download-arrow">
                <path d="M10 3v10" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                <path d="M6 9l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
              </g>
              <path d="M4 16h12" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              <circle class="download-dot" cx="10" cy="16" r="1.5" fill="var(--neon-blue)" opacity="0"/>
            </svg>
          </div>
          <Transition name="nav-label">
            <span v-show="!isCollapsed" class="nav-label">{{
              item.label
            }}</span>
          </Transition>
          <div v-if="$route.path === item.path" class="nav-active-bar"></div>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <button
          class="icon-btn"
          @click="toggleSidebar"
          :title="isCollapsed ? '展开' : '收起'"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <polyline class="chevron-1" :points="chevron1Points" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <polyline class="chevron-2" :points="chevron2Points" stroke="currentColor" stroke-width="1.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
            <circle class="toggle-dot" :cx="isCollapsed ? 15 : 14" cy="9" r="1.5" fill="var(--accent)" opacity="0"/>
          </svg>
        </button>
      </div>
    </aside>

    <main class="main-content" :class="{ collapsed: isCollapsed }">
      <div class="content-area">
        <slot />
      </div>
    </main>

    <!-- 关闭行为选择对话框 -->
    <Transition name="dialog-fade">
      <div v-if="showCloseDialog" class="close-dialog-overlay" @click.self="showCloseDialog = false">
        <div class="close-dialog glass-surface">
          <div class="close-dialog-header">
            <span class="close-dialog-title">关闭窗口</span>
          </div>
          <div class="close-dialog-body">
            <p class="close-dialog-desc">请选择关闭窗口后的行为</p>
            <div class="close-dialog-actions">
              <button class="close-dialog-btn primary" @click="chooseCloseAction('minimize-to-tray')">
                <el-icon :size="18"><Monitor /></el-icon>
                <span>隐藏到托盘</span>
              </button>
              <button class="close-dialog-btn secondary" @click="chooseCloseAction('quit')">
                <el-icon :size="18"><Close /></el-icon>
                <span>退出程序</span>
              </button>
            </div>
            <label class="close-dialog-remember">
              <input type="checkbox" v-model="closeRemember" />
              <span>记住我的选择</span>
            </label>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRoute } from "vue-router";
import {
  Sunny,
  Moon,
  Monitor,
  Close,
} from "@element-plus/icons-vue";
import { useThemeStore } from "@/stores/theme";
import type { AccentName } from "@/stores/theme";
import type { CloseAction } from "@/types/electron";
import ParticleBg from "./ParticleBg.vue";

const route = useRoute();
const themeStore = useThemeStore();
const isCollapsed = ref(false);
const floatActive = ref(false);

// 关闭对话框状态
const showCloseDialog = ref(false);
const closeRemember = ref(true);

function chooseCloseAction(action: CloseAction) {
  showCloseDialog.value = false;
  window.electronAPI.closeActionChosen(action, closeRemember.value);
}

// 悬浮窗状态管理
let unsubFloatClosed: (() => void) | undefined;
let unsubShowCloseDialog: (() => void) | undefined;
onMounted(async () => {
  // 窗口从托盘恢复时，清除可能残留的对话框状态
  showCloseDialog.value = false;

  try {
    const state = await window.electronAPI.getFloatWindowState();
    floatActive.value = state.active;
  } catch { /* ignore */ }
  unsubFloatClosed = window.electronAPI.onFloatWindowClosed(() => {
    floatActive.value = false;
  });
  // 监听主进程的关闭对话框请求
  unsubShowCloseDialog = window.electronAPI.onShowCloseDialog(() => {
    showCloseDialog.value = true;
  });
});
onUnmounted(() => {
  unsubFloatClosed?.();
  unsubShowCloseDialog?.();
});

const accents: { name: AccentName; color: string; label: string }[] = [
  { name: 'forest', color: '#6b9e7a', label: '森林绿' },
  { name: 'moss',   color: '#8fa870', label: '苔藓绿' },
  { name: 'matcha', color: '#82a888', label: '抹茶绿' },
];

// 检测是否为 macOS
const isMac = computed(() => {
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
});

interface NavItem {
  path: string;
  label: string;
  iconName: string;
}

const navItems: NavItem[] = [
  { path: "/dashboard", label: "仪表盘", iconName: "dashboard" },
  { path: "/config", label: "配置管理", iconName: "config" },
  { path: "/usage", label: "用量详情", iconName: "usage" },
  { path: "/export", label: "数据导出", iconName: "export" },
];

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value;
}

const chevron1Points = computed(() =>
  isCollapsed.value ? "7,4 12,9 7,14" : "11,4 6,9 11,14"
);
const chevron2Points = computed(() =>
  isCollapsed.value ? "11,4 16,9 11,14" : "15,4 10,9 15,14"
);

async function openFloat() {
  const result = await window.electronAPI.openFloatWindow();
  floatActive.value = result;
}

// 窗口控制函数
function minimize() {
  window.electronAPI.windowMinimize();
}

function maximize() {
  window.electronAPI.windowMaximize();
}

function close() {
  window.electronAPI.windowClose();
}
</script>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  background: var(--bg-primary);
}

/* ── Title Bar ── */
.title-bar {
  height: 36px;
  background: var(--sidebar-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 200;
  -webkit-app-region: drag;
  user-select: none;
}

.title-bar.is-mac {
  padding-left: 78px; /* 为 macOS 交通灯留出空间 */
}

.title-bar-drag {
  flex: 1;
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.title-bar-text {
  font-size: 13px;
  font-weight: 600;
  color: var(--accent);
}

.title-bar-controls {
  display: flex;
  align-items: center;
  -webkit-app-region: no-drag;
}

.title-btn {
  width: 46px;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s ease, color 0.15s ease;
  border-radius: 0;
}

.title-btn:hover {
  color: var(--text-primary);
}

/* 功能按钮（悬浮窗、设置菜单） */
.func-btn {
  border-radius: 6px;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.func-btn:hover {
  background: var(--glass-bg);
  color: var(--accent);
}

.func-btn:active {
  transform: scale(0.9);
}

.func-btn.active {
  color: var(--accent);
  background: var(--accent-glow);
  box-shadow: 0 0 8px var(--accent-glow);
}

.func-btn.active:hover {
  background: var(--accent-glow);
  color: var(--accent);
  box-shadow: 0 0 12px var(--accent-glow);
}

/* 标题栏分隔线 */
.title-sep {
  width: 1px;
  height: 16px;
  background: var(--border-light);
  margin: 0 2px;
}

/* 窗口控制按钮组 */
.win-controls {
  display: flex;
  align-items: center;
  margin-right: 2px;
  border-radius: 8px;
  overflow: hidden;
}

.win-btn {
  width: 40px;
  height: 32px;
  border-radius: 0;
  transition: background 0.15s ease, color 0.12s ease;
}

.win-btn:hover {
  background: rgba(255, 255, 255, 0.08);
  color: var(--text-primary);
}

.win-btn:active {
  background: rgba(255, 255, 255, 0.04);
  transition-duration: 0s;
}

.close-btn:hover {
  background: #e81123 !important;
  color: #fff !important;
}

.close-btn:active {
  background: #c42b1c !important;
  transition-duration: 0s;
}

/* ── 窗口控制按钮动画 ── */
.minimize-dot {
  transition: cx 0.3s var(--ease-spring);
}
.minimize-btn:hover .minimize-dot {
  cx: 5;
}

.maximize-bracket {
  transition: transform 0.3s var(--ease-spring);
  transform: scale(0.7);
  transform-origin: 5px 5px;
}
.maximize-btn:hover .maximize-bracket {
  transform: scale(1);
}

.close-dot {
  transition: r 0.3s var(--ease-spring), opacity 0.3s var(--ease-spring);
}
.close-btn:hover .close-dot {
  r: 2.5;
  opacity: 0.6;
}

/* ── 悬浮窗按钮动画 ── */
.float-dot {
  transition: opacity 0.3s var(--ease-spring), r 0.3s var(--ease-spring);
}
.func-btn:hover .float-dot {
  opacity: 0.8;
  r: 2;
}
.func-btn.active .float-dot {
  opacity: 0.6;
  r: 2;
}

/* ── 导航图标动画 ── */
.gauge-needle {
  transform: rotate(-45deg);
  transform-origin: 10px 10px;
  transition: transform 0.3s var(--ease-spring);
}
.nav-item:hover .gauge-needle,
.nav-item.active .gauge-needle {
  transform: rotate(45deg);
}

.gear-group {
  transform-origin: 10px 10px;
  transition: transform 0.3s var(--ease-spring);
}
.nav-item:hover .gear-group {
  transform: rotate(60deg);
}
.nav-item.active .gear-group {
  transform: rotate(30deg);
}

.trend-line {
  transition: stroke-dashoffset 0.3s var(--ease-spring);
}
.trend-dot {
  transition: opacity 0.3s var(--ease-spring) 0.1s;
}
.nav-item:hover .trend-line,
.nav-item.active .trend-line {
  stroke-dashoffset: 0;
}
.nav-item:hover .trend-dot,
.nav-item.active .trend-dot {
  opacity: 1;
}

.download-arrow {
  transition: transform 0.3s var(--ease-spring);
}
.download-dot {
  transition: opacity 0.3s var(--ease-spring) 0.08s;
}
.nav-item:hover .download-arrow {
  transform: translateY(2px);
}
.nav-item:hover .download-dot,
.nav-item.active .download-dot {
  opacity: 1;
}

/* ── 折叠按钮动画 ── */
.chevron-2 {
  transition: transform 0.3s var(--ease-spring);
}
.toggle-dot {
  transition: opacity 0.3s var(--ease-spring);
}
.icon-btn:hover .toggle-dot {
  opacity: 1;
}
.icon-btn:hover .chevron-2 {
  transform: translateX(1px);
}

/* ── Sidebar ── */
.sidebar {
  width: 240px;
  background: var(--sidebar-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-right: 1px solid var(--glass-border);
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 36px; /* 从标题栏下方开始 */
  bottom: 0;
  z-index: 100;
  transition: width var(--duration-normal) var(--ease-spring);
  overflow: hidden;
}

.sidebar.collapsed {
  width: 72px;
}

/* ── Logo ── */
.logo {
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 0 20px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border-light);
}

.logo-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
}

.logo-glow {
  display: none;
}

.logo-letter {
  display: none;
}

.logo-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  position: relative;
  z-index: 1;
}

.logo-text {
  font-size: 17px;
  font-weight: 700;
  white-space: nowrap;
  color: var(--accent);
}

.logo-text-enter-active {
  transition: all var(--duration-normal) var(--ease-spring);
}
.logo-text-leave-active {
  transition: all var(--duration-fast) var(--ease-smooth);
}
.logo-text-enter-from {
  opacity: 0;
  transform: translateX(-8px);
}
.logo-text-leave-to {
  opacity: 0;
  transform: translateX(-8px);
}

/* ── Navigation ── */
.sidebar-nav {
  flex: 1;
  padding: 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow-y: auto;
  overflow-x: hidden;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  border-radius: 12px;
  text-decoration: none;
  color: var(--text-secondary);
  position: relative;
  transition: all var(--duration-normal) var(--ease-smooth);
  cursor: pointer;
}

.nav-item:hover {
  color: var(--text-primary);
  background: var(--glass-bg);
}

.nav-item.active {
  color: var(--accent);
  background: var(--accent-glow);
}

.nav-icon-wrap {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--duration-normal) var(--ease-spring);
}

.nav-item:hover .nav-icon-wrap {
  transform: scale(1.1);
}

.nav-item.active .nav-icon-wrap {
  transform: scale(1.1);
}

.nav-label {
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.nav-active-bar {
  position: absolute;
  right: 0;
  top: 50%;
  transform: translateY(-50%);
  width: 3px;
  height: 20px;
  border-radius: 3px 0 0 3px;
  background: var(--accent-gradient);
  animation: scaleIn var(--duration-normal) var(--ease-spring) both;
}

.nav-label-enter-active {
  transition: all var(--duration-normal) var(--ease-spring);
}
.nav-label-leave-active {
  transition: all var(--duration-fast) var(--ease-smooth);
}
.nav-label-enter-from {
  opacity: 0;
  transform: translateX(-6px);
}
.nav-label-leave-to {
  opacity: 0;
  transform: translateX(-6px);
}

/* ── Sidebar footer ── */
.sidebar-footer {
  padding: 16px;
  display: flex;
  justify-content: center;
  border-top: 1px solid var(--border-light);
  flex-shrink: 0;
}

/* ── Main content ── */
.main-content {
  flex: 1;
  margin-left: 240px;
  margin-top: 36px; /* 标题栏高度 */
  display: flex;
  flex-direction: column;
  height: calc(100dvh - 36px);
  height: calc(100vh - 36px);
  overflow: hidden;
  transition: margin-left var(--duration-normal) var(--ease-spring);
}

.main-content.collapsed {
  margin-left: 72px;
}

/* ── Title bar menu ── */
.menu-btn {
  width: 36px;
  height: 36px;
  border-radius: 6px;
  -webkit-app-region: no-drag;
  transition: background 0.15s ease, color 0.15s ease, transform 0.15s ease;
}

.menu-btn:hover {
  background: var(--glass-bg);
  color: var(--accent);
}

.menu-btn:active {
  transform: scale(0.9);
}

.menu-icon .knob {
  transition: cx 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.menu-btn:hover .knob-1 { cx: 10; }
.menu-btn:hover .knob-2 { cx: 6; }
.menu-btn:hover .knob-3 { cx: 11; }

.title-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin: -4px;
}

.menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-primary);
  cursor: pointer;
  transition: background 0.15s ease;
}

.menu-item:hover {
  background: var(--glass-bg);
}

.menu-divider {
  height: 1px;
  background: var(--border-light);
  margin: 4px 0;
}

.menu-group {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
}

.menu-label {
  font-size: 12px;
  color: var(--text-secondary);
}

/* ── Accent selector ── */
.accent-group {
  display: flex;
  align-items: center;
  gap: 6px;
}
.accent-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.2s var(--ease-smooth);
  outline: none;
  padding: 0;
}
.accent-dot:hover {
  transform: scale(1.2);
}
.accent-dot.active {
  border-color: var(--text-primary);
  box-shadow: 0 0 8px var(--accent-glow);
}

/* ── Content ── */
.content-area {
  flex: 1;
  min-height: 0; /* 关键：允许 flex 子项收缩到内容高度以下，使 overflow 生效 */
  padding: 15px;
  overflow-y: auto;
  overflow-x: hidden;
  scrollbar-gutter: stable;
}

/* ── Close Dialog ── */
.close-dialog-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.35);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-dialog {
  width: 360px;
  border-radius: 20px;
  padding: 0;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.close-dialog-header {
  padding: 20px 24px 0;
}

.close-dialog-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text-primary);
}

.close-dialog-body {
  padding: 16px 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.close-dialog-desc {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
  line-height: 1.5;
}

.close-dialog-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.close-dialog-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 20px;
  border-radius: 12px;
  border: 1px solid var(--glass-border);
  font-size: 14px;
  font-weight: 600;
  font-family: inherit;
  cursor: pointer;
  transition: all var(--duration-normal) var(--ease-smooth);
}

.close-dialog-btn.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.close-dialog-btn.primary:hover {
  opacity: 0.9;
  box-shadow: 0 0 20px var(--accent-glow);
}

.close-dialog-btn.primary:active {
  transform: scale(0.97);
}

.close-dialog-btn.secondary {
  background: var(--glass-bg);
  color: var(--text-secondary);
}

.close-dialog-btn.secondary:hover {
  background: var(--glass-bg-strong);
  color: var(--text-primary);
  border-color: var(--border-color);
}

.close-dialog-btn.secondary:active {
  transform: scale(0.97);
}

.close-dialog-remember {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-secondary);
  cursor: pointer;
  user-select: none;
}

.close-dialog-remember input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--accent);
  cursor: pointer;
}

/* ── Dialog animation ── */
.dialog-fade-enter-active {
  transition: all var(--duration-normal) var(--ease-spring);
}

.dialog-fade-leave-active {
  transition: all var(--duration-fast) var(--ease-smooth);
}

.dialog-fade-enter-from,
.dialog-fade-leave-to {
  opacity: 0;
}

.dialog-fade-enter-from .close-dialog {
  transform: scale(0.92) translateY(12px);
  opacity: 0;
}

.dialog-fade-leave-to .close-dialog {
  transform: scale(0.96) translateY(4px);
  opacity: 0;
}
</style>
