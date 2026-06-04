import { app, BrowserWindow, ipcMain, net, screen, Tray, Menu, nativeImage } from "electron";
import { join } from "path";

const isDev = !app.isPackaged;
const rendererUrl =
  process.env.ELECTRON_RENDERER_URL || "http://localhost:3000";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { homedir } from "os";
import { config as loadDotenv } from "dotenv";
import {
  isValidMonth,
  isValidConfig,
  isAllowedUrl,
  isValidUsageData,
} from "./ipc-validators";
import { LoginWindowManager } from "./login";
import { OpenCodeLoginWindowManager } from "./opencode-login";
import { UsageRefresher } from "./refresher";

// 加载 .env.local 环境变量
loadDotenv({ path: join(__dirname, "../.env.local") });

// 捕获未处理的错误，防止进程退出
process.on("uncaughtException", (error) => {
  console.error("未捕获的异常:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("未处理的Promise拒绝:", reason);
});

let mainWindow: BrowserWindow | null = null;
let floatWindow: BrowserWindow | null = null;
let floatStripWindow: BrowserWindow | null = null;
let detailWindow: BrowserWindow | null = null;
let detailWindowReady = false;
let detailWindowReadyResolve: (() => void) | null = null;
let ctxMenuWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let currentThemeMode: 'dark' | 'light' = 'dark';
const loginManager = new LoginWindowManager();
const openCodeLoginManager = new OpenCodeLoginWindowManager();

const dataDir = join(homedir(), ".token-usage");
const configPath = join(dataDir, "config.json");
const usagePath = join(dataDir, "usage");
const windowStatePath = join(dataDir, "window-state.json");
const floatWindowStatePath = join(dataDir, "float-window-state.json");
const refresher = new UsageRefresher(configPath);

function ensureDataDir() {
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

interface WindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
  isMaximized?: boolean;
}

function loadWindowState(): WindowState | null {
  try {
    if (!existsSync(windowStatePath)) return null;
    const raw = JSON.parse(readFileSync(windowStatePath, "utf-8"));
    if (!raw || typeof raw.width !== "number" || typeof raw.height !== "number") return null;
    // 验证位置是否在可见屏幕内
    if (raw.x !== undefined && raw.y !== undefined) {
      const displays = screen.getAllDisplays();
      const visible = displays.some(d => {
        const { x, y, width, height } = d.bounds;
        return raw.x >= x - 50 && raw.x < x + width - 50
            && raw.y >= y - 50 && raw.y < y + height - 50;
      });
      if (!visible) { raw.x = undefined; raw.y = undefined; }
    }
    return raw;
  } catch {
    return null;
  }
}

function saveWindowState(win: BrowserWindow) {
  try {
    const isMaximized = win.isMaximized();
    const bounds = isMaximized ? win.getNormalBounds() : win.getBounds();
    const state: WindowState = { width: bounds.width, height: bounds.height, x: bounds.x, y: bounds.y, isMaximized };
    writeFileSync(windowStatePath, JSON.stringify(state));
  } catch { /* ignore */ }
}

// ── 悬浮窗位置记忆 ──
function loadFloatPosition(): { x: number; y: number } | null {
  try {
    if (!existsSync(floatWindowStatePath)) return null;
    const raw = JSON.parse(readFileSync(floatWindowStatePath, "utf-8"));
    if (typeof raw.x !== "number" || typeof raw.y !== "number") return null;
    // 验证位置是否在可见屏幕内
    const displays = screen.getAllDisplays();
    const visible = displays.some(d => {
      const { x, y, width, height } = d.workArea;
      return raw.x >= x - 50 && raw.x < x + width - 50
          && raw.y >= y - 50 && raw.y < y + height - 50;
    });
    return visible ? raw : null;
  } catch {
    return null;
  }
}

function saveFloatPosition() {
  try {
    if (!floatWindow || floatWindow.isDestroyed()) return;
    const [x, y] = floatWindow.getPosition();
    writeFileSync(floatWindowStatePath, JSON.stringify({ x, y }));
  } catch { /* ignore */ }
}

// ── 关闭行为管理 ──
type CloseAction = 'minimize-to-tray' | 'quit'

function getCloseActionFromConfig(): CloseAction | null {
  try {
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      return config.closeAction ?? null;
    }
  } catch { /* ignore */ }
  return null;
}

function saveCloseActionToConfig(action: CloseAction | null) {
  try {
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      config.closeAction = action;
      writeFileSync(configPath, JSON.stringify(config, null, 2));
    }
  } catch { /* ignore */ }
}

// ── 图标路径 ──
// 窗口/侧边栏图标：256x256 圆角版本
function getIconPath() {
  if (isDev) {
    return join(__dirname, "../public/logo_rounded.png");
  }
  return join(__dirname, "../dist/logo_rounded.png");
}

// 托盘图标：64x64 圆角版本（为 2x retina 准备，实际显示 ~32x32）
function getTrayIconPath() {
  if (isDev) {
    return join(__dirname, "../public/logo_tray.png");
  }
  return join(__dirname, "../dist/logo_tray.png");
}

// ── 系统托盘 ──
function buildTrayMenu(): Menu {
  return Menu.buildFromTemplate([
    {
      label: "显示主窗口",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (mainWindow.isMinimized()) mainWindow.restore();
          mainWindow.show();
          mainWindow.focus();
        } else {
          createWindow();
        }
      },
    },
    { type: "separator" },
    {
      label: currentThemeMode === 'dark' ? "切换浅色模式" : "切换深色模式",
      click: () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("tray-toggle-theme");
        }
      },
    },
    {
      label: "刷新所有数据",
      click: () => {
        refresher.refreshAll();
      },
    },
    { type: "separator" },
    {
      label: "退出",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
}

function createTray() {
  const iconPath = getTrayIconPath();
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.error("[Tray] 图标加载失败:", iconPath);
    // 回退
    const fallbackPath = join(process.resourcesPath, "app.asar.unpacked", "public", "logo_tray.png");
    icon = nativeImage.createFromPath(fallbackPath);
  }
  // 托盘图标缩放到 32x32（Windows 托盘推荐尺寸）
  icon = icon.resize({ width: 32, height: 32 });

  tray = new Tray(icon);
  tray.setToolTip("Token Usage");
  tray.setContextMenu(buildTrayMenu());

  tray.on("double-click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

function createWindow() {
  const saved = loadWindowState();
  const defaultOpts = { width: 1200, height: 800, minWidth: 1000, minHeight: 700 };

  mainWindow = new BrowserWindow({
    ...defaultOpts,
    ...(saved ? { width: saved.width, height: saved.height } : {}),
    ...(saved?.x !== undefined ? { x: saved.x, y: saved.y } : {}),
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    frame: false,
    titleBarStyle: "hidden",
    ...(process.platform === "darwin"
      ? { trafficLightPosition: { x: 12, y: 16 } }
      : {}),
    icon: getIconPath(),
  });

  if (saved?.isMaximized) {
    mainWindow.maximize();
  }

  // 窗口尺寸记忆：防抖保存
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  const debouncedSave = () => {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) saveWindowState(mainWindow);
    }, 300);
  };
  mainWindow.on("resize", debouncedSave);
  mainWindow.on("move", debouncedSave);
  mainWindow.on("close", (event) => {
    if (mainWindow && !mainWindow.isDestroyed()) saveWindowState(mainWindow);

    // 真正退出时不拦截
    if (isQuitting) return;

    // 关闭行为逻辑
    const closeAction = getCloseActionFromConfig();
    if (closeAction === 'minimize-to-tray') {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }
    if (closeAction === 'quit') {
      // 允许关闭，退出应用
      isQuitting = true;
      setTimeout(() => app.quit(), 0);
      return;
    }
    // 未设置：弹窗询问
    event.preventDefault();
    mainWindow?.webContents.send("show-close-dialog");
  });

  if (isDev) {
    mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(join(__dirname, "../dist/index.html"));
  }

  // 捕获渲染进程崩溃事件
  mainWindow.webContents.on("crashed", () => {
    console.error("渲染进程崩溃!");
  });

  mainWindow.on("unresponsive", () => {
    console.error("窗口无响应!");
  });

  mainWindow.webContents.on(
    "did-fail-load",
    (_, errorCode, errorDescription) => {
      console.error("页面加载失败:", errorCode, errorDescription);
    },
  );

  // 添加窗口关闭清理
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

