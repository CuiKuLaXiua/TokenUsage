import { BrowserWindow } from 'electron'
import { windowLifecycle, type WindowState } from '../core/window-lifecycle'
import { getPreloadPath, getRendererPath } from '../utils/resource-path'

export interface PopupOptions {
  /** 窗口名称，用于生命周期管理 */
  name: string
  /** 窗口路由 hash */
  route: string
  /** 默认宽度 */
  defaultWidth: number
  /** 默认高度 */
  defaultHeight: number
  /** 是否启用焦点检测自动关闭 */
  autoCloseOnBlur?: boolean
  /** 窗口层级 */
  level?: 'normal' | 'pop-up-menu' | 'screen-saver'
  /** 创建窗口的工厂函数 */
  factory?: (width: number, height: number) => BrowserWindow
}

export interface Point {
  x: number
  y: number
}

/**
 * 自定义弹出窗口管理基类。
 *
 * 统一处理右键菜单、托盘菜单、详情弹窗等独立 BrowserWindow 的：
 * - 窗口创建与复用
 * - 位置计算
 * - showInactive + focus
 * - blur 自动关闭
 * - 生命周期清理
 */
export abstract class PopupWindowManager<TPayload> {
  protected abstract readonly options: PopupOptions
  private keepOpenCount = 0
  private closeTimer: ReturnType<typeof setTimeout> | null = null

  /**
   * 构建当前 payload，show 时调用。
   */
  protected abstract buildPayload(): TPayload

  /**
   * 子类可覆盖以计算实际窗口大小（例如托盘菜单根据模型数量变化）。
   */
  protected computeSize(payload: TPayload): { width: number; height: number } {
    return {
      width: this.options.defaultWidth,
      height: this.options.defaultHeight,
    }
  }

  /**
   * 子类可覆盖以调整锚点（例如托盘菜单根据光标位置）。
   */
  protected abstract getAnchor(): Point

  /**
   * 子类可覆盖计算最终位置。
   */
  protected abstract computePosition(anchor: Point, size: { width: number; height: number }): Point

  /**
   * 显示弹出窗口。
   */
  show(...args: any[]): boolean {
    const win = this.ensureWindow()
    if (!win) return false

    const payload = this.buildPayload()
    const size = this.computeSize(payload)
    const anchor = this.getAnchor()
    const { x, y } = this.computePosition(anchor, size)

    win.setBounds({ x, y, width: size.width, height: size.height })
    this.sendPayload(win, payload)

    this.setShowing('showing')
    win.showInactive()
    win.focus()
    this.setShowing('visible')

    return true
  }

  /**
   * 隐藏弹出窗口。
   */
  hide(): void {
    this.clearCloseTimer()
    const win = windowLifecycle.get(this.options.name)
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide()
    }
    this.setShowing('hiding')
    this.onHidden()
  }

  /**
   * 预创建窗口但不显示，用于启动时提前加载资源。
   */
  preload(): BrowserWindow | null {
    return this.ensureWindow()
  }

  /**
   * 销毁弹出窗口。
   */
  destroy(): void {
    this.clearCloseTimer()
    windowLifecycle.destroy(this.options.name)
  }

  /**
   * 是否在显示中。
   */
  isVisible(): boolean {
    const win = windowLifecycle.get(this.options.name)
    return win !== undefined && win.isVisible()
  }

  /**
   * 临时保持打开（例如打开子对话框时）。
   */
  keepOpen(): void {
    this.keepOpenCount++
    this.clearCloseTimer()
  }

  /**
   * 释放保持打开。
   */
  release(): void {
    this.keepOpenCount = Math.max(0, this.keepOpenCount - 1)
  }

  protected onHidden(): void {
    // 子类可覆盖
  }

  private ensureWindow(): BrowserWindow | null {
    const existing = windowLifecycle.get(this.options.name)
    if (existing) return existing

    return windowLifecycle.getOrCreate({
      name: this.options.name,
      factory: () => {
        const win = new BrowserWindow({
          width: this.options.defaultWidth,
          height: this.options.defaultHeight,
          resizable: false,
          skipTaskbar: true,
          frame: false,
          transparent: true,
          hasShadow: false,
          show: false,
          focusable: true,
         webPreferences: {
           preload: this.getPreloadPath(),
           nodeIntegration: false,
           contextIsolation: true,
            sandbox: false,
         },
        })

        if (this.options.level) {
          win.setAlwaysOnTop(true, this.options.level)
        }

        this.loadRoute(win)
        this.registerBlurHandler(win)
        return win
      },
    })
  }

  private getPreloadPath(): string {
    return getPreloadPath()
  }

  private loadRoute(win: BrowserWindow): void {
    const isDev = !require('electron').app.isPackaged
    const rendererUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:3000'
    if (isDev) {
      win.loadURL(`${rendererUrl}/#${this.options.route}`)
    } else {
      win.loadFile(getRendererPath(), { hash: this.options.route.slice(1) })
    }
  }

  private registerBlurHandler(win: BrowserWindow): void {
    if (this.options.autoCloseOnBlur === false) return
    windowLifecycle.on(this.options.name, win, 'blur', () => {
      const state = windowLifecycle.getState(this.options.name)
      // show/focus 过程中的瞬态 blur 不触发关闭
      if (state === 'showing') return
      this.scheduleClose()
    })
  }

  private scheduleClose(): void {
    if (this.keepOpenCount > 0) return
    if (this.closeTimer) return
    this.closeTimer = setTimeout(() => {
      this.closeTimer = null
      if (this.keepOpenCount > 0) return
      const win = windowLifecycle.get(this.options.name)
      if (win && !win.isDestroyed() && !win.isFocused() && !this.isMouseOver(win)) {
        this.hide()
      }
    }, 120)
  }

  private clearCloseTimer(): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer)
      this.closeTimer = null
    }
  }

  private isMouseOver(win: BrowserWindow): boolean {
    // 通过主进程获取鼠标位置判断是否在窗口内
    const { screen } = require('electron')
    const cursor = screen.getCursorScreenPoint()
    const bounds = win.getBounds()
    return (
      cursor.x >= bounds.x &&
      cursor.x <= bounds.x + bounds.width &&
      cursor.y >= bounds.y &&
      cursor.y <= bounds.y + bounds.height
    )
  }

  private setShowing(state: WindowState): void {
    windowLifecycle.setState(this.options.name, state)
  }

  private sendPayload(win: BrowserWindow, payload: TPayload): void {
    // 等待页面加载完成后再发送 payload，避免白屏或旧数据
    if (win.webContents.isLoadingMainFrame()) {
      windowLifecycle.once(this.options.name, win.webContents, 'did-finish-load', () => {
        if (!win.isDestroyed()) {
          win.webContents.send(this.getChannelName(), payload)
        }
      })
    } else {
      win.webContents.send(this.getChannelName(), payload)
    }
  }

  protected abstract getChannelName(): string
}
