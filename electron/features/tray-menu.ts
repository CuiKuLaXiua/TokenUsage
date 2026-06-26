import { BrowserWindow, ipcMain, app } from "electron";
import {
  TRAY_MENU_WIDTH,
  TRAY_MENU_BASE_HEIGHT,
  TRAY_MENU_MODEL_ROW_HEIGHT,
  TRAY_MENU_MAX_HEIGHT,
  computeTrayMenuPosition,
} from "../utils/position";
import type { UsageRefresher } from "../refresher";
import { themeService } from "../services/theme";
import type { WindowManager } from "../windowManager";
import { join } from "path";

// ── 类型 ──

export interface ModelStatus {
  id: string;
  name: string;
  provider: string;
  status: "normal" | "refreshing" | "error" | "needs-login";
  error?: string;
  percent?: number;
}

export interface TrayMenuPayload {
  models: ModelStatus[];
  floatActive: boolean;
  mainWindowActive: boolean;
  theme: string;
  accent: string;
  preset: string;
}

export interface TrayMenuDeps {
  getMainWindow: () => BrowserWindow | null;
  getFloatWindow: () => BrowserWindow | null;
  getFloatWindowActive: () => boolean;
  toggleFloatWindow: () => Promise<void>;
  showOrCreateMain: () => void;
  refresher: UsageRefresher;
  windowManager: WindowManager;
  isQuitting: () => boolean;
  setQuitting: (v: boolean) => void;
}

const LOGIN_KEYWORDS = ["cookie", "登录", "login", "expired", "过期", "unauthorized", "401"];

export class TrayMenuManager {
  private win: BrowserWindow | null = null;
  private lastPayload: TrayMenuPayload | null = null;
  private gen = 0;
  private genAtShow = 0;
  private closing = false;
  private actionInProgress = false;
  private keepOpen = false;
  private showLock = false;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;
  private pageLoaded = false;

  constructor(private deps: TrayMenuDeps) {}

  // ── 窗口（非透明，无闪烁问题） ──