const FLOAT_WIDTH = 240;
const FLOAT_HEIGHT = 88;
const DETAIL_WIDTH = 320;
const DETAIL_HEIGHT = 420;
const DETAIL_GAP = 8;
const CTX_MENU_WIDTH = 180;
const CTX_MENU_HEIGHT_NO_MODEL = 235;
const CTX_MENU_HEIGHT_WITH_MODEL = 295;

// 缓存最近一次右键菜单配置，供渲染进程拉取
let lastCtxMenuConfig: {
  modelId: string | null;
  modelName: string | null;
  theme: string;
  layoutMode: string;
  alwaysOnTop: boolean;
} | null = null;

function positionStripWindow(edge: "left" | "right" | "top" | null, dockY: number) {
  if (!edge) return;
  if (!floatStripWindow || floatStripWindow.isDestroyed() || !floatWindow)
    return;
  const display = screen.getDisplayMatching(floatWindow!.getBounds());
  const { x: workX, y: workY, width: workW } = display.workArea;
  let sx: number;
  switch (edge) {
    case "left":
      sx = workX + EDGE_MARGIN;
      break;
    case "right":
      sx = workX + workW - DOCK_VISIBLE_WIDTH - EDGE_MARGIN;
      break;
    case "top":
      sx = workX + EDGE_MARGIN;
      break;
    default:
      return;
  }
  floatStripWindow.setPosition(Math.round(sx), Math.round(dockY));
  if (!floatStripWindow.isVisible()) {
    floatStripWindow.show();
  }
  // 置于 floatWindow 上方
  if (floatWindow) floatStripWindow.moveTop();
}

function createFloatStripWindow() {
  if (!floatWindow || floatWindow.isDestroyed()) return;
  floatStripWindow = new BrowserWindow({
    width: DOCK_VISIBLE_WIDTH,
    height: FLOAT_HEIGHT,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    show: false,
    backgroundColor: "#000",
    transparent: true,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  if (isDev) {
    floatStripWindow.loadURL(rendererUrl + "/#/float-strip");
  } else {
    floatStripWindow.loadFile(join(__dirname, "../dist/index.html"), {
      hash: "/float-strip",
    });
  }
  // 置于 floatWindow 之上
  floatStripWindow.on("closed", () => {
    floatStripWindow = null;
  });
}

function springOvershoot(p: number): number {
  if (p === 0 || p === 1) return p;
  if (p < 0.5) return 1 - Math.pow(1 - p / 0.5, 3) * 0.85;
  const pp = (p - 0.5) / 0.5;
  return 1 + 0.15 * Math.pow(1 - pp, 2) - 0.15 * Math.pow(1 - pp, 4);
}

function createFloatWindow() {
  // 恢复上次保存的位置
  const savedPos = loadFloatPosition();
  const posOpts = savedPos ? { x: savedPos.x, y: savedPos.y } : {};

  floatWindow = new BrowserWindow({
    width: FLOAT_WIDTH,
    height: FLOAT_HEIGHT,
    ...posOpts,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    hasShadow: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: getIconPath(),
  });

  if (isDev) {
    floatWindow.loadURL(rendererUrl + "/#/float");
  } else {
    floatWindow.loadFile(join(__dirname, "../dist/index.html"), {
      hash: "/float",
    });
  }

  // Fix: 捕获原生右键事件（即使窗口未聚焦也能触发，解决 Issue #1）
  floatWindow.webContents.on("context-menu", (_, params) => {
    floatWindow?.webContents.send("native-context-menu", {
      x: params.x,
      y: params.y,
    });
  });

  floatWindow.on("closed", () => {
    // 保存悬浮窗位置（非贴边状态时）
    if (!edgeDockState.get(floatWindow?.id || -1)?.isDocked) {
      saveFloatPosition();
    }

    // 清理拖拽状态和定时器
    const dragState = dragStateMap.get(floatWindow?.id || -1);
    if (dragState?.intervalId) {
      clearInterval(dragState.intervalId);
    }
    dragStateMap.delete(floatWindow?.id || -1);

    // 主窗口关闭时同步关闭详情窗口和贴边条
    if (detailWindow && !detailWindow.isDestroyed()) {
      detailWindow.close();
    }
    if (floatStripWindow && !floatStripWindow.isDestroyed()) {
      floatStripWindow.close();
    }
    destroyCtxMenu();
    stopHoverPolling();
    edgeDockState.delete(floatWindow?.id || -1);
    floatWindow = null;
    // 通知主窗口悬浮窗已关闭
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("float-window-closed");
    }
  });

  // 预创建详情窗口，避免首次触发时的加载延迟
  createDetailWindow();
}

function createDetailWindow() {
  if (detailWindow && !detailWindow.isDestroyed()) {
    return detailWindow;
  }

  if (!floatWindow || floatWindow.isDestroyed()) {
    return null;
  }

  detailWindow = new BrowserWindow({
    width: DETAIL_WIDTH,
    height: DETAIL_HEIGHT,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    show: false,
    hasShadow: false,
    parent: floatWindow,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: getIconPath(),
  });

  // 重置 ready 状态，等待渲染进程 IPC 通知
  detailWindowReady = false;
  detailWindowReadyResolve = null;

  // 确保详情窗口在主窗口之上
  detailWindow.setAlwaysOnTop(true, "pop-up-menu");

  if (isDev) {
    detailWindow.loadURL(rendererUrl + "/#/float-detail");
  } else {
    detailWindow.loadFile(join(__dirname, "../dist/index.html"), {
      hash: "/float-detail",
    });
  }

  detailWindow.on("closed", () => {
    detailWindow = null;
  });

  return detailWindow;
}

function ensureCtxMenuWindow() {
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
    return ctxMenuWindow;
  }

  ctxMenuWindow = new BrowserWindow({
    width: CTX_MENU_WIDTH,
    height: CTX_MENU_HEIGHT_NO_MODEL,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    frame: false,
    transparent: true,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  ctxMenuWindow.setAlwaysOnTop(true, "pop-up-menu");

  if (isDev) {
    ctxMenuWindow.loadURL(rendererUrl + "/#/ctx-menu");
  } else {
    ctxMenuWindow.loadFile(join(__dirname, "../dist/index.html"), {
      hash: "/ctx-menu",
    });
  }

  // 点击外部关闭 — 使用 generation 计数器防止旧 blur 回调干扰新 show
  let blurTimer: ReturnType<typeof setTimeout> | null = null;
  const genAtBind = ctxMenuGen; // 捕获绑定时的 generation

  ctxMenuWindow.on("blur", () => {
    if (ctxMenuClosing) return; // hideCtxMenu 触发的 blur，忽略
    if (blurTimer) clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      blurTimer = null;
      // generation 不匹配 → 菜单已被新的 show 操作接管，不关闭
      if (ctxMenuClosing || ctxMenuGen !== genAtBind) return;
      hideCtxMenuWindow();
    }, 120);
  });

  ctxMenuWindow.on("closed", () => {
    if (blurTimer) {
      clearTimeout(blurTimer);
      blurTimer = null;
    }
    ctxMenuWindow = null;
  });

  return ctxMenuWindow;
}

// 右键菜单生命周期管理 — 复用同一窗口，仅 show/hide
let ctxMenuGen = 0; // 每次 show 递增，blur 回调通过 generation 判断是否过期
let ctxMenuClosing = false; // hideCtxMenu 主动关闭时为 true，抑制 blur
let ctxMenuFocusTimer: ReturnType<typeof setTimeout> | null = null;

