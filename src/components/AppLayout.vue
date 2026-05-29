<template>
  <div class="app-layout">
    <ParticleBg />

    <!-- 自定义标题栏 -->
    <div class="title-bar" :class="{ 'is-mac': isMac }">
      <div class="title-bar-drag">
        <span v-if="isMac" class="title-bar-text">Token Usage</span>
      </div>
      <div v-if="!isMac" class="title-bar-controls">
        <button class="title-btn" @click="minimize" title="最小化">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect
              x="1"
              y="5.5"
              width="10"
              height="1"
              rx="0.5"
              fill="currentColor"
            />
          </svg>
        </button>
        <button class="title-btn" @click="maximize" title="最大化">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <rect
              x="1.5"
              y="1.5"
              width="9"
              height="9"
              rx="1"
              stroke="currentColor"
              stroke-width="1"
            />
          </svg>
        </button>
        <button class="title-btn close-btn" @click="close" title="关闭">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 2L10 10M10 2L2 10"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linecap="round"
            />
          </svg>
        </button>
      </div>
    </div>

    <aside class="sidebar" :class="{ collapsed: isCollapsed }">
      <div class="logo">
        <div class="logo-icon">
          <img src="/logo.png" alt="Token Usage" class="logo-img" />
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
            <el-icon :size="20"><component :is="item.icon" /></el-icon>
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
          <el-icon :size="18">
            <component :is="isCollapsed ? Expand : Fold" />
          </el-icon>
        </button>
      </div>
    </aside>

    <main class="main-content" :class="{ collapsed: isCollapsed }">
      <header class="header glass-header">
        <h2 class="page-title">{{ title }}</h2>
        <div class="header-actions">
          <button class="icon-btn" @click="openFloat" title="悬浮窗">
            <el-icon :size="18"><Monitor /></el-icon>
          </button>
          <button
            class="icon-btn theme-toggle"
            @click="themeStore.toggleTheme()"
          >
            <Transition name="theme-icon" mode="out-in">
              <el-icon v-if="themeStore.isDark" :size="18" key="sun"
                ><Sunny
              /></el-icon>
              <el-icon v-else :size="18" key="moon"><Moon /></el-icon>
            </Transition>
          </button>
        </div>
      </header>

      <div class="content-area">
        <slot />
      </div>
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useRoute } from "vue-router";
import {
  Odometer,
  Setting,
  TrendCharts,
  Download,
  Expand,
  Fold,
  Sunny,
  Moon,
  Monitor,
} from "@element-plus/icons-vue";
import { useThemeStore } from "@/stores/theme";
import type { Component } from "vue";
import ParticleBg from "./ParticleBg.vue";

const route = useRoute();
const themeStore = useThemeStore();
const isCollapsed = ref(false);

// 检测是否为 macOS
const isMac = computed(() => {
  return navigator.platform.toUpperCase().indexOf("MAC") >= 0;
});

interface NavItem {
  path: string;
  label: string;
  icon: Component;
}

const navItems: NavItem[] = [
  { path: "/dashboard", label: "仪表盘", icon: Odometer },
  { path: "/config", label: "配置管理", icon: Setting },
  { path: "/usage", label: "用量详情", icon: TrendCharts },
  { path: "/export", label: "数据导出", icon: Download },
];

const title = computed(() => {
  const item = navItems.find((n) => n.path === route.path);
  return item?.label || "Token Usage";
});

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value;
}

function openFloat() {
  window.electronAPI.openFloatWindow();
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
  color: var(--text-secondary);
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
  transition: all 0.15s ease;
}

.title-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text-primary);
}

.title-btn.close-btn:hover {
  background: #e81123;
  color: #fff;
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
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
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
  /* 使用 dvh (dynamic viewport height) 优先，回退到 vh */
  height: calc(100dvh - 36px);
  height: calc(100vh - 36px);
  overflow: hidden;
  transition: margin-left var(--duration-normal) var(--ease-spring);
}

.main-content.collapsed {
  margin-left: 72px;
}

/* ── Header ── */
.glass-header {
  height: 68px;
  background: var(--header-bg);
  backdrop-filter: blur(var(--glass-blur));
  -webkit-backdrop-filter: blur(var(--glass-blur));
  border-bottom: 1px solid var(--border-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
  flex-shrink: 0;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  background: var(--accent-gradient);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* ── Theme toggle ── */
.theme-toggle {
  position: relative;
  overflow: hidden;
}

.theme-icon-enter-active {
  transition: all 0.4s var(--ease-spring);
}
.theme-icon-leave-active {
  transition: all 0.15s var(--ease-smooth);
}
.theme-icon-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}
.theme-icon-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}

/* ── Content ── */
.content-area {
  flex: 1;
  min-height: 0; /* 关键：允许 flex 子项收缩到内容高度以下，使 overflow 生效 */
  padding: 15px;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
