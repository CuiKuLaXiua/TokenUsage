import { app, BrowserWindow, ipcMain, net } from 'electron'
import { join } from 'path'

const isDev = !app.isPackaged
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { config as loadDotenv } from 'dotenv'
import { isValidMonth, isValidConfig, isAllowedUrl, isValidUsageData } from './ipc-validators'
import { LoginWindowManager } from './login'
import { UsageRefresher } from './refresher'

// 加载 .env.local 环境变量
loadDotenv({ path: join(__dirname, '../.env.local') })

// 捕获未处理的错误，防止进程退出
process.on('uncaughtException', (error) => {
  console.error('未捕获的异常:', error)
})

process.on('unhandledRejection', (reason) => {
  console.error('未处理的Promise拒绝:', reason)
})

let mainWindow: BrowserWindow | null = null
let floatWindow: BrowserWindow | null = null
let detailWindow: BrowserWindow | null = null
let ctxMenuWindow: BrowserWindow | null = null
const loginManager = new LoginWindowManager()

const dataDir = join(homedir(), '.token-usage')
const configPath = join(dataDir, 'config.json')
const usagePath = join(dataDir, 'usage')
const refresher = new UsageRefresher(configPath)

function ensureDataDir() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true })
  }
  if (!existsSync(usagePath)) {
    mkdirSync(usagePath, { recursive: true })
  }
  if (!existsSync(configPath)) {
    const defaultConfig = {
      models: [
        {
          id: 'mimo-default',
          name: '小米MIMO',
          provider: 'mimo',
          apiKey: process.env.MIMO_API_KEY || '',
          baseUrl: process.env.MIMO_BASE_URL || 'https://platform.xiaomimimo.com/api/v1/tokenPlan/usage',
          cookies: process.env.MIMO_COOKIES || '',
          loginUrl: 'https://platform.xiaomimimo.com/console/plan-manage',
          enabled: true
        }
      ]
    }
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2))
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    frame: false,
    titleBarStyle: 'hidden',
    ...(process.platform === 'darwin' ? { trafficLightPosition: { x: 12, y: 16 } } : {}),
    icon: join(__dirname, '../public/logo.png')
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../dist/index.html'))
  }

  // 捕获渲染进程崩溃事件
  mainWindow.webContents.on('crashed', () => {
    console.error('渲染进程崩溃!')
  })

  mainWindow.on('unresponsive', () => {
    console.error('窗口无响应!')
  })

  mainWindow.webContents.on('did-fail-load', (_, errorCode, errorDescription) => {
    console.error('页面加载失败:', errorCode, errorDescription)
  })
}

const FLOAT_WIDTH = 280
const FLOAT_HEIGHT = 104
const DETAIL_WIDTH = 320
const DETAIL_HEIGHT = 420
const DETAIL_GAP = 8
const CTX_MENU_WIDTH = 200
const CTX_MENU_HEIGHT = 290

function createFloatWindow() {
  floatWindow = new BrowserWindow({
    width: FLOAT_WIDTH,
    height: FLOAT_HEIGHT,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: join(__dirname, '../public/logo.png')
  })

  if (isDev) {
    floatWindow.loadURL('http://localhost:3000/#/float')
  } else {
    floatWindow.loadFile(join(__dirname, '../dist/index.html'), {
      hash: '/float'
    })
  }

  // Fix: 捕获原生右键事件（即使窗口未聚焦也能触发，解决 Issue #1）
  floatWindow.webContents.on('context-menu', (_, params) => {
    floatWindow?.webContents.send('native-context-menu', {
      x: params.x,
      y: params.y
    })
  })

  floatWindow.on('closed', () => {
    // 主窗口关闭时同步关闭详情窗口
    if (detailWindow && !detailWindow.isDestroyed()) {
      detailWindow.close()
    }
    // 关闭右键菜单
    if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
      ctxMenuWindow.close()
    }
    floatWindow = null
  })
}