/**
 * 显示右键菜单（复用同一窗口，position + config + show）
 */
function showCtxMenuWindow(options: {
  screenX: number;
  screenY: number;
  modelId: string | null;
  modelName: string | null;
  theme: string;
  layoutMode: string;
  alwaysOnTop: boolean;
}) {
  const win = ensureCtxMenuWindow();
  if (!win) return false;

  ctxMenuGen++;

  const menuHeight = options.modelName
    ? CTX_MENU_HEIGHT_WITH_MODEL
    : CTX_MENU_HEIGHT_NO_MODEL;
  const { x, y } = computeCtxMenuPosition(options.screenX, options.screenY, menuHeight);
  win.setSize(CTX_MENU_WIDTH, menuHeight);
  win.setPosition(x, y);

  const config = {
    modelId: options.modelId,
    modelName: options.modelName,
    theme: options.theme,
    layoutMode: options.layoutMode,
    alwaysOnTop: options.alwaysOnTop,
  };
  lastCtxMenuConfig = config;
  win.webContents.send("ctx-menu-config", config);

  win.showInactive();
  if (ctxMenuFocusTimer) {
    clearTimeout(ctxMenuFocusTimer);
    ctxMenuFocusTimer = null;
  }
  ctxMenuFocusTimer = setTimeout(() => {
    ctxMenuFocusTimer = null;
    if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
      ctxMenuWindow.focus();
    }
  }, 80);

  return true;
}

/**
 * 隐藏右键菜单（仅 hide，不销毁窗口，供下次复用）
 */
function hideCtxMenuWindow() {
  if (ctxMenuFocusTimer) {
    clearTimeout(ctxMenuFocusTimer);
    ctxMenuFocusTimer = null;
  }
  ctxMenuClosing = true;
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
    ctxMenuWindow.hide();
    ctxMenuWindow.blur();
  }
  ctxMenuClosing = false;
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.webContents.send("ctx-menu-closed");
  }
}

/**
 * 彻底销毁右键菜单窗口（浮窗关闭时调用）
 */
function destroyCtxMenu() {
  if (ctxMenuFocusTimer) {
    clearTimeout(ctxMenuFocusTimer);
    ctxMenuFocusTimer = null;
  }
  if (ctxMenuWindow && !ctxMenuWindow.isDestroyed()) {
    ctxMenuWindow.destroy();
    ctxMenuWindow = null;
  }
}

/**
 * 计算详情窗口位置，支持边缘检测
 */
