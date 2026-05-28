<template>
  <div class="app-layout">
    <ParticleBg />
    <aside class="sidebar" :class="{ collapsed: isCollapsed }">
      <div class="logo">
        <div class="logo-icon">
          <div class="logo-glow"></div>
          <span class="logo-letter">T</span>
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
            <span v-show="!isCollapsed" class="nav-label">{{ item.label }}</span>
          </Transition>
          <div v-if="$route.path === item.path" class="nav-active-bar"></div>
        </router-link>
      </nav>

      <div class="sidebar-footer">
        <button class="icon-btn" @click="toggleSidebar" :title="isCollapsed ? '展开' : '收起'">
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
          <button class="icon-btn theme-toggle" @click="themeStore.toggleTheme()">
            <Transition name="theme-icon" mode="out-in">
              <el-icon v-if="themeStore.isDark" :size="18" key="sun"><Sunny /></el-icon>
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
import { ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import {
  Odometer,
  Setting,
  TrendCharts,
  Download,
  Expand,
  Fold,
  Sunny,
  Moon,
  Monitor
} from '@element-plus/icons-vue'
import { useThemeStore } from '@/stores/theme'
import type { Component } from 'vue'
import ParticleBg from './ParticleBg.vue'

const route = useRoute()
const themeStore = useThemeStore()
const isCollapsed = ref(false)

interface NavItem {
  path: string
  label: string
  icon: Component
}

const navItems: NavItem[] = [
  { path: '/dashboard', label: '仪表盘', icon: Odometer },
  { path: '/config', label: '配置管理', icon: Setting },
  { path: '/usage', label: '用量详情', icon: TrendCharts },
  { path: '/export', label: '数据导出', icon: Download }
]

const title = computed(() => {
  const item = navItems.find(n => n.path === route.path)
  return item?.label || 'Token Usage'
})

function toggleSidebar() {
  isCollapsed.value = !isCollapsed.value
}

function openFloat() {
  window.electronAPI.openFloatWindow()
}
</script>

<style scoped>
.app-layout {
  display: flex;
  min-height: 100vh;
  background: var(--bg-primary);
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
  top: 0;
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
  background: var(--accent-gradient);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  flex-shrink: 0;
}

.logo-glow {
  position: absolute;
  inset: -4px;
  border-radius: 16px;
  background: var(--accent-gradient);
  opacity: 0.3;
  filter: blur(10px);
  animation: pulseGlow 3s ease-in-out infinite;
}

.logo-letter {
  color: #fff;
  font-weight: 700;
  font-size: 20px;
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
  display: flex;
  flex-direction: column;
  min-height: 100vh;
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
  position: sticky;
  top: 0;
  z-index: 50;
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
  padding: 28px;
  overflow-y: auto;
  overflow-x: hidden;
}
</style>