  ensureWindow(): BrowserWindow | null {
    if (this.win && !this.win.isDestroyed()) return this.win;

    const win = new BrowserWindow({
      width: TRAY_MENU_WIDTH,
      height: TRAY_MENU_BASE_HEIGHT,
      resizable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      frame: false,
      transparent: true,
      hasShadow: true,
      show: false,
      webPreferences: {
        preload: join(__dirname, "../preload.js"),
        nodeIntegration: false,
        contextIsolation: true,
      },
    });

    win.setAlwaysOnTop(true, "pop-up-menu");

    this.deps.windowManager.register("trayMenu", win, () => {
      this.win = null;
      this.pageLoaded = false;
    });
    themeService.register(win);

    const isDev = !app.isPackaged;
    const rendererUrl = process.env.ELECTRON_RENDERER_URL || "http://localhost:3000";
    if (isDev) {
      win.loadURL(rendererUrl + "/#/tray-menu");
    } else {
      win.loadFile(join(__dirname, "../dist/index.html"), {
        hash: "/tray-menu",
      });
    }

    win.webContents.on("did-finish-load", () => {
      this.pageLoaded = true;
    });

    // blur 关闭（generation 计数器 + isClosing，同 CtxMenu）
    let blurTimer: ReturnType<typeof setTimeout> | null = null;

    win.on("blur", () => {
      if (this.closing) return;
      if (this.showLock) return;
      if (this.keepOpen) return;   // toggle-float 等操作后保持打开
      if (this.actionInProgress) return;
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        blurTimer = null;
        if (this.closing || this.actionInProgress || this.keepOpen) return;
        if (this.gen !== this.genAtShow) return;
        this.hide();
      }, 120);
    });

    win.on("closed", () => {
      if (blurTimer) {
        clearTimeout(blurTimer);
        blurTimer = null;
      }
      this.win = null;
      this.pageLoaded = false;
    });

    this.win = win;
    return win;
  }

  // ── 显示（同 CtxMenu 模式） ──

  show(cursorX: number, cursorY: number): boolean {
    const win = this.ensureWindow();
    if (!win) return false;

    this.gen++;
    this.genAtShow = this.gen;
    this.keepOpen = false;

    const payload = this.getPayload();
    this.lastPayload = payload;

    const modelSectionH =
      payload.models.length > 0
        ? 24 + payload.models.length * TRAY_MENU_MODEL_ROW_HEIGHT + 8
        : 0;
    const menuHeight = Math.min(
      TRAY_MENU_MAX_HEIGHT,
      TRAY_MENU_BASE_HEIGHT + modelSectionH,
    );

    const { x, y } = computeTrayMenuPosition(cursorX, cursorY, TRAY_MENU_WIDTH, menuHeight);
    win.setSize(TRAY_MENU_WIDTH, menuHeight);
    win.setPosition(x, y);

    win.webContents.send("tray-menu-update", payload);

    if (!this.pageLoaded) {
      win.webContents.once("did-finish-load", () => {
        this.pageLoaded = true;
        if (win.isDestroyed()) return;
        win.webContents.send("tray-menu-update", payload);
        this.doShow(win);
      });
    } else {
      // 延迟一帧显示：确保 renderer 收到 payload 并完成渲染后再 show，避免旧帧闪烁
      setTimeout(() => this.doShow(win), 16);
    }

    return true;
  }

  private doShow(win: BrowserWindow): void {
    this.showLock = true;
    win.showInactive();
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    this.focusTimer = setTimeout(() => {
      this.focusTimer = null;
      if (win && !win.isDestroyed()) {
        win.focus();
      }
      // showLock 在 focus 后再保持 120ms，覆盖 focus 触发的 blur + 120ms timer
      setTimeout(() => {
        this.showLock = false;
      }, 120);
    }, 80);
  }

  hide(): void {
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    this.closing = true;
    this.keepOpen = false;
    const win = this.win;
    if (win && !win.isDestroyed()) {
      win.hide();
      win.blur();
    }
    this.closing = false;
  }

  isVisible(): boolean {
    const win = this.win;
    return win != null && !win.isDestroyed() && win.isVisible();
  }

  destroy(): void {
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    const win = this.win;
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
    this.win = null;
    this.pageLoaded = false;
  }

  refreshIfVisible(): void {
    const win = this.win;
    if (!win || win.isDestroyed() || !win.isVisible()) return;
    const payload = this.getPayload();
    this.lastPayload = payload;
    win.webContents.send("tray-menu-update", payload);
  }

  get lastPayloadValue(): TrayMenuPayload | null {
    return this.lastPayload;
  }

  get isClosing(): boolean {
    return this.closing;
  }

  get generation(): number {
    return this.gen;
  }

  // ── 数据收集 ──

  private getPayload(): TrayMenuPayload {
    const usageData = this.deps.refresher.getCachedData();
    const fetchingState = this.deps.refresher.getFetchingState();
    const models: ModelStatus[] = [];

    for (const [id, usage] of Object.entries(usageData)) {
      let status: ModelStatus["status"] = "normal";
      let error: string | undefined;
      let percent: number | undefined;

      if (fetchingState[id]) {
        status = "refreshing";
      } else if ((usage as any).error) {
        const errMsg = (usage as any).error || "";
        const isLogin = LOGIN_KEYWORDS.some((kw) =>
          errMsg.toLowerCase().includes(kw),
        );
        status = isLogin ? "needs-login" : "error";
        error = errMsg;
      } else {
        percent = usage.percent ?? undefined;
        if (percent == null && usage.total && usage.total > 0) {
          percent = Math.round(((usage.used ?? 0) / usage.total) * 100);
        }
      }

      models.push({
        id,
        name: (usage as any).planName || id,
        provider: "",
        status,
        error,
        percent,
      });
    }

    const theme = themeService.get();
    const mw = this.deps.getMainWindow();

    return {
      models,
      floatActive: this.deps.getFloatWindowActive(),
      mainWindowActive: mw != null && !mw.isDestroyed() && mw.isVisible(),
      theme: theme.mode,
      accent: theme.accent,
      preset: theme.preset,
    };
  }

  // ── 操作分发 ──

  private async handleAction(action: string): Promise<void> {
    this.actionInProgress = true;
    try {
      const mw = this.deps.getMainWindow();

      switch (action) {
        case "show-main":
          if (mw && !mw.isDestroyed()) {
            if (mw.isMinimized()) mw.restore();
            mw.show();
            mw.focus();
          } else {
            // 主窗口已销毁时重新创建（与双击托盘图标行为一致）
            this.deps.showOrCreateMain();
          }
          break;
        case "toggle-float":
          await this.deps.toggleFloatWindow();
          break;
        case "toggle-theme":
          if (mw && !mw.isDestroyed()) {
            mw.webContents.send("tray-toggle-theme");
          }
          break;
        case "refresh-all":
          this.deps.refresher.refreshAll();
          break;
        case "quit":
          this.deps.setQuitting(true);
          app.quit();
          break;
        default:
          if (action.startsWith("set-accent:") && mw && !mw.isDestroyed()) {
            const accent = action.slice("set-accent:".length);
            mw.webContents.send("tray-set-accent", accent);
            // 同步更新托盘菜单自身 UI
            this.refreshIfVisible();
          } else if (action.startsWith("set-preset:") && mw && !mw.isDestroyed()) {
            const preset = action.slice("set-preset:".length);
            mw.webContents.send("tray-set-preset", preset);
            // 同步更新托盘菜单自身 UI
            this.refreshIfVisible();
          } else if (action.startsWith("refresh-model:")) {
            this.deps.refresher.fetchModelById(action.slice("refresh-model:".length)).catch(() => {});
          }
          break;
      }
    } finally {
      this.actionInProgress = false;
    }
  }

  // ── IPC ──

  registerIpc(): void {
    ipcMain.handle("get-tray-menu-config", () => {
      return this.lastPayload;
    });

    ipcMain.handle("tray-menu-hide", () => {
      this.hide();
      return true;
    });

    ipcMain.handle("tray-menu-action", async (_, action: string) => {
      if (action === "__hide") {
        this.hide();
        return true;
      }
      if (action === "toggle-float") {
        this.keepOpen = true;
      }
      await this.handleAction(action);
      if (action !== "toggle-float") {
        this.hide();
      }
      // 直接返回最新快照，不依赖 lastPayload 或 refreshIfVisible
      const fresh = this.getPayload();
      this.lastPayload = fresh;
      return fresh;
    });
  }
}