function computeDetailPosition(
  anchorX: number,
  anchorY: number,
  anchorW: number,
  anchorH: number,
): { x: number; y: number } {
  const { width: screenW, height: screenH } =
    require("electron").screen.getPrimaryDisplay().workAreaSize;

  // 默认在右侧
  let x = anchorX + anchorW + DETAIL_GAP;
  let y = anchorY;

  // 右侧空间不足，放左侧
  if (x + DETAIL_WIDTH > screenW - 20) {
    x = Math.max(0, anchorX - DETAIL_WIDTH - DETAIL_GAP);
  }

  // 底部空间不足，向上对齐
  if (y + DETAIL_HEIGHT > screenH - 20) {
    y = Math.max(0, anchorY + anchorH - DETAIL_HEIGHT);
  }

  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * 计算右键菜单位置，支持屏幕边缘检测
 */
function computeCtxMenuPosition(
  anchorX: number,
  anchorY: number,
  menuH: number,
): { x: number; y: number } {
  const { screen } = require("electron");
  const display = screen.getDisplayNearestPoint({ x: anchorX, y: anchorY });
  const { width: screenW, height: screenH } = display.workAreaSize;

  let x = anchorX + 2;
  let y = anchorY + 2;

  // 右侧越界
  if (x + CTX_MENU_WIDTH > screenW - 10) {
    x = Math.max(0, screenW - CTX_MENU_WIDTH - 10);
  }

  // 底部越界：翻转到光标上方
  if (y + menuH > screenH - 10) {
    y = Math.max(0, anchorY - menuH + 2);
  }

  // 顶部安全边距
  if (y < 0) y = 10;

  return { x: Math.round(x), y: Math.round(y) };
}

app.whenReady().then(() => {
  ensureDataDir();
  createTray();
  createWindow();
  refresher.start(); // 启动统一刷新

  app.on("before-quit", () => {
    isQuitting = true;
    if (tray) {
      tray.destroy();
      tray = null;
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

// IPC handlers for data storage
ipcMain.handle("load-config", () => {
  try {
    if (existsSync(configPath)) {
      return JSON.parse(readFileSync(configPath, "utf-8"));
    }
    return {};
  } catch (error) {
    console.error("Error loading config:", error);
    return {};
  }
});

ipcMain.handle("save-config", (_, config) => {
  try {
    if (!isValidConfig(config)) {
      console.error("Invalid config structure");
      return false;
    }
    // 保留 closeAction 等非 models 字段
    let fullConfig = config;
    try {
      if (existsSync(configPath)) {
        const existing = JSON.parse(readFileSync(configPath, "utf-8"));
        fullConfig = { ...existing, ...config };
      }
    } catch { /* ignore */ }
    writeFileSync(configPath, JSON.stringify(fullConfig, null, 2));

    // 广播配置更新给所有窗口
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send("config-updated");
    });

    // 重启刷新服务
    refresher.restart();

    return true;
  } catch (error) {
    console.error("Error saving config:", error);
    return false;
  }
});

ipcMain.handle("load-usage", (_, month) => {
  try {
    if (!isValidMonth(month)) {
      console.error("Invalid month format:", month);
      return [];
    }
    const filePath = join(usagePath, `${month}.json`);
    if (existsSync(filePath)) {
      return JSON.parse(readFileSync(filePath, "utf-8"));
    }
    return [];
  } catch (error) {
    console.error("Error loading usage:", error);
    return [];
  }
});

ipcMain.handle("save-usage", (_, month, data) => {
  try {
    if (!isValidMonth(month)) {
      console.error("Invalid month format:", month);
      return false;
    }
    if (!isValidUsageData(data)) {
      console.error("Invalid usage data");
      return false;
    }
    const filePath = join(usagePath, `${month}.json`);
    writeFileSync(filePath, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error("Error saving usage:", error);
    return false;
  }
});

ipcMain.handle("get-data-path", () => {
  return dataDir;
});

ipcMain.handle("open-float-window", () => {
  if (!floatWindow) {
    createFloatWindow();
    ensureCtxMenuWindow(); // 预创建右键菜单窗口，避免首次触发时等待加载
  } else if (floatWindow.isVisible()) {
    floatWindow.close();
    return false;
  } else {
    // 边缘吸附等隐藏状态：视为已开启，再次点击则关闭
    if (edgeDockState.get(floatWindow.id)?.isDocked) {
      floatWindow.close();
      return false;
    }
    floatWindow.show();
    floatWindow.focus();
  }
  return true;
});

ipcMain.handle("get-float-window-state", () => {
  if (!floatWindow || floatWindow.isDestroyed()) {
    return { active: false };
  }
  // 存在即 active，无论可见还是边缘吸附
  return { active: true };
});

ipcMain.handle("close-float-window", () => {
  if (detailWindow && !detailWindow.isDestroyed()) {
    detailWindow.close();
    detailWindow = null;
  }
  destroyCtxMenu();
  stopHoverPolling();
  edgeDockState.delete(floatWindow?.id || -1);
  if (floatStripWindow && !floatStripWindow.isDestroyed()) {
    floatStripWindow.close();
  }
  if (floatWindow) {
    floatWindow.close();
    floatWindow = null;
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("float-window-closed");
  }
  return true;
});

// ── 详情悬浮窗 IPC ──

ipcMain.handle("focus-float-window", () => {
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.focus();
  }
  return true;
});

ipcMain.handle(
  "show-float-detail",
  async (
    _,
    options: {
      anchorX: number;
      anchorY: number;
      anchorW: number;
      anchorH: number;
    },
  ) => {
    const win = createDetailWindow();
    if (!win) return false;

    const { x, y } = computeDetailPosition(
      options.anchorX,
      options.anchorY,
      options.anchorW,
      options.anchorH,
    );

    win.setPosition(x, y);

    if (!win.isVisible()) {
      // 首次显示：等待渲染进程完成挂载后再显示窗口
      if (!detailWindowReady) {
        await new Promise<void>((resolve) => {
          detailWindowReadyResolve = resolve;
        });
      }
      win.show();
      win.focus();
    }

    return true;
  },
);

ipcMain.on("detail-ready", () => {
  detailWindowReady = true;
  if (detailWindowReadyResolve) {
    detailWindowReadyResolve();
    detailWindowReadyResolve = null;
  }
});

ipcMain.handle("hide-float-detail", () => {
  if (detailWindow && !detailWindow.isDestroyed()) {
    detailWindow.hide();
  }
  return true;
});

ipcMain.handle("resize-detail-window", (_, width: number, height: number) => {
  if (detailWindow && !detailWindow.isDestroyed()) {
    const MIN_H = 120;
    const MAX_H = 620;
    const clamped = Math.round(Math.min(MAX_H, Math.max(MIN_H, height)));
    detailWindow.setSize(Math.round(width), clamped);
  }
  return true;
});

ipcMain.handle("notify-detail-hover", (_event, state: "enter" | "leave") => {
  // 将详情窗口的 hover 状态广播给主悬浮窗
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.webContents.send("detail-hover-changed", state);
  }
});

// ── 右键菜单弹出窗 IPC ──

ipcMain.handle(
  "show-ctx-menu",
  (
    _,
    options: {
      screenX: number;
      screenY: number;
      modelId: string | null;
      modelName: string | null;
      theme: string;
      layoutMode: string;
      alwaysOnTop: boolean;
    },
  ) => {
    return showCtxMenuWindow(options);
  },
);

ipcMain.handle("hide-ctx-menu", () => {
  hideCtxMenuWindow();
  return true;
});

ipcMain.handle("get-ctx-menu-config", () => {
  return lastCtxMenuConfig;
});

ipcMain.handle("ctx-menu-action", (_, action: string) => {
  // 转发动作到浮窗执行（在隐藏菜单之前，确保动作被处理）
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.webContents.send("execute-ctx-menu-action", action);
  }
  hideCtxMenuWindow();
  return true;
});

ipcMain.handle("get-float-window-bounds", () => {
  if (!floatWindow || floatWindow.isDestroyed()) return null;
  const [x, y] = floatWindow.getPosition();
  const [w, h] = floatWindow.getSize();
  return { x, y, width: w, height: h };
});

ipcMain.handle("set-float-always-on-top", (_, value: boolean) => {
  if (floatWindow) {
    floatWindow.setAlwaysOnTop(value);
  }
  return true;
});

// ── 主题同步：广播给所有悬浮窗口 ──
ipcMain.handle(
  "notify-theme-changed",
  (_, theme: { mode: string; accent: string }) => {
    // 更新缓存的模式并重建托盘菜单
    if (theme.mode === 'dark' || theme.mode === 'light') {
      currentThemeMode = theme.mode;
      if (tray && !tray.isDestroyed()) {
        tray.setContextMenu(buildTrayMenu());
      }
    }
    const targets = [floatWindow, detailWindow, ctxMenuWindow];
    for (const win of targets) {
      if (win && !win.isDestroyed()) {
        win.webContents.send("theme-changed", theme);
      }
    }
    return true;
  },
);

const _logFile = join(app.getPath("temp"), "tokenusage-debug.log");
function _dbg(msg: string) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  try {
    require("fs").appendFileSync(_logFile, line);
  } catch {}
}

ipcMain.handle("resize-float-window", (_, width: number, height: number) => {
  if (floatWindow && !floatWindow.isDestroyed()) {
    const [currentWidth, currentHeight] = floatWindow.getSize();
    // 只在尺寸有明显变化时调整，避免频繁闪烁
    if (
      Math.abs(currentWidth - width) > 5 ||
      Math.abs(currentHeight - height) > 5
    ) {
      _dbg(
        `resize-float-window: ${currentWidth}x${currentHeight} -> ${width}x${height}`,
      );
      // Windows 无边框窗口在 resizable=false 时可能无法正确缩小
      // 临时切换 resizable 状态以确保 setSize 生效
      floatWindow.setResizable(true);
      floatWindow.setSize(width, height);
      floatWindow.setResizable(false);
      const [afterW, afterH] = floatWindow.getSize();
      _dbg(`  after setSize: ${afterW}x${afterH}`);
    } else {
      _dbg(
        `resize-float-window: skipped (diff too small) ${currentWidth}x${currentHeight} -> ${width}x${height}`,
      );
    }
  }
  return true;
});

ipcMain.handle("debug-log", (_, msg: string) => {
  _dbg(`[renderer] ${msg}`);
  return true;
});

// 靠边隐藏状态管理
interface EdgeDockState {
  isDocked: boolean;
  edge: "left" | "right" | "top" | null;
  dockX: number;
  dockY: number;
  originalX: number;
  originalY: number;
}
const edgeDockState = new Map<number, EdgeDockState>();
const EDGE_THRESHOLD = 0; // 只有贴到边缘才触发靠边隐藏
const DOCK_VISIBLE_WIDTH = 8; // 吸附后露出边缘的宽度
const EDGE_MARGIN = 2; // 贴边条与屏幕边缘的间距

// 更稳定的拖拽方案：主进程控制
interface DragState {
  isDragging: boolean;
  startMouseX: number;
  startMouseY: number;
  startPosX: number;
  startPosY: number;
  intervalId: ReturnType<typeof setInterval> | null;
  lastCursorX: number;
  lastCursorY: number;
  idleCount: number; // 鼠标静止计数
}

const dragStateMap = new Map<number, DragState>();
const DRAG_IDLE_THRESHOLD = 15; // 鼠标静止超过 15 帧（约 240ms）自动停止拖拽

ipcMain.handle(
  "start-window-drag",
  (event, options: { mouseX: number; mouseY: number }) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win || win.isDestroyed()) return;

    // 拖拽开始时停止 hover polling，防止拖拽结束后干扰
    if (edgeDockState.has(win.id)) {
      stopHoverPolling();
    }

    const [posX, posY] = win.getPosition();

    // 如果已有拖拽状态，先清理
    const existingState = dragStateMap.get(win.id);
    if (existingState) {
      if (existingState.intervalId) clearInterval(existingState.intervalId);
    }

    const state: DragState = {
      isDragging: true,
      startMouseX: options.mouseX,
      startMouseY: options.mouseY,
      startPosX: posX,
      startPosY: posY,
      intervalId: null,
      lastCursorX: options.mouseX,
      lastCursorY: options.mouseY,
      idleCount: 0,
    };

    // 使用定时器持续更新位置（比渲染进程发 IPC 更稳定）
    state.intervalId = setInterval(() => {
      if (!state.isDragging || win.isDestroyed()) {
        if (state.intervalId) {
          clearInterval(state.intervalId);
          state.intervalId = null;
        }
        return;
      }

      // 获取当前鼠标位置（全局）
      const cursor = screen.getCursorScreenPoint();

      // 检测鼠标是否静止（可能已释放按钮）
      if (Math.abs(cursor.x - state.lastCursorX) <= 1 && Math.abs(cursor.y - state.lastCursorY) <= 1) {
        state.idleCount++;
        if (state.idleCount > DRAG_IDLE_THRESHOLD) {
          // 鼠标长时间静止，自动停止拖拽
          console.log(`[Main] Drag auto-stopped: mouse idle for ${state.idleCount} frames`);
          stopDragForWindow(win.id);
          return;
        }
      } else {
        state.idleCount = 0;
        state.lastCursorX = cursor.x;
        state.lastCursorY = cursor.y;
      }

      // 计算新位置
      const dx = cursor.x - state.startMouseX;
      const dy = cursor.y - state.startMouseY;
      let newX = state.startPosX + dx;
      let newY = state.startPosY + dy;

      // 获取显示器工作区
      const display = screen.getDisplayMatching(win.getBounds());
      const {
        x: workX,
        y: workY,
        width: workW,
        height: workH,
      } = display.workArea;
      const [winW, winH] = win.getSize();

      // 严格限制在工作区内
      newX = Math.max(workX, newX);
      newX = Math.min(newX, workX + workW - winW);
      newY = Math.max(workY, newY);
      newY = Math.min(newY, workY + workH - winH);

      // 只在位置变化时更新，避免闪烁
      const [currentX, currentY] = win.getPosition();
      if (Math.abs(currentX - newX) > 1 || Math.abs(currentY - newY) > 1) {
        win.setPosition(Math.round(newX), Math.round(newY));
      }
    }, 16); // ~60fps

    dragStateMap.set(win.id, state);
  },
);

