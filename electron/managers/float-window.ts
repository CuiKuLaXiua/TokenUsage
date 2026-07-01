import { app, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import {
  FLOAT_WIDTH,
  FLOAT_LIST_HEIGHT,
  FLOAT_HEIGHT,
  DETAIL_WIDTH,
  DETAIL_HEIGHT,
  computeDetailPosition,
  computeDetailY,
} from '../utils/position'
import {
  loadFloatPosition,
  saveFloatPosition,
  loadFloatDockState,
  saveFloatDockState,
} from '../services/persistence'
import { themeService } from '../services/theme'
import { windowLifecycle } from '../core/window-lifecycle'
import { IPC } from '../core/ipc-channels'
import { EdgeDockManager } from '../features/edge-dock'
import type { EdgeDockDeps } from '../features/edge-dock'
import { getPreloadPath, getRendererPath, getIconPath } from '../utils/resource-path'

const isDev = !app.isPackaged
const rendererUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:3000'

export class FloatWindowManager {
  private isReady = false
  private readyResolve: (() => void) | null = null
  private detailAnchorInfo: { x: number; anchorTop: number; anchorBottom: number } | null = null
  private edgeDock: EdgeDockManager

  constructor() {
    this.edgeDock = new EdgeDockManager(this.createEdgeDockDeps())
    this.edgeDock.registerIpc()
    this.registerIpc()
  }

  // ── 创建窗口 ──

  ensureFloatWindow(): BrowserWindow {
    const existing = windowLifecycle.get('float')
    if (existing) return existing

    const savedPos = loadFloatPosition()
    const posOpts = savedPos ? { x: savedPos.x, y: savedPos.y } : {}

    const win = windowLifecycle.getOrCreate({
      name: 'float',
      onClose: () => {
        this.isReady = false
        this.readyResolve = null
        windowLifecycle.close('detail')
        windowLifecycle.close('floatStrip')
        // edgeDock 的清理由 EdgeDockManager 自身 closed 回调处理
      },
      factory: () => {
        const w = new BrowserWindow({
          width: FLOAT_WIDTH,
          height: FLOAT_HEIGHT,
          ...posOpts,
          resizable: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          frame: false,
          hasShadow: false,
          show: false,
         backgroundColor: '#00000000',
         webPreferences: {
           preload: getPreloadPath(),
           nodeIntegration: false,
           contextIsolation: true,
            sandbox: false,
         },
          icon: getIconPath(),
        })

        // 平台层级优化
        if (process.platform === 'darwin') {
          w.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
          w.setAlwaysOnTop(true, 'floating')
        } else {
          w.setAlwaysOnTop(true, 'pop-up-menu')
        }

        themeService.register(w)
        this.loadRoute(w, '/float')

        w.on('closed', () => {
          // 关键：在窗口销毁前保存 ID，避免 floatWindow?.id 不可靠
          const winId = w.id
          const dragState = this.edgeDock.dragStateMap.get(winId)
          if (dragState?.intervalId) clearInterval(dragState.intervalId as any)
          this.edgeDock.dragStateMap.delete(winId)
          this.edgeDock.edgeDockState.delete(winId)

          if (!this.edgeDock.edgeDockState.get(winId)?.isDocked) {
            saveFloatPosition(w)
          }
          saveFloatDockState(null)
          this.edgeDock.stopHoverPolling()
        })

        // ready 兜底
        w.webContents.on('did-finish-load', () => {
          windowLifecycle.setTimeout('float', () => {
            if (!this.isReady) this.markReady()
          }, 1500)
        })

        return w
      },
    })

    // 预创建 detail 和 strip
    this.ensureDetailWindow()
    this.ensureFloatStripWindow()

    // 恢复贴边状态
    const dockState = loadFloatDockState()
    if (dockState) {
      // 延迟到下一 tick，确保窗口已准备就绪
      setImmediate(() => {
        const fw = windowLifecycle.get('float')
        if (!fw || fw.isDestroyed()) return
        fw.webContents.send(IPC.EDGE_DOCK.CHANGED, { isDocked: true, edge: dockState.edge })
      })
    }

    return win
  }

  ensureFloatStripWindow(): BrowserWindow | null {
    const floatWindow = windowLifecycle.get('float')
    if (!floatWindow) return null

    const existing = windowLifecycle.get('floatStrip')
    if (existing) return existing

    return windowLifecycle.getOrCreate({
      name: 'floatStrip',
      onClose: () => void 0,
      factory: () => {
        const w = new BrowserWindow({
          width: 8,
          height: FLOAT_LIST_HEIGHT,
          resizable: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          frame: false,
          show: false,
          backgroundColor: '#000',
         transparent: true,
         hasShadow: false,
         webPreferences: {
           preload: getPreloadPath(),
           nodeIntegration: false,
           contextIsolation: true,
            sandbox: false,
         },
        })
        this.loadRoute(w, '/float-strip')
        themeService.register(w)
        return w
      },
    })
  }

  ensureDetailWindow(): BrowserWindow | null {
    const floatWindow = windowLifecycle.get('float')
    if (!floatWindow) return null

    const existing = windowLifecycle.get('detail')
    if (existing) return existing

    return windowLifecycle.getOrCreate({
      name: 'detail',
      onClose: () => void 0,
      factory: () => {
        const w = new BrowserWindow({
          width: DETAIL_WIDTH,
          height: DETAIL_HEIGHT,
          resizable: false,
          alwaysOnTop: true,
          skipTaskbar: true,
          frame: false,
          show: false,
          hasShadow: false,
          backgroundColor: '#00000000',
         parent: floatWindow,
         webPreferences: {
           preload: getPreloadPath(),
           nodeIntegration: false,
           contextIsolation: true,
            sandbox: false,
         },
          icon: getIconPath(),
        })
        w.setAlwaysOnTop(true, 'pop-up-menu')
        themeService.register(w)
        this.loadRoute(w, '/float-detail')
        return w
      },
    })
  }

  // ── 生命周期 ──

  async ready(): Promise<void> {
    if (this.isReady) return
    return new Promise((resolve) => {
      this.readyResolve = resolve
    })
  }

  private markReady(): void {
    this.isReady = true
    if (this.readyResolve) {
      this.readyResolve()
      this.readyResolve = null
    }
  }

  isActive(): boolean {
    const win = windowLifecycle.get('float')
    if (!win || win.isDestroyed()) return false
    if (!win.isVisible()) {
      const id = win.id
      if (!this.edgeDock.edgeDockState.has(id)) return false
    }
    return true
  }

  // ── 操作 ──

  async toggle(): Promise<boolean> {
    const win = this.ensureFloatWindow()
    if (win.isVisible()) {
      const id = win.id
      // 清理贴边状态并等待窗口完全关闭，确保 isActive() 之后一定返回 false
      this.edgeDock.edgeDockState.delete(id)
      return new Promise<boolean>((resolve) => {
        let resolved = false
        const onClosed = () => {
          if (resolved) return
          resolved = true
          resolve(false)
        }
        win.once('closed', onClosed)
        win.close()
        // 兜底：极少数情况下 closed 事件可能延迟，100ms 后强制 resolve
        setTimeout(() => {
          if (resolved) return
          resolved = true
          win.removeListener('closed', onClosed)
          resolve(false)
        }, 100)
      })
    }
    const state = this.edgeDock.edgeDockState.get(win.id)
    if (state?.isDocked) {
      // 贴边隐藏状态下：直接关闭悬浮窗及贴边条
      this.close()
      return false
    }
    win.show()
    win.focus()
    return true
  }

  close(): void {
    windowLifecycle.close('detail')
    windowLifecycle.close('floatStrip')
    this.edgeDock.stopHoverPolling()
    this.edgeDock.edgeDockState.clear()
    saveFloatDockState(null)
    windowLifecycle.close('float')
  }

  // ── IPC ──

  private registerIpc(): void {
    ipcMain.handle(IPC.FLOAT.OPEN, async () => this.toggle())
    ipcMain.handle(IPC.FLOAT.CLOSE, () => {
      this.close()
      return true
    })
    ipcMain.handle(IPC.FLOAT.STATE, () => ({ active: this.isActive() }))
    ipcMain.handle(IPC.FLOAT.FOCUS, () => {
      const win = windowLifecycle.get('float')
      if (win && !win.isDestroyed()) win.focus()
      return true
    })
    ipcMain.handle(IPC.FLOAT.GET_BOUNDS, () => {
      const win = windowLifecycle.get('float')
      if (!win || win.isDestroyed()) return null
      const [x, y] = win.getPosition()
      const [w, h] = win.getSize()
      return { x, y, width: w, height: h }
    })
    ipcMain.handle(IPC.FLOAT.SET_POSITION, (_, x: number, y: number) => {
      const win = windowLifecycle.get('float')
      if (!win || win.isDestroyed()) return false
      win.setPosition(Math.round(x), Math.round(y))
      return true
    })
    ipcMain.handle(IPC.FLOAT.RESIZE, (_, width: number, height: number) => {
      const win = windowLifecycle.get('float')
      if (!win || win.isDestroyed()) return false
      const [cw, ch] = win.getSize()
      if (Math.abs(cw - width) > 5 || Math.abs(ch - height) > 5) {
        win.setResizable(true)
        win.setSize(Math.round(width), Math.round(height))
        win.setResizable(false)
      }
      return true
    })
    ipcMain.handle(IPC.FLOAT.SET_ALWAYS_ON_TOP, (_, value: boolean) => {
      const win = windowLifecycle.get('float')
      if (win && !win.isDestroyed()) win.setAlwaysOnTop(value)
      return true
    })
    ipcMain.handle(IPC.FLOAT.READY, () => {
      this.markReady()
      return true
    })

    // Detail
    ipcMain.handle(IPC.DETAIL.SHOW, async (_, options) => {
      const win = this.ensureDetailWindow()
      if (!win) return false
      const { x, anchorTop, anchorBottom } = computeDetailPosition(
        options.anchorX,
        options.anchorY,
        options.anchorW,
        options.anchorH,
      )
      this.detailAnchorInfo = { x, anchorTop, anchorBottom }
      const initialY = computeDetailY(anchorTop, anchorBottom, DETAIL_HEIGHT)
      win.setBounds({ x, y: initialY, width: DETAIL_WIDTH, height: DETAIL_HEIGHT })
      if (!win.isVisible()) {
        win.show()
        win.focus()
      }
      return true
    })
    ipcMain.handle(IPC.DETAIL.HIDE, () => {
      const win = windowLifecycle.get('detail')
      if (win && !win.isDestroyed()) win.hide()
      this.detailAnchorInfo = null
      return true
    })
    ipcMain.handle(IPC.DETAIL.RESIZE, (_, width: number, height: number) => {
      const win = windowLifecycle.get('detail')
      if (!win || win.isDestroyed()) return true
      const MIN_H = 120
      const MAX_H = 620
      const clamped = Math.round(Math.min(MAX_H, Math.max(MIN_H, height)))
      const w = Math.round(width)
      if (this.detailAnchorInfo) {
        const y = computeDetailY(
          this.detailAnchorInfo.anchorTop,
          this.detailAnchorInfo.anchorBottom,
          clamped,
        )
        win.setBounds({ x: this.detailAnchorInfo.x, y, width: w, height: clamped })
      } else {
        win.setSize(w, clamped)
      }
      return true
    })
    ipcMain.on(IPC.DETAIL.HOVER_NOTIFY, (_event, state: 'enter' | 'leave') => {
      const win = windowLifecycle.get('float')
      if (win && !win.isDestroyed()) {
        win.webContents.send(IPC.DETAIL.HOVER_CHANGED, state)
      }
    })
  }

  // ── helpers ──

  private createEdgeDockDeps(): EdgeDockDeps {
    return {
      getFloatWindow: () => windowLifecycle.get('float') || null,
      getFloatStripWindow: () => windowLifecycle.get('floatStrip') || null,
      setFloatStripWindow: (w) => {
        if (w) {
          this.ensureFloatStripWindow()
        } else {
          windowLifecycle.close('floatStrip')
        }
      },
      createFloatStripWindow: () => this.ensureFloatStripWindow(),
      saveFloatPosition: (win) => saveFloatPosition(win),
    }
  }

  private loadRoute(win: BrowserWindow, route: string): void {
    if (isDev) {
      win.loadURL(`${rendererUrl}/#${route}`)
    } else {
      win.loadFile(getRendererPath(), { hash: route.slice(1) })
    }
  }

  private getIconPath(): string {
    return getIconPath()
  }
}

export const floatWindowManager = new FloatWindowManager()
