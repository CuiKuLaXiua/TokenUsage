import { BrowserWindow, session } from 'electron'

const LOGIN_TIMEOUT_MS = 10 * 60 * 1000 // 10 minutes
const OPENCODE_DOMAIN = 'opencode.ai'

export interface OpenCodeLoginResult {
  cookies: string
  apiUrl: string | null
  api1ServerId: string | null
  api1Instance: string | null
  api2ServerId: string | null
  api2Instance: string | null
  api3ServerId: string | null
  api3Instance: string | null
}

interface CapturedRequest {
  serverId: string
  instance: string
  method: 'GET' | 'POST'
  phase: 'login' | 'go' | 'usage'
}

// 解析 "server-fn:2" → 2
function extractInstanceNum(instance: string): number {
  const match = instance.match(/:(\d+)$/)
  return match ? parseInt(match[1], 10) : 0
}

export class OpenCodeLoginWindowManager {
  private loginWindow: BrowserWindow | null = null
  private loginCompleteCallback: ((data: OpenCodeLoginResult | null) => void) | null = null
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null
  private resolved = false
  private capturedApiUrl: string | null = null
  private capturedRequests: CapturedRequest[] = []
  private workspaceId: string | null = null
  private currentPhase: 'login' | 'go' | 'usage' = 'login'

  async openLoginWindow(url: string, parentWindow?: BrowserWindow): Promise<void> {
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.focus()
      return
    }

    this.resolved = false
    this.capturedApiUrl = null
    this.capturedRequests = []
    this.workspaceId = null
    this.currentPhase = 'login'

    const cookies = await session.defaultSession.cookies.get({ domain: OPENCODE_DOMAIN })
    for (const cookie of cookies) {
      if (cookie.domain) {
        await session.defaultSession.cookies.remove(cookie.domain, cookie.name)
      }
    }
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

    // ── 监听 URL 变化，自动更新 currentPhase ──
    this.loginWindow.webContents.on('did-navigate', (_event, navUrl) => {
      if (navUrl.includes('/go')) {
        this.currentPhase = 'go'
      } else if (navUrl.includes('/usage')) {
        this.currentPhase = 'usage'
      }
    })
    // SPA 内部导航也监听
    this.loginWindow.webContents.on('did-navigate-in-page', (_event, navUrl) => {
      if (navUrl.includes('/go')) {
        this.currentPhase = 'go'
      } else if (navUrl.includes('/usage')) {
        this.currentPhase = 'usage'
      }
    })

    // ── 请求 URL 拦截：捕获 workspaceId ──
    this.loginWindow.webContents.session.webRequest.onBeforeRequest(
      { urls: ['*://opencode.ai/_server*'] },
      (details, callback) => {
        if (details.method === 'GET' && details.url.includes('_server?id=')) {
          if (!this.capturedApiUrl) {
            this.capturedApiUrl = details.url
          }
          try {
            const u = new URL(details.url)
            const argsStr = u.searchParams.get('args') || ''
            if (argsStr) {
              const args = JSON.parse(argsStr)
              const wid = args?.t?.a?.[0]?.s
              if (wid && typeof wid === 'string' && wid.startsWith('wrk_')) {
                if (!this.workspaceId) {
                  this.workspaceId = wid
                }
              }
            }
          } catch {}
        }
        callback({})
      }
    )

    // ── 请求头拦截：缓存所有 _server 请求 ──
    this.loginWindow.webContents.session.webRequest.onBeforeSendHeaders(
      { urls: ['*://opencode.ai/_server*'] },
      (details, callback) => {
        const serverId = details.requestHeaders?.['x-server-id'] || details.requestHeaders?.['X-Server-Id'] || ''
        const serverInstance = details.requestHeaders?.['x-server-instance'] || details.requestHeaders?.['X-Server-Instance'] || ''

        if (serverId && serverId !== '(none)') {
          const method = details.method as 'GET' | 'POST'
          const phase = this.currentPhase
          this.capturedRequests.push({ serverId, instance: serverInstance, method, phase })
        }

        callback({ requestHeaders: details.requestHeaders })
      }
    )