// 停止指定窗口的拖拽
function stopDragForWindow(windowId: number) {
  const state = dragStateMap.get(windowId);
  if (!state) return;

  console.log(`[Main] Stopping drag for window ${windowId}`);

  state.isDragging = false;
  if (state.intervalId) {
    clearInterval(state.intervalId);
    state.intervalId = null;
  }
  dragStateMap.delete(windowId);

  // 基于窗口当前位置重新检测边缘吸附
  const win = BrowserWindow.fromId(windowId);
  if (win && !win.isDestroyed()) {
    const dockState = checkEdgeDocking(win);
    if (dockState) {
      // 吸附：创建/定位 strip，float 滑入边缘后完全隐藏
      if (!floatStripWindow || floatStripWindow.isDestroyed()) {
        createFloatStripWindow();
      }
      positionStripWindow(dockState.edge, dockState.dockY);
      animateWindowPosition(win, dockState.dockX, dockState.dockY, 200, (p) =>
        1 - Math.pow(1 - p, 3),
      ).then(() => {
        if (win && !win.isDestroyed()) {
          win.hide();
          // 稍停顿让 floatWindow 消失后再蹦出 strip（吸入-弹出视觉节奏）
          setTimeout(() => {
            edgeDockState.set(windowId, dockState);
            startHoverPolling();
            win?.webContents.send("edge-dock-changed", {
              isDocked: true,
              edge: dockState.edge,
            });
            floatStripWindow?.webContents.send("edge-dock-changed", {
              isDocked: true,
              edge: dockState.edge,
            });
          }, 150);
        }
      });
    } else {
      // 离开边缘 → 清除吸附状态，销毁 strip 窗口
      if (edgeDockState.has(windowId)) {
        edgeDockState.delete(windowId);
        if (!win.isVisible()) win.show();
        win.webContents.send("edge-dock-changed", {
          isDocked: false,
          edge: null,
        });
        if (floatStripWindow && !floatStripWindow.isDestroyed()) {
          floatStripWindow.close();
          floatStripWindow = null;
        }
      }
      // 非贴边状态，保存悬浮窗位置
      saveFloatPosition();
    }
  }
}

ipcMain.handle("stop-window-drag", async (event) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (!win || win.isDestroyed()) return;

  console.log(`[Main] stop-window-drag received for window ${win.id}`);

  // 使用统一的清理函数
  stopDragForWindow(win.id);
});

/**
 * 窗口位置动画函数
 * 使用自定义缓动（默认 springOvershoot）实现 Q弹效果
 */
async function animateWindowPosition(
  win: BrowserWindow,
  targetX: number,
  targetY: number,
  duration: number = 400,
  easing: (p: number) => number = springOvershoot,
): Promise<void> {
  return new Promise((resolve) => {
    const [startX, startY] = win.getPosition();
    const startTime = Date.now();

    const animate = () => {
      if (win.isDestroyed()) {
        resolve();
        return;
      }

      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const t = easing(progress);

      const x = Math.round(startX + (targetX - startX) * t);
      const y = Math.round(startY + (targetY - startY) * t);

      win.setPosition(x, y);

      if (progress < 1) {
        setTimeout(animate, 16); // ~60fps
      } else {
        resolve();
      }
    };

    animate();
  });
}

/**
 * 检测窗口是否应该靠边隐藏
 * 返回 EdgeDockState 如果应该靠边，否则返回 null
 */
function checkEdgeDocking(win: BrowserWindow): EdgeDockState | null {
  const [x, y] = win.getPosition();
  const [w, h] = win.getSize();
  const display = screen.getDisplayMatching(win.getBounds());
  const { x: workX, y: workY, width: workW, height: workH } = display.workArea;

  // 检查左侧
  if (x <= workX + EDGE_THRESHOLD) {
    return {
      isDocked: true,
      edge: "left",
      dockX: workX - w + DOCK_VISIBLE_WIDTH,
      dockY: y,
      originalX: workX,
      originalY: y,
    };
  }
  // 检查右侧
  if (x + w >= workX + workW - EDGE_THRESHOLD) {
    return {
      isDocked: true,
      edge: "right",
      dockX: workX + workW - DOCK_VISIBLE_WIDTH,
      dockY: y,
      originalX: workX + workW - w,
      originalY: y,
    };
  }
  // 检查顶部
  if (y <= workY + EDGE_THRESHOLD) {
    return {
      isDocked: true,
      edge: "top",
      dockX: x,
      dockY: workY - h + DOCK_VISIBLE_WIDTH,
      originalX: x,
      originalY: workY,
    };
  }

  return null;
}

// 鼠标轮询状态和函数
let hoverPollTimer: ReturnType<typeof setInterval> | null = null;
const EDGE_REVEAL_ZONE = 5; // 鼠标距离边缘 5px 内触发弹出
const EDGE_HIDE_ZONE = 50; // 鼠标距离窗口 50px 外触发收起
const HOVER_REVEAL_DELAY = 300; // 鼠标在检测区停留 300ms 才触发弹出（防划过误触）
let revealAnimating = false;
let hideAnimating = false;
let hoverEnterTime = 0; // 鼠标进入 strip 区域的时间戳

/**
 * 弹出贴边窗口
 * ① strip CSS 吸入动画（200ms）
 * ② floatWindow 弹簧弹出（400ms）
 */
function revealFloatWindow() {
  if (!floatWindow || floatWindow.isDestroyed()) return;
  const state = edgeDockState.get(floatWindow.id);
  if (!state || !state.isDocked) return;
  if (revealAnimating) return;
  revealAnimating = true;

  // 1. strip 吸入动画（CSS），同时屏蔽鼠标事件防止动画期间误触
  if (floatStripWindow && !floatStripWindow.isDestroyed()) {
    floatStripWindow.setIgnoreMouseEvents(true, { forward: true });
    floatStripWindow.webContents.send("edge-dock-changed", {
      isDocked: false,
      edge: state.edge,
    });
  }

  // 2. 等待 strip 吸入动画完成（220ms CSS + 130ms 视觉停顿）
  setTimeout(() => {
    // OS 级隐藏 strip
    if (floatStripWindow && !floatStripWindow.isDestroyed()) {
      floatStripWindow.hide();
      floatStripWindow.setIgnoreMouseEvents(false);
    }

    // 3. 立即更新状态让 floatWindow 内容可见
    edgeDockState.set(floatWindow!.id, { ...state, isDocked: false });
    floatWindow!.webContents.send("edge-dock-changed", {
      isDocked: false,
      edge: state.edge,
    });

    // 4. 显示并弹簧弹出
    floatWindow!.setPosition(state.dockX, state.dockY);
    floatWindow!.show();
    floatWindow!.moveTop();

    animateWindowPosition(
      floatWindow!,
      state.originalX,
      state.originalY,
      400,
      springOvershoot,
    ).then(() => {
      revealAnimating = false;
    });
  }, 350);
}

