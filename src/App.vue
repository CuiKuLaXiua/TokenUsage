<template>
  <AppLayout v-if="!isFloatRoute">
    <router-view />
    <LoginNotification />
  </AppLayout>
  <router-view v-else />
</template>

<script setup lang="ts">
import AppLayout from '@/components/AppLayout.vue'
import LoginNotification from '@/components/LoginNotification.vue'
import { useThemeStore } from '@/stores/theme'
import { useAppStore } from '@/stores/app'
import { useRoute } from 'vue-router'
import { computed, onMounted } from 'vue'

const route = useRoute()
const themeStore = useThemeStore()
const appStore = useAppStore()
const isFloatRoute = computed(() => route.path.startsWith('/float') || route.path === '/ctx-menu')

onMounted(async () => {
  themeStore.initTheme()
  await appStore.loadConfig()
})
</script>

<style>
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,500;0,9..40,700;1,9..40,400&display=swap');
@import './styles/sci-fi.css';

/* ── Reset ── */
*,
*::before,
*::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

body {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  background-color: var(--bg-primary);
  color: var(--text-primary);
  transition: background-color var(--duration-slow) var(--ease-smooth),
              color var(--duration-slow) var(--ease-smooth);
  overflow: hidden;
}

::selection {
  background: var(--accent);
  color: #fff;
}

/* ── Scrollbar ── */
::-webkit-scrollbar {
  width: 4px;
  height: 4px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: var(--border-color);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: var(--text-placeholder);
}

/* ── Animations ── */
@keyframes fadeSlideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes fadeSlideDown {
  from {
    opacity: 0;
    transform: translateY(-12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes scaleIn {
  from {
    opacity: 0;
    transform: scale(0.92);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes pulseGlow {
  0%, 100% {
    box-shadow: 0 0 20px var(--accent-glow);
  }
  50% {
    box-shadow: 0 0 40px var(--accent-glow), 0 0 60px rgba(0, 212, 255, 0.1);
  }
}

@keyframes float {
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-8px);
  }
}

@keyframes shimmer {
  0% {
    background-position: -200% 0;
  }
  100% {
    background-position: 200% 0;
  }
}

@keyframes strokeDraw {
  from {
    stroke-dashoffset: 283;
  }
}

/* ── Page transition ── */
.page-enter-active {
  transition: opacity var(--duration-normal) var(--ease-smooth),
              transform var(--duration-normal) var(--ease-spring);
}

.page-leave-active {
  transition: opacity var(--duration-fast) var(--ease-smooth);
  position: absolute;
  width: 100%;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.page-leave-to {
  opacity: 0;
}

/* ── Element Plus overrides ── */
[data-theme="dark"] .el-card {
  background-color: var(--card-bg);
  border-color: var(--border-color);
}

[data-theme="dark"] .el-table {
  background-color: transparent;
  color: var(--text-primary);
}

[data-theme="dark"] .el-table th.el-table__cell {
  background-color: var(--glass-bg);
  color: var(--text-primary);
}

[data-theme="dark"] .el-table td.el-table__cell {
  border-bottom-color: var(--border-light);
}

[data-theme="dark"] .el-table--enable-row-hover .el-table__body tr:hover > td.el-table__cell {
  background-color: var(--glass-bg);
}

[data-theme="dark"] .el-dialog {
  background-color: var(--glass-bg-strong);
}

[data-theme="dark"] .el-dialog__title {
  color: var(--text-primary);
}

[data-theme="dark"] .el-form-item__label {
  color: var(--text-secondary);
}

[data-theme="dark"] .el-input__wrapper {
  background-color: var(--glass-bg);
  box-shadow: 0 0 0 1px var(--border-color) inset;
}

[data-theme="dark"] .el-input__inner {
  color: var(--text-primary);
}

[data-theme="dark"] .el-select .el-input__wrapper {
  background-color: var(--glass-bg);
}

[data-theme="dark"] .el-menu {
  background-color: transparent;
  border-right-color: var(--border-color);
}

[data-theme="dark"] .el-menu-item {
  color: var(--text-secondary);
}

[data-theme="dark"] .el-menu-item:hover,
[data-theme="dark"] .el-menu-item.is-active {
  background-color: var(--glass-bg);
  color: var(--text-primary);
}

[data-theme="dark"] .el-progress-bar__outer {
  background-color: var(--bg-tertiary);
}

[data-theme="dark"] .el-empty__description p {
  color: var(--text-secondary);
}

/* ── Element Plus glass overrides (both themes) ── */
.el-dialog {
  background: var(--glass-bg-strong) !important;
  backdrop-filter: blur(24px) !important;
  -webkit-backdrop-filter: blur(24px) !important;
  border: 1px solid var(--glass-border);
  border-radius: 16px !important;
  box-shadow: 0 24px 80px rgba(0, 0, 0, 0.15) !important;
}

.el-overlay .el-dialog {
  animation: scaleIn var(--duration-normal) var(--ease-spring) both;
}

.el-message {
  background: var(--glass-bg-strong) !important;
  backdrop-filter: blur(16px) !important;
  -webkit-backdrop-filter: blur(16px) !important;
  border: 1px solid var(--glass-border) !important;
  border-radius: 12px !important;
  box-shadow: var(--glass-shadow-hover) !important;
}
</style>