    this.loginWindow.loadURL(url)

    // 用户手动关闭窗口时提取数据
    this.loginWindow.on('close', () => {
      this.resolveFromCaptured()
    })

    this.loginWindow.on('closed', () => {
      this.clearTimer()
      this.loginWindow = null
    })

    // 超时保护
    this.timeoutTimer = setTimeout(() => {
      console.warn('[OpenCodeLogin] 登录超时')
      if (!this.resolved) {
        this.resolveFromCaptured()
      }
      if (this.loginWindow && !this.loginWindow.isDestroyed()) {
        this.loginWindow.close()
      }
    }, LOGIN_TIMEOUT_MS)
  }

  onLoginComplete(callback: (data: OpenCodeLoginResult | null) => void): void {
    this.loginCompleteCallback = callback
  }

  /**
   * 从捕获的请求中解析 API1/2/3
   *
   * 按 phase 分组识别：
   *   Go 页 GET 请求 → API1 = 居中值(3个) 或 大值(2个)
   *   使用量页 POST → API2 (instance 较小)
   *   使用量页 GET → API3 (instance 较大)
   */
  private resolveFromCaptured(): void {
    if (this.resolved) return

    const extractCookies = async () => {
      const allCookies = this.loginWindow && !this.loginWindow.isDestroyed()
        ? await this.loginWindow.webContents.session.cookies.get({})
        : await session.defaultSession.cookies.get({})
      const opencodeCookies = allCookies.filter(c => c.domain?.includes(OPENCODE_DOMAIN))
      if (opencodeCookies.length === 0) {
        console.warn('[OpenCodeLogin] 未提取到 opencode.ai cookies')
        this.triggerCallback(null)
        return
      }
      const cookieString = opencodeCookies.map(c => `${c.name}=${c.value}`).join('; ')

      // 按 phase 分组
      const goRequests = this.capturedRequests.filter(r => r.phase === 'go')
      const usageRequests = this.capturedRequests.filter(r => r.phase === 'usage')
      const goGets = goRequests.filter(r => r.method === 'GET')
      const goSort = [...goGets].sort(
        (a, b) => extractInstanceNum(a.instance) - extractInstanceNum(b.instance)
      )

      // ── API1: Go 页 GET 请求中居中值(>=3个)或大值(2个) ──
      let api1: CapturedRequest | null = null
      if (goSort.length >= 3) {
        api1 = goSort[Math.floor(goSort.length / 2)] // 居中
      } else if (goSort.length >= 2) {
        api1 = goSort[goSort.length - 1] // 大值
      } else if (goSort.length === 1) {
        api1 = goSort[0]
      }

      // ── API2/API3: 使用量页请求，按 instance 排序，小=API2(POST), 大=API3(GET) ──
      let api2: CapturedRequest | null = null
      let api3: CapturedRequest | null = null
      if (usageRequests.length >= 2) {
        const usageSort = [...usageRequests].sort(
          (a, b) => extractInstanceNum(a.instance) - extractInstanceNum(b.instance)
        )
        api2 = usageSort[0]                   // instance 较小 → API2 (POST)
        api3 = usageSort[usageSort.length - 1] // instance 较大 → API3 (GET)
      } else if (usageRequests.length === 1) {
        const req = usageRequests[0]
        if (req.method === 'POST') {
          api2 = req
        } else {
          api3 = req
        }
      }

      this.triggerCallback({
        cookies: cookieString,
        apiUrl: this.capturedApiUrl,
        api1ServerId: api1?.serverId || null,
        api1Instance: api1?.instance || null,
        api2ServerId: api2?.serverId || null,
        api2Instance: api2?.instance || null,
        api3ServerId: api3?.serverId || null,
        api3Instance: api3?.instance || null
      })
    }

    extractCookies().catch(err => {
      console.error('[OpenCodeLogin] 提取 cookies 失败:', err)
      this.triggerCallback(null)
    })
  }

  private triggerCallback(data: OpenCodeLoginResult | null): void {
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