/**
 * 收起贴边窗口
 * ① floatWindow 弹簧收回（内容全程可见）
 * ② 到位后隐藏 floatWindow → 显示 strip
 */
function hideFloatWindow() {
  if (!floatWindow || floatWindow.isDestroyed()) return;
  const state = edgeDockState.get(floatWindow.id);
  if (!state || state.isDocked) return;
  if (hideAnimating) return;
  hideAnimating = true;

  // 1. 平滑收回（ease-out cubic，无弹跳，与 strip 切入不冲突）
  animateWindowPosition(
    floatWindow,
    state.dockX,
    state.dockY,
    300,
    (p) => 1 - Math.pow(1 - p, 3),
  ).then(() => {
    if (floatWindow && !floatWindow.isDestroyed()) {
      floatWindow.hide();
      // 立即切入 strip
      if (floatStripWindow && !floatStripWindow.isDestroyed()) {
        positionStripWindow(state.edge, state.dockY);
        floatStripWindow.webContents.send("edge-dock-changed", {
          isDocked: true,
          edge: state.edge,
        });
      }
      if (floatWindow && !floatWindow.isDestroyed()) {
        edgeDockState.set(floatWindow.id, { ...state, isDocked: true });
        floatWindow.webContents.send("edge-dock-changed", {
          isDocked: true,
          edge: state.edge,
        });
      }
    }
    hideAnimating = false;
  });
}

/**
 * 启动鼠标轮询检测（贴边后调用）
 * 贴边时用 strip 窗口边界检测鼠标靠近
 */
function startHoverPolling() {
  if (hoverPollTimer) return;

  hoverPollTimer = setInterval(() => {
    if (!floatWindow || floatWindow.isDestroyed()) {
      stopHoverPolling();
      return;
    }

    const state = edgeDockState.get(floatWindow.id);
    if (!state) return;

    const cursor = screen.getCursorScreenPoint();

    // 贴边时用 strip 窗口的边界检测
    const bounds = floatStripWindow?.isDestroyed()
      ? null
      : floatStripWindow?.getBounds();
    const hasStrip = bounds && floatStripWindow?.isVisible();

    if (state.isDocked) {
      // 检测是否应该弹出
      let shouldReveal = false;
      if (hasStrip) {
        switch (state.edge) {
          case "left":
            shouldReveal =
              cursor.x <= bounds!.x + bounds!.width + EDGE_REVEAL_ZONE &&
              cursor.y >= bounds!.y &&
              cursor.y <= bounds!.y + bounds!.height;
            break;
          case "right":
            shouldReveal =
              cursor.x >= bounds!.x - EDGE_REVEAL_ZONE &&
              cursor.y >= bounds!.y &&
              cursor.y <= bounds!.y + bounds!.height;
            break;
          case "top":
            shouldReveal =
              cursor.y <= bounds!.y + bounds!.height + EDGE_REVEAL_ZONE &&
              cursor.x >= bounds!.x &&
              cursor.x <= bounds!.x + bounds!.width;
            break;
        }
      }
      if (shouldReveal) {
        // 悬停延时：鼠标必须在检测区内停留足够时间才触发（防划过）
        if (hoverEnterTime === 0) {
          hoverEnterTime = Date.now();
        } else if (Date.now() - hoverEnterTime >= HOVER_REVEAL_DELAY) {
          hoverEnterTime = 0;
          revealFloatWindow();
        }
      } else {
        hoverEnterTime = 0;
      }
    } else {
      // 检测是否应该收起
      const { x: winX, y: winY, width: winW, height: winH } =
        floatWindow.getBounds();
      let shouldHide = false;
      switch (state.edge) {
        case "left":
          shouldHide = cursor.x > winX + winW + EDGE_HIDE_ZONE;
          break;
        case "right":
          shouldHide = cursor.x < winX - EDGE_HIDE_ZONE;
          break;
        case "top":
          shouldHide = cursor.y > winY + winH + EDGE_HIDE_ZONE;
          break;
      }
      const isMouseOutsideWindow =
        cursor.x < winX - EDGE_HIDE_ZONE ||
        cursor.x > winX + winW + EDGE_HIDE_ZONE ||
        cursor.y < winY - EDGE_HIDE_ZONE ||
        cursor.y > winY + winH + EDGE_HIDE_ZONE;

      if (shouldHide || isMouseOutsideWindow) {
        hideFloatWindow();
      }
    }
  }, 200);
}

/**
 * 停止鼠标轮询检测
 */
function stopHoverPolling() {
  if (hoverPollTimer) {
    clearInterval(hoverPollTimer);
    hoverPollTimer = null;
  }
}

ipcMain.handle("set-float-window-position", (_, x: number, y: number) => {
  if (!floatWindow || floatWindow.isDestroyed()) return false;
  floatWindow.setPosition(Math.round(x), Math.round(y));
  return true;
});

// 靠边隐藏相关 IPC handlers
ipcMain.handle(
  "dock-float-window",
  async (_, edge: "left" | "right" | "top") => {
    if (!floatWindow || floatWindow.isDestroyed()) return false;

    const [x, y] = floatWindow.getPosition();
    const [w, h] = floatWindow.getSize();
    const display = screen.getDisplayMatching(floatWindow.getBounds());
    const {
      x: workX,
      y: workY,
      width: workW,
      height: workH,
    } = display.workArea;

    let dockX = x;
    let dockY = y;

    // 根据边缘计算靠边位置
    switch (edge) {
      case "left":
        dockX = workX - w + DOCK_VISIBLE_WIDTH;
        break;
      case "right":
        dockX = workX + workW - DOCK_VISIBLE_WIDTH;
        break;
      case "top":
        dockY = workY - h + DOCK_VISIBLE_WIDTH;
        break;
    }

    const dockState: EdgeDockState = {
      isDocked: true,
      edge,
      dockX,
      dockY,
      originalX: x,
      originalY: y,
    };

    if (!floatStripWindow || floatStripWindow.isDestroyed()) {
      createFloatStripWindow();
    }
    positionStripWindow(edge, dockY);
    await animateWindowPosition(floatWindow, dockX, dockY, 200, (p) =>
      1 - Math.pow(1 - p, 3),
    );
    edgeDockState.set(floatWindow.id, dockState);
    floatWindow.hide();
    startHoverPolling();
    floatWindow.webContents.send("edge-dock-changed", {
      isDocked: true,
      edge,
    });
    floatStripWindow?.webContents.send("edge-dock-changed", {
      isDocked: true,
      edge,
    });

    return true;
  },
);

ipcMain.handle("undock-float-window", async () => {
  if (!floatWindow || floatWindow.isDestroyed()) return false;

  const state = edgeDockState.get(floatWindow.id);
  if (!state?.isDocked) return false;

  floatWindow.show();
  await animateWindowPosition(
    floatWindow,
    state.originalX,
    state.originalY,
    200,
    (p) => 1 - Math.pow(1 - p, 3),
  );
  edgeDockState.delete(floatWindow.id);
  stopHoverPolling();
  if (floatStripWindow && !floatStripWindow.isDestroyed()) {
    floatStripWindow.close();
    floatStripWindow = null;
  }
  floatWindow.webContents.send("edge-dock-changed", {
    isDocked: false,
    edge: null,
  });

  return true;
});

ipcMain.handle("get-edge-dock-state", () => {
  if (!floatWindow || floatWindow.isDestroyed()) return null;
  return edgeDockState.get(floatWindow.id) || null;
});

// 点击贴边条时触发弹出
ipcMain.handle("strip-mousedown", () => {
  if (!floatWindow || floatWindow.isDestroyed()) return;
  const state = edgeDockState.get(floatWindow.id);
  if (state?.isDocked) {
    revealFloatWindow();
  }
});