function createDetailWindow() {
  if (detailWindow && !detailWindow.isDestroyed()) {
    return detailWindow
  }

  if (!floatWindow || floatWindow.isDestroyed()) {
    return null
  }

  detailWindow = new BrowserWindow({
    width: DETAIL_WIDTH,
    height: DETAIL_HEIGHT,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    show: false,
    parent: floatWindow,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: join(__dirname, '../public/logo.png')
  })

  // 确保详情窗口在主窗口之上
  detailWindow.setAlwaysOnTop(true, 'pop-up-menu')

  if (isDev) {
    detailWindow.loadURL('http://localhost:3000/#/float-detail')
  } else {
    detailWindow.loadFile(join(__dirname, '../dist/index.html'), {
      hash: '/float-detail'
    })
  }

  detailWindow.on('closed', () => {
    detailWindow = null
  })

  return detailWindow
}

function createCtxMenuWindow() {
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
    return ctxMenuWindow
  }

  ctxMenuWindow = new BrowserWindow({
    width: CTX_MENU_WIDTH,
    height: CTX_MENU_HEIGHT,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  ctxMenuWindow.setAlwaysOnTop(true, 'pop-up-menu')

  if (isDev) {
    ctxMenuWindow.loadURL('http://localhost:3000/#/ctx-menu')
  } else {
    ctxMenuWindow.loadFile(join(__dirname, '../dist/index.html'), {
      hash: '/ctx-menu'
    })
  }

  // Auto-close when clicking outside
  ctxMenuWindow.on('blur', () => {
    if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
      ctxMenuWindow.close()
      ctxMenuWindow = null
    }
  })

  ctxMenuWindow.on('closed', () => {
    ctxMenuWindow = null
  })

  return ctxMenuWindow
}

/**
 * 计算详情窗口位置，支持边缘检测
 */
function computeDetailPosition(
  anchorX: number,
  anchorY: number,
  anchorW: number,
  anchorH: number
): { x: number; y: number } {
  const { width: screenW, height: screenH } =
    require('electron').screen.getPrimaryDisplay().workAreaSize

  // 默认在右侧
  let x = anchorX + anchorW + DETAIL_GAP
  let y = anchorY

  // 右侧空间不足，放左侧
  if (x + DETAIL_WIDTH > screenW - 20) {
    x = Math.max(0, anchorX - DETAIL_WIDTH - DETAIL_GAP)
  }

  // 底部空间不足，向上对齐
  if (y + DETAIL_HEIGHT > screenH - 20) {
    y = Math.max(0, anchorY + anchorH - DETAIL_HEIGHT)
  }

  return { x: Math.round(x), y: Math.round(y) }
}

/**
 * 计算右键菜单位置，支持屏幕边缘检测
 */
function computeCtxMenuPosition(
  anchorX: number,
  anchorY: number
): { x: number; y: number } {
  const { width: screenW, height: screenH } =
    require('electron').screen.getPrimaryDisplay().workAreaSize

  let x = anchorX
  let y = anchorY

  // 右侧越界
  if (x + CTX_MENU_WIDTH > screenW - 10) {
    x = Math.max(0, screenW - CTX_MENU_WIDTH - 10)
  }

  // 底部越界：翻转到光标上方
  if (y + CTX_MENU_HEIGHT > screenH - 10) {
    y = Math.max(0, anchorY - CTX_MENU_HEIGHT)
  }

  // 顶部安全边距
  if (y < 0) y = 10

  return { x: Math.round(x), y: Math.round(y) }
}

app.whenReady().then(() => {
  ensureDataDir()
  createWindow()
  refresher.start()  // 启动统一刷新

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  // 开发模式下不自动退出，方便调试
  if (!isDev && process.platform !== 'darwin') {
    app.quit()
  }
})

// IPC handlers for data storage
ipcMain.handle('load-config', () => {
  try {
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, 'utf-8'))
    }
    return {}
  } catch (error) {
    console.error('Error loading config:', error)
    return {}
  }
})

ipcMain.handle('save-config', (_, config) => {
  try {
    if (!isValidConfig(config)) {
      console.error('Invalid config structure')
      return false
    }
    writeFileSync(configPath, JSON.stringify(config, null, 2))

    // 广播配置更新给所有窗口
    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send('config-updated')
    })

    // 重启刷新服务
    refresher.restart()

    return true
  } catch (error) {
    console.error('Error saving config:', error)
    return false
  }
})

