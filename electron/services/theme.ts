import { BrowserWindow } from 'electron'
import { existsSync, readFileSync } from 'fs'
import { configPath } from './persistence'

export interface Theme {
  mode: string
  accent: string
  preset: string
}

function loadThemeFromConfig(): Theme | null {
  try {
    if (!existsSync(configPath)) return null
    const config = JSON.parse(readFileSync(configPath, 'utf-8'))
    const theme = config?.theme
    if (
      theme &&
      typeof theme === 'object' &&
      typeof theme.mode === 'string' &&
      typeof theme.accent === 'string' &&
      typeof theme.preset === 'string'
    ) {
      return { mode: theme.mode, accent: theme.accent, preset: theme.preset }
    }
  } catch {
    /* ignore */
  }
  return null
}

class ThemeService {
  readonly targets = new Set<BrowserWindow>()
  current: Theme = loadThemeFromConfig() ?? { mode: 'dark', accent: 'forest', preset: 'midnight' }

  register(win: BrowserWindow): void {
    this.targets.add(win)

    // 页面加载完成后立即同步当前主题，消除首屏闪烁。
    // 若窗口已加载完成则直接发送。
    const sendInit = () => this.initWindow(win)
    if (win.webContents.isLoadingMainFrame()) {
      win.webContents.once('did-finish-load', sendInit)
    } else {
      sendInit()
    }

    win.on('closed', () => this.targets.delete(win))
  }

  /**
   * 广播主题变更给所有已注册窗口。
   */
  broadcast(theme: Theme): void {
    this.current = { ...theme }
    this.targets.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send('theme-changed', theme)
      }
    })
  }

  /**
   * 向单个窗口发送初始主题，避免首屏闪烁。
   */
  initWindow(win: BrowserWindow): void {
    if (!win.isDestroyed()) {
      win.webContents.send('theme:init', this.current)
    }
  }

  get(): Theme {
    return { ...this.current }
  }

  get mode(): 'dark' | 'light' {
    return this.current.mode === 'light' ? 'light' : 'dark'
  }
}

export const themeService = new ThemeService()