ipcMain.handle(
  "resize-float-window-animated",
  (_, width: number, height: number, duration: number = 300) => {
    if (!floatWindow || floatWindow.isDestroyed()) return false;
    const [startW, startH] = floatWindow.getSize();
    const targetW = Math.round(width);
    const targetH = Math.round(height);
    if (Math.abs(startW - targetW) <= 2 && Math.abs(startH - targetH) <= 2)
      return false;

    const startTime = Date.now();
    const step = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const t = 1 - Math.pow(1 - progress, 3);
      const curH = Math.round(startH + (targetH - startH) * t);
      floatWindow!.setSize(
        Math.round(startW + (targetW - startW) * t),
        curH,
      );
      // 同步 strip 窗口高度
      if (floatStripWindow && !floatStripWindow.isDestroyed()) {
        floatStripWindow.setSize(DOCK_VISIBLE_WIDTH, curH);
      }
      if (progress < 1) {
        setTimeout(step, 16);
      }
    };
    step();
    return true;
  },
);

// 登录窗口管理
let loginInProgress = false;
let loginPromise: Promise<string | null> | null = null;

ipcMain.handle("open-mimo-login", async (_, modelId?: string) => {
  console.log(
    "[Login] open-mimo-login handler 被调用, loginInProgress:",
    loginInProgress,
    "modelId:", modelId,
  );

  // 如果已有登录在进行中，等待其完成
  if (loginInProgress && loginPromise) {
    console.log("[Login] 登录已在进行中，等待结果");
    return loginPromise;
  }

  loginInProgress = true;

  loginPromise = new Promise<string | null>((resolve) => {
    // 读取 config 获取 loginUrl
    let loginUrl = "https://platform.xiaomimimo.com/console/plan-manage";
    try {
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        const mimoModel = modelId
          ? config.models?.find((m: any) => m.id === modelId)
          : config.models?.find((m: any) => m.provider === "mimo");
        if (!mimoModel) {
          console.error("[Login] 未找到 MIMO 模型, modelId:", modelId);
          resolve(null);
          return;
        }
        if (mimoModel?.loginUrl) {
          loginUrl = mimoModel.loginUrl;
        }
        // 如果已有 cookie，先验证是否有效
        if (mimoModel?.cookies) {
          // 尝试用已有 cookie 做一次 API 请求验证
          const testHeaders: Record<string, string> = {
            Cookie: mimoModel.cookies,
          };
          if (mimoModel.apiKey) {
            testHeaders["Authorization"] = `Bearer ${mimoModel.apiKey}`;
          }
          const testRequest = net.request({
            method: "GET",
            url:
              mimoModel.baseUrl ||
              "https://platform.xiaomimimo.com/api/v1/tokenPlan/usage",
            headers: testHeaders,
          });

          let testData = "";
          testRequest.on("response", (response) => {
            response.on("data", (chunk) => {
              testData += chunk.toString();
            });
            response.on("end", () => {
              try {
                const data = JSON.parse(testData);
                // 如果返回 code === 0，说明 cookie 有效
                if (data.code === 0) {
                  console.log("[Login] 已有 cookie 有效，跳过登录");
                  resolve(mimoModel.cookies);
                  return;
                }
              } catch {
                /* 解析失败，继续登录流程 */
              }
              // cookie 无效，打开登录窗口
              doLogin(loginUrl, resolve, mimoModel.id);
            });
          });
          testRequest.on("error", () => {
            // 请求失败，打开登录窗口
            doLogin(loginUrl, resolve, mimoModel.id);
          });
          testRequest.end();
          return;
        }
      }
    } catch (error) {
      console.error("[Login] 读取配置失败:", error);
    }

    // 无 cookie，直接打开登录窗口
    // 重新读取以获取 modelId（上面的 try 可能没找到模型）
    let modelIdForLogin = modelId;
    if (!modelIdForLogin) {
      try {
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          const mimoModel = config.models?.find((m: any) => m.provider === "mimo");
          modelIdForLogin = mimoModel?.id;
        }
      } catch {}
    }
    doLogin(loginUrl, resolve, modelIdForLogin);
  });

  // 登录完成后重置状态
  loginPromise.finally(() => {
    loginInProgress = false;
    loginPromise = null;
  });

  return loginPromise;
});

async function doLogin(
  loginUrl: string,
  resolve: (value: string | null) => void,
  modelId?: string,
): Promise<void> {
  console.log("[Login] 打开登录窗口:", loginUrl);
  await loginManager.openLoginWindow(loginUrl, mainWindow || undefined);
  loginManager.onLoginComplete((cookies) => {
    console.log("[Login] 登录完成，cookies:", cookies ? "已获取" : "未获取");
    if (cookies) {
      // 打印 cookie 完整信息
      console.log("[Login] Cookie 完整值:", cookies);

      // 将 cookies 保存到 config（按 modelId 精确查找）
      try {
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          const mimoModel = modelId
            ? config.models?.find((m: any) => m.id === modelId)
            : config.models?.find((m: any) => m.provider === "mimo");
          if (mimoModel) {
            mimoModel.cookies = cookies;
            writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log("[Login] Cookies 已保存到 config, modelId:", mimoModel.id);
          }
        }
      } catch (error) {
        console.error("[Login] 保存 cookies 失败:", error);
      }
    } else {
      console.warn("[Login] 未获取到 cookies（超时或用户未登录）");
    }
    resolve(cookies);
  });
}

// 窗口控制
ipcMain.handle("window-minimize", () => {
  mainWindow?.minimize();
});

ipcMain.handle("window-maximize", () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle("window-close", () => {
  mainWindow?.close();
});

// 关闭行为 IPC
ipcMain.handle("get-close-action", () => {
  return getCloseActionFromConfig();
});

ipcMain.handle("set-close-action", (_, action: CloseAction | null) => {
  saveCloseActionToConfig(action);
  return true;
});

ipcMain.handle("close-action-chosen", (_, action: CloseAction, remember: boolean) => {
  if (remember) {
    saveCloseActionToConfig(action);
  }
  if (action === 'minimize-to-tray') {
    mainWindow?.hide();
  } else {
    // quit：保存窗口状态后直接退出
    if (mainWindow && !mainWindow.isDestroyed()) saveWindowState(mainWindow);
    isQuitting = true;
    app.quit();
  }
});

ipcMain.handle("show-main-window", () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.show();
    mainWindow.focus();
  }
  return true;
});

// 统一刷新相关
ipcMain.handle("get-cached-usage", () => {
  return refresher.getCachedData();
});

ipcMain.handle("refresh-all-models", async () => {
  await refresher.refreshAll();
  return true;
});

ipcMain.handle("refresh-model", async (_, modelId: string) => {
  await refresher.fetchModelById(modelId);
  return true;
});

