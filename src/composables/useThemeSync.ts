import { ref, onMounted } from 'vue'

export interface ThemeState {
  mode: string
  accent: string
  preset: string
}

/**
 * 辅窗口主题同步 composable
 * 从主进程获取当前主题，失败时回退到 localStorage
 */
export function useThemeSync() {
  const theme = ref('dark')
  const accent = ref('forest')
  const preset = ref('default')

  onMounted(async () => {
    try {
      const t = await window.electronAPI.getTheme()
      if (t) {
        theme.value = t.mode
        accent.value = t.accent
        preset.value = t.preset
        return
      }
    } catch {
      // 主进程不可用，回退到 localStorage
    }
    const savedTheme = localStorage.getItem('theme')
    if (savedTheme) theme.value = savedTheme
    const savedPreset = localStorage.getItem('preset')
    if (savedPreset) preset.value = savedPreset
  })

  return { theme, accent, preset }
}
