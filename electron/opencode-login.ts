import { BrowserWindow, session } from 'electron'

const LOGIN_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
const OPENCODE_DOMAIN = 'opencode.ai'

export class OpenCodeLoginWindowManager {
  private loginWindow: BrowserWindow | null = null
  private loginCompleteCallback: ((data: { cookies: string, apiUrl: string | null } | null) => void) | null = null
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null
  private resolved = false
  private capturedApiUrl: string | null = null

  async openLoginWindow(url: string, parentWindow?: BrowserWindow): Promise<void> {
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.focus()
      return
    }

    this.resolved = false
    this.capturedApiUrl = null

    // 清除 OpenCode cookies
    console.log('[OpenCodeLogin] 清除 OpenCode cookies...')
    const cookies = await session.defaultSession.cookies.get({ domain: OPENCODE_DOMAIN })
    for (const cookie of cookies) {
      if (cookie.domain) {
        await session.defaultSession.cookies.remove(cookie.domain, cookie.name)
      }
    }
    console.log('[OpenCodeLogin] 已清除', cookies.length, '个 cookies')
    await new Promise(resolve => setTimeout(resolve, 500))

    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: 900,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    }

    if (parentWindow && !parentWindow.isDestroyed()) {
      windowOptions.parent = parentWindow
    }

    this.loginWindow = new BrowserWindow(windowOptions)

    // 监听 _server 请求，自动捕获完整 URL
    this.loginWindow.webContents.session.webRequest.onBeforeRequest(
      { urls: ['*://opencode.ai/_server*'] },
      (details, callback) => {
        if (!this.capturedApiUrl && details.url.includes('_server?id=')) {
          this.capturedApiUrl = details.url
          console.log('[OpenCodeLogin] 自动捕获到 API URL')
        }
        callback({})
      }
    )

    console.log('[OpenCodeLogin] 加载登录页:', url)
    this.loginWindow.loadURL(url)

    // 用户手动关闭窗口时提取数据
    this.loginWindow.on('close', () => {
      console.log('[OpenCodeLogin] 用户关闭了窗口，提取数据...')
      this.extractAndFinish()
    })

    this.loginWindow.on('closed', () => {
      this.clearTimer()
      this.loginWindow = null
    })

    // 超时保护
    this.timeoutTimer = setTimeout(() => {
      console.warn('[OpenCodeLogin] 登录超时')
      if (!this.resolved) {
        this.triggerCallback(null)
      }
      if (this.loginWindow && !this.loginWindow.isDestroyed()) {
        this.loginWindow.close()
      }
    }, LOGIN_TIMEOUT_MS)
  }

  onLoginComplete(callback: (data: { cookies: string, apiUrl: string | null } | null) => void): void {
    this.loginCompleteCallback = callback
  }

  /**
   * 用户关闭窗口时提取 cookies 和 API URL
   */
  private async extractAndFinish(): Promise<void> {
    if (this.resolved) return

    try {
      const cookies = this.loginWindow
        ? await this.loginWindow.webContents.session.cookies.get({})
        : await session.defaultSession.cookies.get({})

      const opencodeCookies = cookies.filter(c => c.domain?.includes(OPENCODE_DOMAIN))

      if (opencodeCookies.length > 0) {
        const cookieString = opencodeCookies.map(c => `${c.name}=${c.value}`).join('; ')
        console.log('[OpenCodeLogin] 提取到', opencodeCookies.length, '个 cookies')
        this.triggerCallback({ cookies: cookieString, apiUrl: this.capturedApiUrl })
      } else {
        console.warn('[OpenCodeLogin] 未提取到 opencode.ai cookies')
        this.triggerCallback(null)
      }
    } catch (error) {
      console.error('[OpenCodeLogin] 提取 cookies 失败:', error)
      this.triggerCallback(null)
    }
  }

  private triggerCallback(data: { cookies: string, apiUrl: string | null } | null): void {
    if (this.resolved) return
    this.resolved = true
    this.clearTimer()

    if (this.loginCompleteCallback) {
      this.loginCompleteCallback(data)
      this.loginCompleteCallback = null
    }
  }

  private clearTimer(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer)
      this.timeoutTimer = null
    }
  }

  getLoginWindow(): BrowserWindow | null {
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      return this.loginWindow
    }
    return null
  }
}
