import { BrowserWindow, ipcMain } from 'electron'
import { PopupWindowManager, type Point, type PopupOptions } from '../core/popup-window'
import { CTX_MENU_WIDTH, CTX_MENU_HEIGHT_NO_MODEL, CTX_MENU_HEIGHT_WITH_MODEL, computeCtxMenuPosition } from '../utils/position'
import { IPC } from '../core/ipc-channels'
import { windowLifecycle } from '../core/window-lifecycle'

export interface CtxMenuConfig {
  modelId: string | null
  modelName: string | null
  theme: string
  preset: string
  layoutMode: string
  alwaysOnTop: boolean
}

export interface CtxMenuDeps {
  getFloatWindow: () => BrowserWindow | null
}

interface ShowOptions extends CtxMenuConfig {
  screenX: number
  screenY: number
}

/**
 * 右键菜单管理器：基于 PopupWindowManager 实现。
 *
 * 修复原版的 blur 竞态问题：
 * - 通过 keepOpen/release 机制支持子对话框期间不关闭。
 * - show/hide 期间使用 WindowLifecycleManager 状态机防止误关。
 */
export class CtxMenuManager extends PopupWindowManager<CtxMenuConfig> {
  protected readonly options: PopupOptions = {
    name: 'ctxMenu',
    route: '/ctx-menu',
    defaultWidth: CTX_MENU_WIDTH,
    defaultHeight: CTX_MENU_HEIGHT_NO_MODEL,
    autoCloseOnBlur: true,
    level: 'pop-up-menu',
  }

  private lastConfig: CtxMenuConfig | null = null
  private anchor: Point = { x: 0, y: 0 }
  private deps: CtxMenuDeps

  constructor(deps: CtxMenuDeps) {
    super()
    this.deps = deps
  }

  show(options: ShowOptions): boolean {
    this.anchor = { x: options.screenX, y: options.screenY }
    const config: CtxMenuConfig = {
      modelId: options.modelId,
      modelName: options.modelName,
      theme: options.theme,
      preset: options.preset,
      layoutMode: options.layoutMode,
      alwaysOnTop: options.alwaysOnTop,
    }
    this.lastConfig = config
    return super.show()
  }

  hide(): void {
    super.hide()
  }

  get lastConfigValue(): CtxMenuConfig | null {
    return this.lastConfig
  }

  // ── PopupWindowManager 抽象实现 ──

  protected buildPayload(): CtxMenuConfig {
    return this.lastConfig ?? {
      modelId: null,
      modelName: null,
      theme: 'dark',
      preset: 'midnight',
      layoutMode: 'list',
      alwaysOnTop: true,
    }
  }

  protected getAnchor(): Point {
    return this.anchor
  }

  protected computePosition(anchor: Point, size: { width: number; height: number }): Point {
    return computeCtxMenuPosition(anchor.x, anchor.y, size.width, size.height)
  }

  protected computeSize(payload: CtxMenuConfig): { width: number; height: number } {
    return {
      width: CTX_MENU_WIDTH,
      height: payload.modelName ? CTX_MENU_HEIGHT_WITH_MODEL : CTX_MENU_HEIGHT_NO_MODEL,
    }
  }

  protected getChannelName(): string {
    return IPC.CTX_MENU.CONFIG
  }

  protected onHidden(): void {
    const fw = this.deps.getFloatWindow()
    if (fw && !fw.isDestroyed()) {
      fw.webContents.send(IPC.CTX_MENU.CLOSED)
    }
  }

  // ── IPC ──

  registerIpc(): void {
    ipcMain.handle(IPC.CTX_MENU.SHOW, (_, options: ShowOptions) => this.show(options))
    ipcMain.handle(IPC.CTX_MENU.HIDE, () => {
      this.hide()
      return true
    })
    ipcMain.handle(IPC.CTX_MENU.GET_CONFIG, () => this.lastConfig)
    ipcMain.handle(IPC.CTX_MENU.ACTION, (_, action: string) => {
      const fw = this.deps.getFloatWindow()
      if (fw && !fw.isDestroyed()) {
        fw.webContents.send(IPC.CTX_MENU.ACTION_EXECUTE, action)
      }
      this.hide()
      return true
    })
  }
}
