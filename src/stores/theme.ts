import { defineStore } from 'pinia'
import { ref } from 'vue'

export type AccentName = 'forest' | 'moss' | 'matcha'

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(false)
  const accent = ref<AccentName>('forest')

  function toggleTheme() {
    isDark.value = !isDark.value
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  function setAccent(name: AccentName) {
    accent.value = name
    localStorage.setItem('accent', name)
    applyTheme()
  }

  function initTheme() {
    // 明暗模式
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      isDark.value = true
    } else if (savedTheme === 'light') {
      isDark.value = false
    } else {
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }
    // 色调
    const savedAccent = localStorage.getItem('accent') as AccentName | null
    if (savedAccent && ['forest', 'moss', 'matcha'].includes(savedAccent)) {
      accent.value = savedAccent
    }
    applyTheme()
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
    document.documentElement.setAttribute('data-accent', accent.value)
    // 供悬浮窗等独立窗口读取
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    localStorage.setItem('accent', accent.value)
    // 通知主进程广播给所有悬浮窗口
    if (window.electronAPI?.notifyThemeChanged) {
      window.electronAPI.notifyThemeChanged({
        mode: isDark.value ? 'dark' : 'light',
        accent: accent.value
      })
    }
  }

  return {
    isDark,
    accent,
    toggleTheme,
    setAccent,
    initTheme
  }
})
