import { windowLifecycle } from '../core/window-lifecycle'
import { BrowserWindow, ipcMain, app } from 'electron'
import { PopupWindowManager, type Point, type PopupOptions } from '../core/popup-window'
import {
  TRAY_MENU_WIDTH,
  TRAY_MENU_BASE_HEIGHT,
  TRAY_MENU_MODEL_ROW_HEIGHT,
  TRAY_MENU_MAX_HEIGHT,
  computeTrayMenuPosition,
} from '../utils/position'
import { IPC } from '../core/ipc-channels'
import { themeService } from '../services/theme'
import { screenManager } from '../core/screen-manager'
import type { UsageRefresher } from '../refresher'

// ── 类型 ──

export interface ModelStatus {
  id: string
  name: string
  provider: string
  status: "normal" | "refreshing" | "error" | "needs-login"
  error?: string
  percent?: number
}

export interface TrayMenuPayload {
  models: ModelStatus[]
  floatActive: boolean
  mainWindowActive: boolean
  theme: string
  accent: string
  preset: string
}

export interface TrayMenuDeps {
  getMainWindow: () => BrowserWindow | null
  getFloatWindow: () => BrowserWindow | null
  getFloatWindowActive: () => boolean
  toggleFloatWindow: () => Promise<void>
  showOrCreateMain: () => void
  refresher: UsageRefresher
  isQuitting: () => boolean
  setQuitting: (v: boolean) => void
}

const LOGIN_KEYWORDS = ["cookie", "登录", "login", "expired", "过期", "unauthorized", "401"]

/**
 * 托盘菜单管理器：基于 PopupWindowManager 实现。
 *
 * 改进点：
 * - 统一使用 PopupWindowManager 的生命周期和 blur 关闭逻辑。
 * - 动态高度计算更保守，预留安全边距。
 */
export class TrayMenuManager extends PopupWindowManager<TrayMenuPayload> {
  protected readonly options: PopupOptions = {
    name: 'trayMenu',
    route: '/tray-menu',
    defaultWidth: TRAY_MENU_WIDTH,
    defaultHeight: TRAY_MENU_BASE_HEIGHT,
    autoCloseOnBlur: true,
    level: 'screen-saver',
  }

  private deps: TrayMenuDeps
  private lastPayload: TrayMenuPayload | null = null
  private anchor: Point = { x: 0, y: 0 }

  constructor(deps: TrayMenuDeps) {
    super()
    this.deps = deps
  }

  show(cursorX: number, cursorY: number): boolean {
    // getCursorScreenPoint 返回物理像素，需要转为 DIP 再计算位置
    const dip = screenManager.screenToDipPoint({ x: cursorX, y: cursorY })
    this.anchor = dip
    return super.show()
  }

  refreshIfVisible(): void {
    const win = this.getWindow()
    if (!win || win.isDestroyed() || !win.isVisible()) return
    const payload = this.buildPayload()
    this.lastPayload = payload
    win.webContents.send(IPC.TRAY_MENU.UPDATE, payload)
  }

  get lastPayloadValue(): TrayMenuPayload | null {
    return this.lastPayload
  }

  // ── PopupWindowManager 抽象实现 ──

  protected buildPayload(): TrayMenuPayload {
    return this.getPayload()
  }

  protected getAnchor(): Point {
    return this.anchor
  }

  protected computePosition(anchor: Point, size: { width: number; height: number }): Point {
    return computeTrayMenuPosition(anchor.x, anchor.y, size.width, size.height)
  }

  protected computeSize(_payload: TrayMenuPayload): { width: number; height: number } {
    const modelSectionH =
      _payload.models.length > 0
        ? 24 + _payload.models.length * TRAY_MENU_MODEL_ROW_HEIGHT + 16
        : 0
    return {
      width: TRAY_MENU_WIDTH,
      height: Math.min(TRAY_MENU_MAX_HEIGHT, TRAY_MENU_BASE_HEIGHT + modelSectionH),
    }
  }

  protected getChannelName(): string {
    return IPC.TRAY_MENU.UPDATE
  }

  private getWindow(): BrowserWindow | undefined {
    return windowLifecycle.get(this.options.name)
  }

  // ── 数据收集 ──

  private getPayload(): TrayMenuPayload {
    const usageData = this.deps.refresher.getCachedData()
    const fetchingState = this.deps.refresher.getFetchingState()
    const models: ModelStatus[] = []

    for (const [id, usage] of Object.entries(usageData)) {
      let status: ModelStatus["status"] = "normal"
      let error: string | undefined
      let percent: number | undefined

      if (fetchingState[id]) {
        status = "refreshing"
      } else if ((usage as any).error) {
        const errMsg = (usage as any).error || ""
        const isLogin = LOGIN_KEYWORDS.some((kw) =>
          errMsg.toLowerCase().includes(kw),
        )
        status = isLogin ? "needs-login" : "error"
        error = errMsg
      } else {
        percent = usage.percent ?? undefined
        if (percent == null && usage.total && usage.total > 0) {
          percent = Math.round(((usage.used ?? 0) / usage.total) * 100)
        }
      }

      models.push({
        id,
        name: (usage as any).planName || id,
        provider: "",
        status,
        error,
        percent,
      })
    }

    const theme = themeService.get()
    const mw = this.deps.getMainWindow()

    return {
      models,
      floatActive: this.deps.getFloatWindowActive(),
      mainWindowActive: mw != null && !mw.isDestroyed() && mw.isVisible(),
      theme: theme.mode,
      accent: theme.accent,
      preset: theme.preset,
    }
  }

  // ── 操作分发 ──

  private async handleAction(action: string): Promise<void> {
    switch (action) {
      case "toggle-main":
        this.deps.showOrCreateMain()
        break
      case "toggle-float":
        this.keepOpen()
        await this.deps.toggleFloatWindow()
        this.release()
        break
      case "toggle-theme":
        {
          const mw = this.deps.getMainWindow()
          if (mw && !mw.isDestroyed()) {
            mw.webContents.send(IPC.TRAY.TOGGLE_THEME)
          }
        }
        break
      case "refresh-all":
        this.deps.refresher.refreshAll()
        break
      case "quit":
        this.deps.setQuitting(true)
        app.quit()
        break
      default:
        if (action.startsWith("set-accent:")) {
          const mw = this.deps.getMainWindow()
          if (mw && !mw.isDestroyed()) {
            mw.webContents.send(IPC.TRAY.SET_ACCENT, action.slice("set-accent:".length))
          }
        } else if (action.startsWith("set-preset:")) {
          const mw = this.deps.getMainWindow()
          if (mw && !mw.isDestroyed()) {
            mw.webContents.send(IPC.TRAY.SET_PRESET, action.slice("set-preset:".length))
          }
        } else if (action.startsWith("refresh-model:")) {
          this.deps.refresher.fetchModelById(action.slice("refresh-model:".length)).catch(() => {})
        }
        break
    }
  }

  // ── IPC ──

  registerIpc(): void {
    ipcMain.handle(IPC.TRAY_MENU.GET_CONFIG, () => this.lastPayload)

    ipcMain.handle(IPC.TRAY_MENU.HIDE, () => {
      this.hide()
      return true
    })

    ipcMain.handle(IPC.TRAY_MENU.ACTION, async (_, action: string) => {
      if (action === "__hide") {
        this.hide()
        return true
      }
      await this.handleAction(action)
      if (action !== "toggle-float") {
        this.hide()
      }
      const fresh = this.getPayload()
      this.lastPayload = fresh
      return fresh
    })
  }
}
