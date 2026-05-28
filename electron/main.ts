import { app, BrowserWindow, ipcMain, net } from 'electron'
import { join } from 'path'

const isDev = !app.isPackaged
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { config as loadDotenv } from 'dotenv'
import { isValidMonth, isValidConfig, isAllowedUrl, isValidUsageData } from './ipc-validators'
import { LoginWindowManager } from './login'

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
const loginManager = new LoginWindowManager()

const dataDir = join(homedir(), '.token-usage')
const configPath = join(dataDir, 'config.json')
const usagePath = join(dataDir, 'usage')

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
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin' ? false : true,
    icon: join(__dirname, '../public/vite.svg')
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

function createFloatWindow() {
  floatWindow = new BrowserWindow({
    width: 280,
    height: 280,
    minWidth: 220,
    minHeight: 200,
    resizable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true
    },
    icon: join(__dirname, '../public/vite.svg')
  })

  if (isDev) {
    floatWindow.loadURL('http://localhost:3000/#/float')
  } else {
    floatWindow.loadFile(join(__dirname, '../dist/index.html'), {
      hash: '/float'
    })
  }

  floatWindow.on('closed', () => {
    floatWindow = null
  })
}

app.whenReady().then(() => {
  ensureDataDir()
  createWindow()

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
  if (floatWindow) {
    floatWindow.close()
    floatWindow = null
  }
  return true
})

ipcMain.handle('set-float-always-on-top', (_, value: boolean) => {
  if (floatWindow) {
    floatWindow.setAlwaysOnTop(value)
  }
  return true
})

ipcMain.handle('resize-float-window', (_, width: number, height: number) => {
  if (floatWindow && !floatWindow.isDestroyed()) {
    const [currentWidth, currentHeight] = floatWindow.getSize()
    // 只在尺寸有明显变化时调整，避免频繁闪烁
    if (Math.abs(currentWidth - width) > 5 || Math.abs(currentHeight - height) > 5) {
      floatWindow.setSize(width, height)
    }
  }
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
