import { ref, onMounted, onUnmounted } from 'vue'

export interface ThemeState {
  mode: string
  accent: string
  preset: string
}

/**
 * 辅窗口主题同步 composable
 *
 * 优先通过 `theme:init` 从主进程同步初始主题，消除首屏闪烁；
 * 同时监听 `theme-changed` 实现实时更新；
 * 若主进程不可用则回退到 localStorage。
 *
 * 注意：监听器必须在 setup 阶段（尽可能早）注册，
 * 因为主进程在 `did-finish-load` 时就会发送 `theme:init`，
 * 等到 onMounted 再注册可能错过该事件。
 */
export function useThemeSync() {
  const theme = ref('dark')
  const accent = ref('forest')
  const preset = ref('default')

  let receivedInit = false

  function apply(t: ThemeState) {
    theme.value = t.mode
    accent.value = t.accent
    preset.value = t.preset
  }

  // 在 setup 阶段立即注册，避免错过 did-finish-load 时发送的 theme:init
  const themeInitUnsub = window.electronAPI.onThemeInit((t) => {
    receivedInit = true
    apply(t)
  })
  const themeChangedUnsub = window.electronAPI.onThemeChanged((t) => {
    apply(t)
  })

  onMounted(() => {
    // 若窗口加载极快，theme:init 可能已在 onMounted 之前到达；
    // 这种情况下回调会被立即触发。否则主动拉取一次作为兜底。
    if (!receivedInit) {
      window.electronAPI.getTheme().then((t) => {
        if (t && !receivedInit) apply(t)
      }).catch(() => {
        const savedTheme = localStorage.getItem('theme')
        if (savedTheme) theme.value = savedTheme
        const savedAccent = localStorage.getItem('accent')
        if (savedAccent) accent.value = savedAccent
        const savedPreset = localStorage.getItem('preset')
        if (savedPreset) preset.value = savedPreset
      })
    }
  })

  onUnmounted(() => {
    themeInitUnsub()
    themeChangedUnsub()
  })

  return { theme, accent, preset }
}