ipcMain.handle('load-usage', (_, month) => {
  try {
    if (!isValidMonth(month)) {
      console.error('Invalid month format:', month)
      return []
    }
    const filePath = join(usagePath, `${month}.json`)
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, 'utf-8'))
    }
    return []
  } catch (error) {
    console.error('Error loading usage:', error)
    return []
  }
})

ipcMain.handle('save-usage', (_, month, data) => {
  try {
    if (!isValidMonth(month)) {
      console.error('Invalid month format:', month)
      return false
    }
    if (!isValidUsageData(data)) {
      console.error('Invalid usage data')
      return false
    }
    const filePath = join(usagePath, `${month}.json`)
    writeFileSync(filePath, JSON.stringify(data, null, 2))
    return true
  } catch (error) {
    console.error('Error saving usage:', error)
    return false
  }
})

ipcMain.handle('get-data-path', () => {
  return dataDir
})

ipcMain.handle('open-float-window', () => {
  if (!floatWindow) {
    createFloatWindow()
  } else {
    floatWindow.focus()
  }
  return true
})

ipcMain.handle('close-float-window', () => {
  if (detailWindow && !detailWindow.isDestroyed()) {
    detailWindow.close()
    detailWindow = null
  }
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
    ctxMenuWindow.close()
    ctxMenuWindow = null
  }
  if (floatWindow) {
    floatWindow.close()
    floatWindow = null
  }
  return true
})

// ── 详情悬浮窗 IPC ──

ipcMain.handle('focus-float-window', () => {
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.focus()
  }
  return true
})

ipcMain.handle('show-float-detail', (_, options: {
  anchorX: number
  anchorY: number
  anchorW: number
  anchorH: number
}) => {
  const win = createDetailWindow()
  if (!win) return false

  const { x, y } = computeDetailPosition(
    options.anchorX,
    options.anchorY,
    options.anchorW,
    options.anchorH
  )

  win.setPosition(x, y)

  if (!win.isVisible()) {
    win.show()
    win.focus()
  }

  return true
})

ipcMain.handle('hide-float-detail', () => {
  if (detailWindow && !detailWindow.isDestroyed()) {
    detailWindow.hide()
  }
  return true
})

ipcMain.handle('resize-detail-window', (_, width: number, height: number) => {
  if (detailWindow && !detailWindow.isDestroyed()) {
    const MIN_H = 120
    const MAX_H = 520
    const clamped = Math.round(Math.min(MAX_H, Math.max(MIN_H, height)))
    detailWindow.setSize(Math.round(width), clamped)
  }
  return true
})

ipcMain.handle('notify-detail-hover', (_event, state: 'enter' | 'leave') => {
  // 将详情窗口的 hover 状态广播给主悬浮窗
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.webContents.send('detail-hover-changed', state)
  }
})

// ── 右键菜单弹出窗 IPC ──

ipcMain.handle('show-ctx-menu', (_, options: {
  screenX: number
  screenY: number
  modelId: string | null
  modelName: string | null
  theme: string
  layoutMode: string
  alwaysOnTop: boolean
}) => {
  // 关闭已有菜单
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
    ctxMenuWindow.close()
    ctxMenuWindow = null
  }

  const win = createCtxMenuWindow()
  if (!win) return false

  const { x, y } = computeCtxMenuPosition(options.screenX, options.screenY)
  win.setPosition(x, y)

  // 发送菜单配置到弹出窗口渲染进程
  win.webContents.send('ctx-menu-config', {
    modelId: options.modelId,
    modelName: options.modelName,
    theme: options.theme,
    layoutMode: options.layoutMode,
    alwaysOnTop: options.alwaysOnTop
  })

  // 不抢焦点地显示
  win.showInactive()
  // 短暂延迟后聚焦，使 blur 事件能够正常触发（点击外部关闭）
  setTimeout(() => {
    if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
      ctxMenuWindow.focus()
    }
  }, 80)

  return true
})

