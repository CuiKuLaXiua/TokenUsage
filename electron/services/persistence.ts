import { writeFile } from "fs/promises";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { screen, BrowserWindow } from "electron";

// ── 路径常量 ──

export const dataDir = join(homedir(), ".token-usage");
export const configPath = join(dataDir, "config.json");
export const usagePath = join(dataDir, "usage");
export const windowStatePath = join(dataDir, "window-state.json");
export const floatWindowStatePath = join(dataDir, "float-window-state.json");

// ── ensureDataDir ──

export function ensureDataDir() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }
  if (!existsSync(usagePath)) {
    mkdirSync(usagePath, { recursive: true });
  }
  if (!existsSync(configPath)) {
    const defaultConfig = {
      models: [
        {
          id: "mimo-default",
          name: "小米MIMO",
          provider: "mimo",
          apiKey: process.env.MIMO_API_KEY || "",
          baseUrl:
            process.env.MIMO_BASE_URL ||
            "https://platform.xiaomimimo.com/api/v1/tokenPlan/usage",
          cookies: process.env.MIMO_COOKIES || "",
          loginUrl: "https://platform.xiaomimimo.com/console/plan-manage",
          enabled: true,
        },
      ],
    };
    writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2));
  }
}

// ── WindowState ──

export interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

// ── 关闭行为 ──

export type CloseAction = "minimize-to-tray" | "quit";

// ── I/O 函数 ──

export function readJsonFile(path: string): any | null {
  try {
    if (existsSync(path)) {
      return JSON.parse(readFileSync(path, "utf-8"));
    }
  } catch { /* ignore */ }
  return null;
}

/** 异步写入 JSON 文件（fire-and-forget，不阻塞事件循环） */
export function writeJsonFile(path: string, data: any): void {
  writeFile(path, JSON.stringify(data, null, 2)).catch(() => {});
}

// ── 窗口状态持久化 ──

export function loadWindowState(): WindowState | null {
  try {
    if (!existsSync(windowStatePath)) return null;
    const raw = JSON.parse(readFileSync(windowStatePath, "utf-8"));
    if (!raw || typeof raw.width !== "number" || typeof raw.height !== "number")
      return null;
    // 验证位置是否在可见屏幕内
    if (raw.x !== undefined && raw.y !== undefined) {
      const displays = screen.getAllDisplays();
      const visible = displays.some((d) => {
        const { x, y, width, height } = d.bounds;
        return (
          raw.x >= x - 50 &&
          raw.x < x + width - 50 &&
          raw.y >= y - 50 &&
          raw.y < y + height - 50
        );
      });
      if (!visible) {
        raw.x = undefined;
        raw.y = undefined;
      }
    }
    return raw;
  } catch {
    return null;
  }
}

export function saveWindowState(win: BrowserWindow) {
  try {
    const isMaximized = win.isMaximized();
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
    const state: WindowState = {
      width: bounds.width,
      height: bounds.height,
      x: bounds.x,
      y: bounds.y,
      isMaximized,
    };
    // 异步写入：不阻塞事件循环（resize/move 时高频调用）
    writeFile(windowStatePath, JSON.stringify(state)).catch(() => {});
  } catch {
    /* ignore */
  }
}

// ── 悬浮窗位置持久化 ──

export function loadFloatPosition(): { x: number; y: number } | null {
  try {
    if (!existsSync(floatWindowStatePath)) return null;
    const raw = JSON.parse(readFileSync(floatWindowStatePath, "utf-8"));
    if (typeof raw.x !== "number" || typeof raw.y !== "number") return null;
    // 验证位置是否在可见屏幕内
    const displays = screen.getAllDisplays();
    const visible = displays.some((d) => {
      const { x, y, width, height } = d.workArea;
      return (
        raw.x >= x - 50 &&
        raw.x < x + width - 50 &&
        raw.y >= y - 50 &&
        raw.y < y + height - 50
      );
    });
    return visible ? raw : null;
  } catch {
    return null;
  }
}

export function saveFloatPosition(win: BrowserWindow) {
  try {
    if (!win || win.isDestroyed()) return;
    const [x, y] = win.getPosition();
    writeFile(floatWindowStatePath, JSON.stringify({ x, y })).catch(() => {});
  } catch {
    /* ignore */
  }
}

// ── 关闭行为配置 ──

export function getCloseActionFromConfig(): CloseAction | null {
  try {
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      return config.closeAction ?? null;
    }
  } catch {
    /* ignore */
  }
  return null;
}

export function saveCloseActionToConfig(action: CloseAction | null) {
  try {
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      config.closeAction = action;
      writeFile(configPath, JSON.stringify(config, null, 2)).catch(() => {});
    }
  } catch {
    /* ignore */
  }
}
