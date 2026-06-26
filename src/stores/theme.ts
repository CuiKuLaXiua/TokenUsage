import { defineStore } from 'pinia'
import { ref } from 'vue'

export type AccentName = 'forest' | 'moss' | 'matcha' | 'cyber' | 'sunset' | 'sakura' | 'mono'
export type PresetName = 'default' | 'midnight' | 'aurora' | 'cyber' | 'sunset' | 'sakura' | 'mono'

/** 仅支持暗色模式的预设 */
const DARK_ONLY_PRESETS: PresetName[] = ['midnight', 'aurora']

export const useThemeStore = defineStore('theme', () => {
  const isDark = ref(false)
  const accent = ref<AccentName>('forest')
  // 推荐主力主题：Midnight Pro
  const preset = ref<PresetName>('midnight')

  function toggleTheme() {
    isDark.value = !isDark.value
    // 暗色独占预设切到浅色时自动回退到 default preset
    if (!isDark.value && DARK_ONLY_PRESETS.includes(preset.value)) {
      preset.value = 'default'
      localStorage.setItem('preset', 'default')
    }
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    applyTheme()
  }

  function setAccent(name: AccentName) {
    accent.value = name
    localStorage.setItem('accent', name)
    applyTheme()
  }

  function setPreset(name: PresetName) {
    preset.value = name
    localStorage.setItem('preset', name)
    // 暗色独占预设强制暗色模式
    if (DARK_ONLY_PRESETS.includes(name) && !isDark.value) {
      isDark.value = true
      localStorage.setItem('theme', 'dark')
    }
    applyTheme()
  }

  function initTheme() {
    // 主题方案
    const savedPreset = localStorage.getItem('preset') as PresetName | null
    if (savedPreset && ['default', 'midnight', 'aurora', 'cyber', 'sunset', 'sakura', 'mono'].includes(savedPreset)) {
      preset.value = savedPreset
    } else {
      preset.value = 'midnight'
      localStorage.setItem('preset', 'midnight')
    }

    // 明暗模式
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme === 'dark') {
      isDark.value = true
    } else if (savedTheme === 'light') {
      isDark.value = false
    } else {
      isDark.value = window.matchMedia('(prefers-color-scheme: dark)').matches
    }

    // 暗色独占预设强制暗色
    if (DARK_ONLY_PRESETS.includes(preset.value) && !isDark.value) {
      isDark.value = true
    }

    // 色调
    const savedAccent = localStorage.getItem('accent') as AccentName | null
    if (savedAccent && ['forest', 'moss', 'matcha', 'cyber', 'sunset', 'sakura', 'mono'].includes(savedAccent)) {
      accent.value = savedAccent
    }
    applyTheme()
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-theme', isDark.value ? 'dark' : 'light')
    document.documentElement.setAttribute('data-accent', accent.value)
    document.documentElement.setAttribute('data-preset', preset.value)
    // 供悬浮窗等独立窗口读取
    localStorage.setItem('theme', isDark.value ? 'dark' : 'light')
    localStorage.setItem('accent', accent.value)
    localStorage.setItem('preset', preset.value)
    // 通知主进程广播给所有悬浮窗口
    if (window.electronAPI?.notifyThemeChanged) {
      window.electronAPI.notifyThemeChanged({
        mode: isDark.value ? 'dark' : 'light',
        accent: accent.value,
        preset: preset.value
      })
    }
  }

  return {
    isDark,
    accent,
    preset,
    toggleTheme,
    setAccent,
    setPreset,
    initTheme
  }
})