ipcMain.handle('hide-ctx-menu', () => {
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
    ctxMenuWindow.close()
    ctxMenuWindow = null
  }
  return true
})

ipcMain.handle('ctx-menu-action', (_, action: string) => {
  // 转发动作到浮窗执行
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.webContents.send('execute-ctx-menu-action', action)
  }
  // 关闭菜单
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
    ctxMenuWindow.close()
    ctxMenuWindow = null
  }
  return true
})

ipcMain.handle('get-float-window-bounds', () => {
  if (!floatWindow || floatWindow.isDestroyed()) return null
  const [x, y] = floatWindow.getPosition()
  const [w, h] = floatWindow.getSize()
  return { x, y, width: w, height: h }
})

ipcMain.handle('set-float-always-on-top', (_, value: boolean) => {
  if (floatWindow) {
    floatWindow.setAlwaysOnTop(value)
  }
  return true
})

const _logFile = join(app.getPath('temp'), 'tokenusage-debug.log')
function _dbg(msg: string) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`
  try { require('fs').appendFileSync(_logFile, line) } catch {}
}

ipcMain.handle('resize-float-window', (_, width: number, height: number) => {
  if (floatWindow && !floatWindow.isDestroyed()) {
    const [currentWidth, currentHeight] = floatWindow.getSize()
    // 只在尺寸有明显变化时调整，避免频繁闪烁
    if (Math.abs(currentWidth - width) > 5 || Math.abs(currentHeight - height) > 5) {
      _dbg(`resize-float-window: ${currentWidth}x${currentHeight} -> ${width}x${height}`)
      // Windows 无边框窗口在 resizable=false 时可能无法正确缩小
      // 临时切换 resizable 状态以确保 setSize 生效
      floatWindow.setResizable(true)
      floatWindow.setSize(width, height)
      floatWindow.setResizable(false)
      const [afterW, afterH] = floatWindow.getSize()
      _dbg(`  after setSize: ${afterW}x${afterH}`)
    } else {
      _dbg(`resize-float-window: skipped (diff too small) ${currentWidth}x${currentHeight} -> ${width}x${height}`)
    }
  }
  return true
})

ipcMain.handle('debug-log', (_, msg: string) => {
  _dbg(`[renderer] ${msg}`)
  return true
})

// 拖拽状态管理
const dragState = new Map<number, { startMouseX: number; startMouseY: number; startPosX: number; startPosY: number }>()

ipcMain.handle('start-window-drag', (event, options: { mouseX: number; mouseY: number }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return
  const [posX, posY] = win.getPosition()
  dragState.set(win.id, {
    startMouseX: options.mouseX,
    startMouseY: options.mouseY,
    startPosX: posX,
    startPosY: posY
  })
})

ipcMain.handle('window-drag-move', (event, options: { mouseX: number; mouseY: number }) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win || win.isDestroyed()) return
  const state = dragState.get(win.id)
  if (!state) return
  const dx = options.mouseX - state.startMouseX
  const dy = options.mouseY - state.startMouseY
  win.setPosition(state.startPosX + dx, state.startPosY + dy)
})

ipcMain.handle('stop-window-drag', (event) => {
  const win = BrowserWindow.fromWebContents(event.sender)
  if (!win) return
  dragState.delete(win.id)
})

ipcMain.handle('set-float-window-position', (_, x: number, y: number) => {
  if (!floatWindow || floatWindow.isDestroyed()) return false
  floatWindow.setPosition(Math.round(x), Math.round(y))
  return true
})

ipcMain.handle('resize-float-window-animated', (_, width: number, height: number, duration: number = 300) => {
  if (!floatWindow || floatWindow.isDestroyed()) return false
  const [startW, startH] = floatWindow.getSize()
  const targetW = Math.round(width)
  const targetH = Math.round(height)
  if (Math.abs(startW - targetW) <= 2 && Math.abs(startH - targetH) <= 2) return false

  const startTime = Date.now()
  const step = () => {
    const elapsed = Date.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    // ease-out cubic
    const t = 1 - Math.pow(1 - progress, 3)
    floatWindow!.setSize(
      Math.round(startW + (targetW - startW) * t),
      Math.round(startH + (targetH - startH) * t)
    )
    if (progress < 1) {
      setTimeout(step, 16)
    }
  }
  step()
  return true
})

// 登录窗口管理
let loginInProgress = false
let loginPromise: Promise<string | null> | null = null

ipcMain.handle('open-mimo-login', async () => {
  console.log('[Login] open-mimo-login handler 被调用, loginInProgress:', loginInProgress)
  
  // 如果已有登录在进行中，等待其完成
  if (loginInProgress && loginPromise) {
    console.log('[Login] 登录已在进行中，等待结果')
    return loginPromise
  }
  
  loginInProgress = true
  
  loginPromise = new Promise<string | null>((resolve) => {
    // 读取 config 获取 loginUrl
    let loginUrl = 'https://platform.xiaomimimo.com/console/plan-manage'
    try {
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, 'utf-8'))
        const mimoModel = config.models?.find((m: any) => m.provider === 'mimo')
        if (mimoModel?.loginUrl) {
          loginUrl = mimoModel.loginUrl
        }
        // 如果已有 cookie，先验证是否有效
        if (mimoModel?.cookies) {
          // 尝试用已有 cookie 做一次 API 请求验证
          const testRequest = net.request({
            method: 'GET',
            url: mimoModel.baseUrl || 'https://platform.xiaomimimo.com/api/v1/tokenPlan/usage',
            headers: {
              'Authorization': `Bearer ${mimoModel.apiKey}`,
              'Cookie': mimoModel.cookies
            }
          })

          let testData = ''
          testRequest.on('response', (response) => {
            response.on('data', (chunk) => { testData += chunk.toString() })
            response.on('end', () => {
              try {
                const data = JSON.parse(testData)
                // 如果返回 code === 0，说明 cookie 有效
                if (data.code === 0) {
                  console.log('[Login] 已有 cookie 有效，跳过登录')
                  resolve(mimoModel.cookies)
                  return
                }
              } catch { /* 解析失败，继续登录流程 */ }
              // cookie 无效，打开登录窗口
              doLogin(loginUrl, resolve)
            })
          })
          testRequest.on('error', () => {
            // 请求失败，打开登录窗口
            doLogin(loginUrl, resolve)
          })
          testRequest.end()
          return
        }
      }
    } catch (error) {
      console.error('[Login] 读取配置失败:', error)
    }

    // 无 cookie，直接打开登录窗口
    doLogin(loginUrl, resolve)
  })
  
  // 登录完成后重置状态
  loginPromise.finally(() => {
    loginInProgress = false
    loginPromise = null
  })
  
  return loginPromise
})

async function doLogin(loginUrl: string, resolve: (value: string | null) => void): Promise<void> {
  console.log('[Login] 打开登录窗口:', loginUrl)
  await loginManager.openLoginWindow(loginUrl, mainWindow || undefined)
  loginManager.onLoginComplete((cookies) => {
    console.log('[Login] 登录完成，cookies:', cookies ? '已获取' : '未获取')
    if (cookies) {
      // 打印 cookie 完整信息
      console.log('[Login] Cookie 完整值:', cookies)
      
      // 将 cookies 保存到 config
      try {
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, 'utf-8'))
          const mimoModel = config.models?.find((m: any) => m.provider === 'mimo')
          if (mimoModel) {
            mimoModel.cookies = cookies
            writeFileSync(configPath, JSON.stringify(config, null, 2))
            console.log('[Login] Cookies 已保存到 config')
          }
        }
      } catch (error) {
        console.error('[Login] 保存 cookies 失败:', error)
      }
    } else {
      console.warn('[Login] 未获取到 cookies（超时或用户未登录）')
    }
    resolve(cookies)
  })
}

// 窗口控制
ipcMain.handle('window-minimize', () => {
  mainWindow?.minimize()
})

ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize()
  } else {
    mainWindow?.maximize()
  }
})

ipcMain.handle('window-close', () => {
  mainWindow?.close()
})

// 统一刷新相关
ipcMain.handle('get-cached-usage', () => {
  return refresher.getCachedData()
})

ipcMain.handle('refresh-all-models', async () => {
  await refresher.refreshAll()
  return true
})

ipcMain.handle('refresh-model', async (_, modelId: string) => {
  await refresher.fetchModelById(modelId)
  return true
})

// API调用 - 在主进程中处理，避免CORS问题
ipcMain.handle('fetch-mimo-usage', async (_, options) => {
  return new Promise((resolve, reject) => {
    const { url, apiKey, cookies, method = 'GET', headers = {}, body } = options

    if (!isAllowedUrl(url)) {
      reject(new Error('URL not allowed'))
      return
    }

    const requestHeaders: Record<string, string> = {
      'Authorization': `Bearer ${apiKey}`,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'
    }

    // 合并自定义 headers
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === 'string') {
        requestHeaders[key] = value
      }
    }

    // POST 请求默认加 Content-Type
    if (method === 'POST' && !requestHeaders['Content-Type']) {
      requestHeaders['Content-Type'] = 'application/json'
    }

    if (cookies) {
      requestHeaders['Cookie'] = cookies
      if (isDev) console.log('[API] 使用 cookies:', cookies)
    } else {
      if (isDev) console.log('[API] 未提供 cookies')
    }

    if (isDev) {
      console.log('主进程发起', method, '请求到:', url)
      console.log('[API] apiKey 长度:', apiKey?.length || 0)
      console.log('[API] Authorization:', requestHeaders['Authorization']?.substring(0, 30) + '...')
      console.log('[API] 所有 headers:', Object.keys(requestHeaders).join(', '))
    }

    const request = net.request({
      method: method,
      url: url,
      headers: requestHeaders
    })

    let responseData = ''

    request.on('response', (response) => {
      if (isDev) console.log('收到响应状态码:', response.statusCode)

      response.on('data', (chunk) => {
        responseData += chunk.toString()
      })

      response.on('end', () => {
        try {
          const data = JSON.parse(responseData)
          
          // 检测是否需要重新登录（仅对 MiMo API 生效）
          const isMimoUrl = url.includes('platform.xiaomimimo.com')
          if (isMimoUrl) {
            // 情况1: HTTP 401/403 状态码
            if (response.statusCode === 401 || response.statusCode === 403) {
              console.warn('[API] MiMo 返回 401/403，触发登录，状态码:', response.statusCode)
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('login-needed')
              }
              const error = new Error('Cookie expired or unauthorized')
              ;(error as any).code = 'COOKIE_EXPIRED'
              ;(error as any).statusCode = response.statusCode
              reject(error)
              return
            }
            
            // 情况2: 响应中包含 loginUrl 字段（MiMo 特有的登录重定向）
            if (data.loginUrl) {
              console.warn('[API] MiMo 返回 loginUrl，触发登录')
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('login-needed')
              }
              const error = new Error('Cookie expired or unauthorized')
              ;(error as any).code = 'COOKIE_EXPIRED'
              reject(error)
              return
            }
            
            // 情况3: code 不为 0 且响应包含错误关键词
            if (data.code !== 0) {
              const bodyStr = JSON.stringify(data)
              const errorKeywords = ['unauthorized', 'expired', 'invalid token', 'authentication']
              const isCookieError = errorKeywords.some(keyword => 
                bodyStr.toLowerCase().includes(keyword)
              )
              
              if (isCookieError) {
                console.warn('[API] MiMo 检测到 Cookie 相关错误关键词')
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send('login-needed')
                }
                const error = new Error('Cookie expired or unauthorized')
                ;(error as any).code = 'COOKIE_EXPIRED'
                reject(error)
                return
              }
            }
          }
          
          resolve(data)
        } catch (error) {
          reject(new Error('JSON解析失败'))
        }
      })
    })

    request.on('error', (error) => {
      console.error('请求错误:', error)
      reject(error)
    })

    // 发送 body（仅 POST/PUT/PATCH）
    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
      const bodyStr = typeof body === 'string' ? body : JSON.stringify(body)
      request.write(bodyStr)
    }

    request.end()
  })
})
