import { app, BrowserWindow, ipcMain, net } from 'electron'
import { join } from 'path'

const isDev = !app.isPackaged
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { homedir } from 'os'
import { config as loadDotenv } from 'dotenv'
import { isValidMonth, isValidConfig, isAllowedUrl, isValidUsageData } from './ipc-validators'

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
    width: 320,
    height: 420,
    minWidth: 280,
    minHeight: 300,
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
    }

    if (isDev) console.log('主进程发起', method, '请求到:', url)

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
