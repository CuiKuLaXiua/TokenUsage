import { BrowserWindow } from "electron";

export interface Theme {
  mode: string;
  accent: string;
  preset: string;
}

class ThemeService {
  readonly targets = new Set<BrowserWindow>();
  current: Theme = { mode: "dark", accent: "forest", preset: "midnight" };

  register(win: BrowserWindow): void {
    this.targets.add(win);
    win.on("closed", () => this.targets.delete(win));
  }

  broadcast(theme: Theme): void {
    this.current = { ...theme };
    this.targets.forEach((win) => {
      if (!win.isDestroyed()) {
        win.webContents.send("theme-changed", theme);
      }
    });
  }

  get(): Theme {
    return { ...this.current };
  }

  get mode(): "dark" | "light" {
    return this.current.mode === "light" ? "light" : "dark";
  }
}

export const themeService = new ThemeService();