// API调用 - 在主进程中处理，避免CORS问题
ipcMain.handle("fetch-mimo-usage", async (_, options) => {
  return new Promise((resolve, reject) => {
    const {
      url,
      apiKey,
      cookies,
      method = "GET",
      headers = {},
      body,
    } = options;

    if (!isAllowedUrl(url)) {
      reject(new Error("URL not allowed"));
      return;
    }

    const requestHeaders: Record<string, string> = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    };

    if (apiKey) {
      requestHeaders["Authorization"] = `Bearer ${apiKey}`;
    }

    // 合并自定义 headers
    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === "string") {
        requestHeaders[key] = value;
      }
    }

    // POST 请求默认加 Content-Type
    if (method === "POST" && !requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = "application/json";
    }

    if (cookies) {
      requestHeaders["Cookie"] = cookies;
      if (isDev) console.log("[API] 使用 cookies:", cookies);
    } else {
      if (isDev) console.log("[API] 未提供 cookies");
    }

    if (isDev) {
      console.log("主进程发起", method, "请求到:", url);
      console.log("[API] apiKey 长度:", apiKey?.length || 0);
      console.log(
        "[API] Authorization:",
        requestHeaders["Authorization"]?.substring(0, 30) + "...",
      );
      console.log(
        "[API] 所有 headers:",
        Object.keys(requestHeaders).join(", "),
      );
    }

    const request = net.request({
      method: method,
      url: url,
      headers: requestHeaders,
    });

    let responseData = "";

    request.on("response", (response) => {
      if (isDev) console.log("收到响应状态码:", response.statusCode);

      response.on("data", (chunk) => {
        responseData += chunk.toString();
      });

      response.on("end", () => {
        try {
          const data = JSON.parse(responseData);

          // 检测是否需要重新登录（仅对 MiMo API 生效）
          const isMimoUrl = url.includes("platform.xiaomimimo.com");
          if (isMimoUrl) {
            // 情况1: HTTP 401/403 状态码
            if (response.statusCode === 401 || response.statusCode === 403) {
              console.warn(
                "[API] MiMo 返回 401/403，触发登录，状态码:",
                response.statusCode,
              );
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("login-needed");
              }
              const error = new Error("Cookie expired or unauthorized");
              (error as any).code = "COOKIE_EXPIRED";
              (error as any).statusCode = response.statusCode;
              reject(error);
              return;
            }

            // 情况2: 响应中包含 loginUrl 字段（MiMo 特有的登录重定向）
            if (data.loginUrl) {
              console.warn("[API] MiMo 返回 loginUrl，触发登录");
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("login-needed");
              }
              const error = new Error("Cookie expired or unauthorized");
              (error as any).code = "COOKIE_EXPIRED";
              reject(error);
              return;
            }

            // 情况3: code 不为 0 且响应包含错误关键词
            if (data.code !== 0) {
              const bodyStr = JSON.stringify(data);
              const errorKeywords = [
                "unauthorized",
                "expired",
                "invalid token",
                "authentication",
              ];
              const isCookieError = errorKeywords.some((keyword) =>
                bodyStr.toLowerCase().includes(keyword),
              );

              if (isCookieError) {
                console.warn("[API] MiMo 检测到 Cookie 相关错误关键词");
                if (mainWindow && !mainWindow.isDestroyed()) {
                  mainWindow.webContents.send("login-needed");
                }
                const error = new Error("Cookie expired or unauthorized");
                (error as any).code = "COOKIE_EXPIRED";
                reject(error);
                return;
              }
            }
          }

          resolve(data);
        } catch (error) {
          reject(new Error("JSON解析失败"));
        }
      });
    });

    request.on("error", (error) => {
      console.error("请求错误:", error);
      reject(error);
    });

    // 发送 body（仅 POST/PUT/PATCH）
    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
      request.write(bodyStr);
    }

    request.end();
  });
});

// Open Code 登录窗口管理
let openCodeLoginInProgress = false;
let openCodeLoginPromise: Promise<{
  cookies: string | null;
  baseUrl: string | null;
}> | null = null;

ipcMain.handle("open-opencode-login", async (_, modelId?: string) => {
  console.log(
    "[OpenCodeLogin] open-opencode-login handler 被调用, loginInProgress:",
    openCodeLoginInProgress,
    "modelId:", modelId,
  );

  // 如果已有登录在进行中，等待其完成
  if (openCodeLoginInProgress && openCodeLoginPromise) {
    console.log("[OpenCodeLogin] 登录已在进行中，等待结果");
    return openCodeLoginPromise;
  }

  openCodeLoginInProgress = true;

  openCodeLoginPromise = new Promise<{
    cookies: string | null;
    baseUrl: string | null;
  }>((resolvePromise) => {
    // Open Code 的登录页面（包含登录按钮）
    const loginUrl = "https://opencode.ai/zh/go";

    // 如果已有 cookie，先验证是否有效
    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      const opencodeModel = modelId
        ? config.models?.find((m: any) => m.id === modelId)
        : config.models?.find((m: any) => m.provider === "opencode");
      if (!opencodeModel) {
        console.error("[OpenCodeLogin] 未找到 OpenCode 模型, modelId:", modelId);
        resolvePromise({ cookies: null, baseUrl: null });
        return;
      }
      if (opencodeModel?.cookies && opencodeModel?.baseUrl) {
        // 尝试用已有 cookie 做一次 API 请求验证
        const testHeaders: Record<string, string> = {
          Cookie: opencodeModel.cookies,
          Accept: "*/*",
          "x-server-id":
            "c7389bd0e731f80f49593e5ee53835475f4e28594dd6bd83eb229bab753498cd",
          "x-server-instance": "server-fn:1",
        };

        const testRequest = net.request({
          method: "GET",
          url: opencodeModel.baseUrl,
          headers: testHeaders,
        });

        let testData = "";
        testRequest.on("response", (response) => {
          response.on("data", (chunk) => {
            testData += chunk.toString();
          });
          response.on("end", () => {
            // 如果返回的是 JavaScript（包含 usagePercent），说明 cookie 有效
            if (testData.includes("usagePercent")) {
              console.log("[OpenCodeLogin] 已有 cookie 有效，跳过登录");
              resolvePromise({
                cookies: opencodeModel.cookies,
                baseUrl: opencodeModel.baseUrl,
              });
              return;
            }
            // cookie 无效，打开登录窗口
            doOpenCodeLogin(loginUrl, resolvePromise, opencodeModel.id);
          });
        });
        testRequest.on("error", () => {
          // 请求失败，打开登录窗口
          doOpenCodeLogin(loginUrl, resolvePromise, opencodeModel.id);
        });
        testRequest.end();
        return;
      }
    }

    // 无 cookie，直接打开登录窗口
    let modelIdForLogin = modelId;
    if (!modelIdForLogin) {
      try {
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          const opencodeModel = config.models?.find((m: any) => m.provider === "opencode");
          modelIdForLogin = opencodeModel?.id;
        }
      } catch {}
    }
    doOpenCodeLogin(loginUrl, resolvePromise, modelIdForLogin);
  });

  // 登录完成后重置状态
  openCodeLoginPromise.finally(() => {
    openCodeLoginInProgress = false;
    openCodeLoginPromise = null;
  });

  return openCodeLoginPromise;
});

async function doOpenCodeLogin(
  loginUrl: string,
  resolvePromise: (value: {
    cookies: string | null;
    baseUrl: string | null;
  }) => void,
  modelId?: string,
): Promise<void> {
  console.log("[OpenCodeLogin] 打开登录窗口:", loginUrl);
  await openCodeLoginManager.openLoginWindow(loginUrl, mainWindow || undefined);
  openCodeLoginManager.onLoginComplete((data) => {
    console.log(
      "[OpenCodeLogin] 登录完成回调，data:",
      data ? "已获取" : "null",
    );

    if (data) {
      console.log("[OpenCodeLogin] Cookie 长度:", data.cookies.length);
      console.log(
        "[OpenCodeLogin] API URL:",
        data.apiUrl ? "已捕获" : "未捕获",
      );

      const baseUrl = data.apiUrl;

      // 保存到 config（按 modelId 精确查找）
      try {
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          const opencodeModel = modelId
            ? config.models?.find((m: any) => m.id === modelId)
            : config.models?.find((m: any) => m.provider === "opencode");
          if (opencodeModel) {
            opencodeModel.cookies = data.cookies;
            if (baseUrl) {
              opencodeModel.baseUrl = baseUrl;
            }
            writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log("[OpenCodeLogin] 已保存到 config, modelId:", opencodeModel.id);
          }
        }
      } catch (error) {
        console.error("[OpenCodeLogin] 保存配置失败:", error);
      }

      resolvePromise({ cookies: data.cookies, baseUrl });
    } else {
      console.warn("[OpenCodeLogin] 登录失败或已取消");
      resolvePromise({ cookies: null, baseUrl: null });
    }
  });
}
