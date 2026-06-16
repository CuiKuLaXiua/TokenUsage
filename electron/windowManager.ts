import { BrowserWindow } from "electron";

export class WindowManager {
  private windows = new Map<string, BrowserWindow>();
  private cleanupHandlers = new Map<string, (() => void)[]>();

  register(
    name: string,
    win: BrowserWindow,
    onClose?: () => void,
  ): BrowserWindow {
    // 若已存在同名窗口，先关闭旧窗口
    const existing = this.windows.get(name);
    if (existing && !existing.isDestroyed()) {
      existing.destroy();
    }

    this.windows.set(name, win);
    this.cleanupHandlers.set(name, []);

    win.on("closed", () => {
      this.cleanupHandlers.get(name)?.forEach((h) => h());
      this.cleanupHandlers.delete(name);
      this.windows.delete(name);
      onClose?.();
    });

    return win;
  }

  get(name: string): BrowserWindow | undefined {
    const win = this.windows.get(name);
    return win && !win.isDestroyed() ? win : undefined;
  }

  has(name: string): boolean {
    return this.get(name) !== undefined;
  }

  close(name: string): void {
    const win = this.get(name);
    if (win && !win.isDestroyed()) {
      win.close();
    }
  }

  hide(name: string): void {
    const win = this.get(name);
    if (win && !win.isDestroyed()) {
      win.hide();
    }
  }

  show(name: string): void {
    const win = this.get(name);
    if (win && !win.isDestroyed()) {
      win.show();
    }
  }

  addCleanup(name: string, handler: () => void): void {
    this.cleanupHandlers.get(name)?.push(handler);
  }

  names(): string[] {
    return Array.from(this.windows.keys());
  }
}

export const windowManager = new WindowManager();
