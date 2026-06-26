import { BrowserWindow, ipcMain } from "electron";
import { CTX_MENU_WIDTH, CTX_MENU_HEIGHT_NO_MODEL, CTX_MENU_HEIGHT_WITH_MODEL, computeCtxMenuPosition } from "../utils/position";

export interface CtxMenuConfig {
  modelId: string | null;
  modelName: string | null;
  theme: string;
  preset: string;
  layoutMode: string;
  alwaysOnTop: boolean;
}

export interface CtxMenuDeps {
  ensureCtxMenuWindow: () => BrowserWindow | null;
  getFloatWindow: () => BrowserWindow | null;
}

export class CtxMenuManager {
  private lastConfig: CtxMenuConfig | null = null;
  private gen = 0;
  private genAtShow = 0;
  private closing = false;
  private showing = false;
  private blurTimer: ReturnType<typeof setTimeout> | null = null;
  private focusTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private deps: CtxMenuDeps) {}

  show(options: {
    screenX: number;
    screenY: number;
  } & CtxMenuConfig): boolean {
    const win = this.deps.ensureCtxMenuWindow();
    if (!win) return false;

    this.gen++;
    this.genAtShow = this.gen;

    const menuHeight = options.modelName
      ? CTX_MENU_HEIGHT_WITH_MODEL
      : CTX_MENU_HEIGHT_NO_MODEL;
    const { x, y } = computeCtxMenuPosition(
      options.screenX,
      options.screenY,
      menuHeight,
    );
    win.setSize(CTX_MENU_WIDTH, menuHeight);
    win.setPosition(x, y);

    const config: CtxMenuConfig = {
      modelId: options.modelId,
      modelName: options.modelName,
      theme: options.theme,
      preset: options.preset,
      layoutMode: options.layoutMode,
      alwaysOnTop: options.alwaysOnTop,
    };
    this.lastConfig = config;
    win.webContents.send("ctx-menu-config", config);

    this.showing = true;
    win.showInactive();
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    this.focusTimer = setTimeout(() => {
      this.focusTimer = null;
      this.showing = false;
      if (win && !win.isDestroyed()) {
        win.focus();
      }
    }, 80);

    return true;
  }

  hide(): void {
    this.showing = false;
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    this.closing = true;
    const win = this.deps.ensureCtxMenuWindow();
    if (win && !win.isDestroyed()) {
      win.hide();
      win.blur();
    }
    this.closing = false;
    const fw = this.deps.getFloatWindow();
    if (fw && !fw.isDestroyed()) {
      fw.webContents.send("ctx-menu-closed");
    }
  }

  destroy(): void {
    if (this.blurTimer) {
      clearTimeout(this.blurTimer);
      this.blurTimer = null;
    }
    if (this.focusTimer) {
      clearTimeout(this.focusTimer);
      this.focusTimer = null;
    }
    const win = this.deps.ensureCtxMenuWindow();
    if (win && !win.isDestroyed()) {
      win.destroy();
    }
  }

  get lastConfigValue(): CtxMenuConfig | null {
    return this.lastConfig;
  }

  get isClosing(): boolean { return this.closing; }
  get isShowing(): boolean { return this.showing; }
  get generation(): number { return this.gen; }
  get genAtShowValue(): number { return this.genAtShow; }

  // 点击外部关闭 — 注册 blur/closed 事件，含 showing 守卫防止 show 过程中误关
  onBlur(): void {
    if (this.closing) return;
    if (this.showing) return;
    if (this.blurTimer) clearTimeout(this.blurTimer);
    this.blurTimer = setTimeout(() => {
      this.blurTimer = null;
      if (this.closing || this.showing) return;
      if (this.gen !== this.genAtShow) return;
      this.hide();
    }, 120);
  }

  registerWindow(win: BrowserWindow): void {
    win.on("blur", () => this.onBlur());
    win.on("closed", () => {
      if (this.blurTimer) {
        clearTimeout(this.blurTimer);
        this.blurTimer = null;
      }
    });
  }

  registerIpc(): void {
    ipcMain.handle(
      "show-ctx-menu",
      (_, options: {
        screenX: number;
        screenY: number;
      } & CtxMenuConfig) => {
        return this.show(options);
      },
    );

    ipcMain.handle("hide-ctx-menu", () => {
      this.hide();
      return true;
    });

    ipcMain.handle("get-ctx-menu-config", () => {
      return this.lastConfig;
    });

    ipcMain.handle("ctx-menu-action", (_, action: string) => {
      const fw = this.deps.getFloatWindow();
      if (fw && !fw.isDestroyed()) {
        fw.webContents.send("execute-ctx-menu-action", action);
      }
      this.hide();
      return true;
    });
  }
}
