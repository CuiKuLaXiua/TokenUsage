import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  screen,
  Tray,
  Menu,
  nativeImage,
} from "electron";
import { join } from "path";

const isDev = !app.isPackaged;
const rendererUrl =
  process.env.ELECTRON_RENDERER_URL || "http://localhost:3000";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { config as loadDotenv } from "dotenv";
import { isAllowedUrl } from "./ipc-validators";
import { LoginWindowManager } from "./login";
import { OpenCodeLoginWindowManager } from "./opencode-login";
import { UsageRefresher } from "./refresher";
import { windowManager } from "./windowManager";
import { parseOpenCodeDailyResponse, parseOpenCodeRecordsResponse } from "./api/parsers";
import {
  FLOAT_WIDTH,
  FLOAT_HEIGHT,
  DETAIL_WIDTH,
  DETAIL_HEIGHT,
  DETAIL_GAP,
  CTX_MENU_WIDTH,
  CTX_MENU_HEIGHT_NO_MODEL,
  CTX_MENU_HEIGHT_WITH_MODEL,
  computeDetailPosition,
  computeDetailY,
  computeCtxMenuPosition,
} from "./utils/position";
import {
  configPath,
  ensureDataDir,
  loadWindowState,
  saveWindowState,
  loadFloatPosition,
  saveFloatPosition,
  getCloseActionFromConfig,
  saveCloseActionToConfig,
} from "./services/persistence";
import type { CloseAction } from "./services/persistence";
import { themeService } from "./services/theme";
import { EdgeDockManager, DOCK_VISIBLE_WIDTH } from "./features/edge-dock";
import { CtxMenuManager } from "./features/ctx-menu";

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
let detailAnchorInfo: {
  x: number;
  anchorTop: number;
  anchorBottom: number;
} | null = null;
let floatWindowReady = false;
let floatWindowReadyResolve: (() => void) | null = null;
let ctxMenuWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const loginManager = new LoginWindowManager();
const openCodeLoginManager = new OpenCodeLoginWindowManager();

const refresher = new UsageRefresher(configPath);

function getFloatWindow(): BrowserWindow | undefined {
  return floatWindow && !floatWindow.isDestroyed() ? floatWindow : undefined;
}

function getDetailWindow(): BrowserWindow | undefined {
  return detailWindow && !detailWindow.isDestroyed() ? detailWindow : undefined;
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

// 统一的悬浮窗状态检查函数（考虑边缘吸附状态）
function isFloatWindowActive(): boolean {
  const floatWindow = getFloatWindow();
  if (!floatWindow || floatWindow.isDestroyed()) {
    return false;
  }
  // 预创建但从未显示的窗口不算 active
  if (!floatWindow.isVisible()) {
    const id = floatWindow.id;
    if (!edgeDock.edgeDockState.has(id)) {
      return false;
    }
  }
  return true;
}

// ── 系统托盘 ──
function buildTrayMenu(): Menu {
  // 检查悬浮窗状态（使用统一的检查函数）
  const isFloatActive = isFloatWindowActive();

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
      label: isFloatActive ? "隐藏悬浮窗" : "显示悬浮窗",
      click: async () => {
        if (isFloatWindowActive()) {
          // 关闭悬浮窗
          const detailWindow = getDetailWindow();
          if (detailWindow) {
            detailWindow.close();
          }
          ctxMenu.destroy();
          edgeDock.stopHoverPolling();
          const floatWindow = getFloatWindow();
          edgeDock.edgeDockState.delete(floatWindow?.id || -1);
          if (floatStripWindow && !floatStripWindow.isDestroyed()) {
            floatStripWindow.close();
          }
          if (floatWindow) {
            floatWindow.close();
          }
          // 通知主窗口悬浮窗已关闭
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("float-window-closed");
          }
        } else {
          // 打开悬浮窗
          const floatWindow = getFloatWindow();
          if (!floatWindow) {
            createFloatWindow();
            if (!floatWindowReady) {
              await new Promise<void>((resolve) => {
                floatWindowReadyResolve = resolve;
              });
            }
            const win = getFloatWindow();
            if (win) {
              win.show();
              win.focus();
            }
          } else {
            // 边缘吸附状态的窗口需要恢复
            const state = edgeDock.edgeDockState.get(floatWindow.id);
            if (state?.isDocked) {
              edgeDock.revealFloatWindow();
            } else {
              floatWindow.show();
              floatWindow.focus();
            }
          }
          // 通知主窗口悬浮窗已打开
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("float-window-opened");
          }
        }
        // 更新托盘菜单
        tray?.setContextMenu(buildTrayMenu());
      },
    },
    { type: "separator" },
    {
      label: themeService.mode === "dark" ? "切换浅色模式" : "切换深色模式",
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
    const fallbackPath = join(
      process.resourcesPath,
      "app.asar.unpacked",
      "public",
      "logo_tray.png",
    );
    icon = nativeImage.createFromPath(fallbackPath);
  }
  // 托盘图标缩放到 32x32（Windows 托盘推荐尺寸）
  icon = icon.resize({ width: 32, height: 32 });

  tray = new Tray(icon);
  tray.setToolTip("Token Usage");
  tray.setContextMenu(buildTrayMenu());

  tray.on("double-click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      // 先重置可能残留的关闭对话框状态
      mainWindow.webContents.send("reset-close-dialog");
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
  const defaultOpts = {
    width: 1200,
    height: 800,
    minWidth: 1000,
    minHeight: 700,
  };

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
    if (closeAction === "minimize-to-tray") {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }
    if (closeAction === "quit") {
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
    show: false,
    backgroundColor: "#00000000", // 透明背景，避免窗口显示前的黑屏闪烁
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: getIconPath(),
  });

  // 注册到窗口管理器，确保关闭时正确清理
  windowManager.register("float", floatWindow);
  themeService.register(floatWindow);

  // 重置 ready 状态，等待渲染进程 IPC 通知
  floatWindowReady = false;
  floatWindowReadyResolve = null;

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
    if (!edgeDock.edgeDockState.get(floatWindow?.id || -1)?.isDocked) {
      saveFloatPosition(floatWindow!);
    }

    // 清理拖拽状态和定时器
    const dragState = edgeDock.dragStateMap.get(floatWindow?.id || -1);
    if (dragState?.intervalId) {
      clearInterval(dragState.intervalId);
    }
    edgeDock.dragStateMap.delete(floatWindow?.id || -1);

    // 主窗口关闭时同步关闭详情窗口和贴边条
    if (detailWindow && !detailWindow.isDestroyed()) {
      detailWindow.close();
    }
    if (floatStripWindow && !floatStripWindow.isDestroyed()) {
      floatStripWindow.close();
    }
    ctxMenu.destroy();
    edgeDock.stopHoverPolling();
    edgeDock.edgeDockState.delete(floatWindow?.id || -1);
    floatWindow = null;
    // 通知主窗口悬浮窗已关闭
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("float-window-closed");
    }
    // 更新托盘菜单状态
    tray?.setContextMenu(buildTrayMenu());
  });

  // 兜底：如果渲染进程 ready 信号延迟，1.5s 后强制标记就绪
  floatWindow.webContents.on("did-finish-load", () => {
    setTimeout(() => {
      if (!floatWindowReady) {
        floatWindowReady = true;
        if (floatWindowReadyResolve) {
          floatWindowReadyResolve();
          floatWindowReadyResolve = null;
        }
      }
    }, 1500);
  });

  // 预创建详情窗口和右键菜单，避免首次触发时的加载延迟
  createDetailWindow();
  ensureCtxMenuWindow();
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
    backgroundColor: "#00000000", // 透明背景，避免窗口显示前的黑屏闪烁
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
    icon: getIconPath(),
  });

  // 注册到窗口管理器和主题目标
  windowManager.register("detail", detailWindow, () => {
    detailWindow = null;
  });
  themeService.register(detailWindow);

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

  // 注册到窗口管理器和主题目标
  windowManager.register("ctxMenu", ctxMenuWindow, () => {
    ctxMenuWindow = null;
  });
  themeService.register(ctxMenuWindow);

  if (isDev) {
    ctxMenuWindow.loadURL(rendererUrl + "/#/ctx-menu");
  } else {
    ctxMenuWindow.loadFile(join(__dirname, "../dist/index.html"), {
      hash: "/ctx-menu",
    });
  }

  // 点击外部关闭 — 使用 generation 计数器防止旧 blur 回调干扰新 show
  let blurTimer: ReturnType<typeof setTimeout> | null = null;
  const genAtBind = ctxMenu.generation; // 捕获绑定时的 generation

  ctxMenuWindow.on("blur", () => {
    if (ctxMenu.isClosing) return; // hideCtxMenu 触发的 blur，忽略
    if (blurTimer) clearTimeout(blurTimer);
    blurTimer = setTimeout(() => {
      blurTimer = null;
      // generation 不匹配 → 菜单已被新的 show 操作接管，不关闭
      if (ctxMenu.isClosing || ctxMenu.generation !== genAtBind) return;
      ctxMenu.hide();
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

function ensureFloatWindow() {
  if (floatWindow && !floatWindow.isDestroyed()) {
    return floatWindow;
  }
  createFloatWindow();
  return floatWindow;
}

const edgeDock = new EdgeDockManager({
  getFloatWindow: () => getFloatWindow() ?? null,
  getFloatStripWindow: () => floatStripWindow,
  setFloatStripWindow: (w) => { floatStripWindow = w; },
  createFloatStripWindow: () => createFloatStripWindow(),
  saveFloatPosition: (win) => saveFloatPosition(win),
});
edgeDock.registerIpc();

const ctxMenu = new CtxMenuManager({
  ensureCtxMenuWindow: () => ensureCtxMenuWindow(),
  getFloatWindow: () => getFloatWindow() ?? null,
});
ctxMenu.registerIpc();

import { registerDataIpc } from "./ipc/data";
registerDataIpc({ getRefresher: () => refresher });

app.whenReady().then(() => {
  ensureDataDir();
  createTray();
  createWindow();
  ensureFloatWindow(); // 预创建悬浮窗，避免首次点击时等待加载
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

ipcMain.handle("open-float-window", async () => {
  if (!floatWindow) {
    createFloatWindow();
    // 等待渲染进程就绪再显示
    if (!floatWindowReady) {
      await new Promise<void>((resolve) => {
        floatWindowReadyResolve = resolve;
      });
    }
    const win = floatWindow as BrowserWindow | null;
    if (win && !win.isDestroyed()) {
      win.show();
      win.focus();
    }
  } else if (floatWindow.isVisible()) {
    floatWindow.close();
    // 更新托盘菜单状态
    tray?.setContextMenu(buildTrayMenu());
    return false;
  } else {
    // 边缘吸附等隐藏状态：视为已开启，再次点击则关闭
    if (edgeDock.edgeDockState.get(floatWindow.id)?.isDocked) {
      floatWindow.close();
      // 更新托盘菜单状态
      tray?.setContextMenu(buildTrayMenu());
      return false;
    }
    floatWindow.show();
    floatWindow.focus();
  }
  // 更新托盘菜单状态
  tray?.setContextMenu(buildTrayMenu());
  return true;
});

ipcMain.handle("get-float-window-state", () => {
  return { active: isFloatWindowActive() };
});

ipcMain.handle("close-float-window", () => {
  if (detailWindow && !detailWindow.isDestroyed()) {
    detailWindow.close();
    detailWindow = null;
  }
  ctxMenu.destroy();
  edgeDock.stopHoverPolling();
  edgeDock.edgeDockState.delete(floatWindow?.id || -1);
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
  // 更新托盘菜单状态
  tray?.setContextMenu(buildTrayMenu());
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

    const { x, anchorTop, anchorBottom } = computeDetailPosition(
      options.anchorX,
      options.anchorY,
      options.anchorW,
      options.anchorH,
    );
    detailAnchorInfo = { x, anchorTop, anchorBottom };

    // 初始 y 用最大高度估算，resize-detail-window 会用实际高度修正
    const initialY = computeDetailY(anchorTop, anchorBottom, DETAIL_HEIGHT);
    win.setBounds({
      x,
      y: initialY,
      width: DETAIL_WIDTH,
      height: DETAIL_HEIGHT,
    });

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

ipcMain.handle("detail-ready", () => {
  detailWindowReady = true;
  if (detailWindowReadyResolve) {
    detailWindowReadyResolve();
    detailWindowReadyResolve = null;
  }
  return true;
});

ipcMain.handle("float-ready", () => {
  floatWindowReady = true;
  if (floatWindowReadyResolve) {
    floatWindowReadyResolve();
    floatWindowReadyResolve = null;
  }
  return true;
});

ipcMain.handle("hide-float-detail", () => {
  if (detailWindow && !detailWindow.isDestroyed()) {
    detailWindow.hide();
  }
  detailAnchorInfo = null;
  return true;
});

ipcMain.handle("resize-detail-window", (_, width: number, height: number) => {
  if (detailWindow && !detailWindow.isDestroyed()) {
    const MIN_H = 120;
    const MAX_H = 620;
    const clamped = Math.round(Math.min(MAX_H, Math.max(MIN_H, height)));
    const w = Math.round(width);
    // 用实际高度重新计算 y，setBounds 原子操作避免中间帧跳动
    if (detailAnchorInfo) {
      const y = computeDetailY(
        detailAnchorInfo.anchorTop,
        detailAnchorInfo.anchorBottom,
        clamped,
      );
      detailWindow.setBounds({
        x: detailAnchorInfo.x,
        y,
        width: w,
        height: clamped,
      });
    } else {
      detailWindow.setSize(w, clamped);
    }
  }
  return true;
});

ipcMain.on("notify-detail-hover", (_event, state: "enter" | "leave") => {
  // 将详情窗口的 hover 状态广播给主悬浮窗（单向通知，无返回值）
  if (floatWindow && !floatWindow.isDestroyed()) {
    floatWindow.webContents.send("detail-hover-changed", state);
  }
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
  (_, theme: { mode: string; accent: string; preset: string }) => {
    // 更新缓存的模式并重建托盘菜单
    if (theme.mode === "dark" || theme.mode === "light") {
      if (tray && !tray.isDestroyed()) {
        tray.setContextMenu(buildTrayMenu());
      }
    }
    // 更新主题真相源并精确广播
    themeService.broadcast(theme);
    return true;
  },
);

// 主题拉取 — 各窗口启动时获取当前主题
ipcMain.handle("theme:get", () => {
  return themeService.get();
});

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

ipcMain.handle("set-float-window-position", (_, x: number, y: number) => {
  if (!floatWindow || floatWindow.isDestroyed()) return false;
  floatWindow.setPosition(Math.round(x), Math.round(y));
  return true;
});

// 登录窗口管理
let loginInProgress = false;
let loginPromise: Promise<string | null> | null = null;

ipcMain.handle("open-mimo-login", async (_, modelId?: string) => {
  console.log(
    "[Login] open-mimo-login handler 被调用, loginInProgress:",
    loginInProgress,
    "modelId:",
    modelId,
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
          const mimoModel = config.models?.find(
            (m: any) => m.provider === "mimo",
          );
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
            console.log(
              "[Login] Cookies 已保存到 config, modelId:",
              mimoModel.id,
            );
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

ipcMain.handle(
  "close-action-chosen",
  (_, action: CloseAction, remember: boolean) => {
    if (remember) {
      saveCloseActionToConfig(action);
      // 通知渲染进程配置已更新
      mainWindow?.webContents.send("close-action-updated", action);
    }
    if (action === "minimize-to-tray") {
      mainWindow?.hide();
    } else {
      // quit：保存窗口状态后直接退出
      if (mainWindow && !mainWindow.isDestroyed()) saveWindowState(mainWindow);
      isQuitting = true;
      app.quit();
    }
  },
);

ipcMain.handle("show-main-window", () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    // 先重置可能残留的关闭对话框状态
    mainWindow.webContents.send("reset-close-dialog");
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

ipcMain.handle("get-fetching-state", () => {
  return refresher.getFetchingState();
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

// MiMo 用量明细 API
ipcMain.handle(
  "fetch-mimo-token-plan",
  async (_, options: { year: number; month: number; cookies: string }) => {
    return new Promise((resolve, reject) => {
      const { year, month, cookies } = options;

      // 从 cookies 中提取 api-platform_ph 值作为查询参数
      const phMatch = cookies.match(/api-platform_ph="?([^";]+)/);
      const phValue = phMatch ? phMatch[1] : "";
      const baseUrl =
        "https://platform.xiaomimimo.com/api/v1/usage/token-plan/list";
      const url = phValue
        ? `${baseUrl}?api-platform_ph=${encodeURIComponent(phValue)}`
        : baseUrl;

      if (!isAllowedUrl(url)) {
        reject(new Error("URL not allowed"));
        return;
      }

      const requestHeaders: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        Referer: "https://platform.xiaomimimo.com/",
        Origin: "https://platform.xiaomimimo.com",
      };

      if (cookies) {
        requestHeaders["Cookie"] = cookies;
      }

      const request = net.request({
        method: "POST",
        url,
        headers: requestHeaders,
      });

      let responseData = "";

      request.on("response", (response) => {
        response.on("data", (chunk) => {
          responseData += chunk.toString();
        });

        response.on("end", () => {
          try {
            const data = JSON.parse(responseData);

            // MiMo Cookie 过期检测
            if (response.statusCode === 401 || response.statusCode === 403) {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("login-needed");
              }
              const error = new Error("Cookie expired");
              (error as any).code = "COOKIE_EXPIRED";
              reject(error);
              return;
            }
            if (data.loginUrl) {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("login-needed");
              }
              const error = new Error("Cookie expired");
              (error as any).code = "COOKIE_EXPIRED";
              reject(error);
              return;
            }

            resolve(data);
          } catch {
            reject(new Error("JSON解析失败"));
          }
        });
      });

      request.on("error", (error) => {
        reject(error);
      });

      request.write(JSON.stringify({ year, month }));
      request.end();
    });
  },
);

// MiMo 套餐详情 API (tokenPlan/detail)
ipcMain.handle(
  "fetch-mimo-token-plan-detail",
  async (_, options: { cookies: string }) => {
    return new Promise((resolve, reject) => {
      const { cookies } = options;
      const url = "https://platform.xiaomimimo.com/api/v1/tokenPlan/detail";

      if (!isAllowedUrl(url)) {
        reject(new Error("URL not allowed"));
        return;
      }

      const requestHeaders: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        Referer: "https://platform.xiaomimimo.com/",
        Origin: "https://platform.xiaomimimo.com",
      };

      if (cookies) {
        requestHeaders["Cookie"] = cookies;
      }

      const request = net.request({
        method: "GET",
        url,
        headers: requestHeaders,
      });

      let responseData = "";

      request.on("response", (response) => {
        response.on("data", (chunk) => {
          responseData += chunk.toString();
        });

        response.on("end", () => {
          try {
            const data = JSON.parse(responseData);

            // MiMo Cookie 过期检测
            if (response.statusCode === 401 || response.statusCode === 403) {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("login-needed");
              }
              const error = new Error("Cookie expired");
              (error as any).code = "COOKIE_EXPIRED";
              reject(error);
              return;
            }
            if (data.loginUrl) {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send("login-needed");
              }
              const error = new Error("Cookie expired");
              (error as any).code = "COOKIE_EXPIRED";
              reject(error);
              return;
            }

            resolve(data);
          } catch {
            reject(new Error("JSON解析失败"));
          }
        });
      });

      request.on("error", (error) => {
        reject(error);
      });

      request.end();
    });
  },
);

// OpenCode 用量明细 API — 直接 net.request() POST
ipcMain.handle(
  "fetch-opencode-usage-detail",
  async (
    _,
    options: {
      cookies: string;
      serverId: string;
      serverInstance: string;
      body: string;
    },
  ) => {
    const { cookies, serverId, serverInstance, body } = options;

    // 从 body 中提取 workspaceId 构建 Referer
    let workspaceId = "";
    try {
      const bodyObj = JSON.parse(body);
      workspaceId = bodyObj?.t?.a?.[0]?.s || "";
    } catch {}

    console.log("[OpenCode] 日明细请求(net.request):", {
      serverId: serverId,
      serverInstance,
      workspaceId,
      bodyLength: body?.length,
      body: body,
      cookieLength: cookies?.length,
    });

    const url = "https://opencode.ai/_server";
    if (!isAllowedUrl(url)) {
      throw new Error("URL not allowed");
    }

    return new Promise<any>((resolve, reject) => {
      const requestHeaders: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Origin: "https://opencode.ai",
        Referer: workspaceId
          ? `https://opencode.ai/workspace/${workspaceId}/usage`
          : "https://opencode.ai/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "X-Server-Id": serverId,
        "X-Server-Instance": serverInstance || "server-fn:2",
      };
      if (cookies) {
        requestHeaders["Cookie"] = cookies;
      }

      const request = net.request({
        method: "POST",
        url,
        headers: requestHeaders,
      });
      let responseData = "";

      request.on("response", (response) => {
        response.on("data", (chunk: Buffer) => {
          responseData += chunk.toString();
        });
        response.on("end", () => {
          console.log(
            "[OpenCode] 响应状态:",
            response.statusCode,
            "长度:",
            responseData.length,
          );
          // console.log("[OpenCode] 响应字符:", responseData);

          if (response.statusCode === 401 || response.statusCode === 403) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("login-needed");
            }
            reject(
              Object.assign(new Error("Cookie expired"), {
                code: "COOKIE_EXPIRED",
              }),
            );
            return;
          }

          const parsed = parseOpenCodeDailyResponse(responseData);
          console.log(
            "[OpenCode] 解析结果: usage",
            parsed.usage.length,
            "条, keys",
            parsed.keys.length,
            "条",
          );
          if (parsed.usage.length > 0) {
            console.log(
              "[OpenCode] 首条 usage:",
              JSON.stringify(parsed.usage[0]),
            );
          }
          console.log(
            "[OpenCode] API2 解析结果: usage=" +
              parsed.usage.length +
              "条, keys=" +
              parsed.keys.length +
              "条",
          );
          // console.log(
          //   "[OpenCode] API2 usage:",
          //   JSON.stringify(parsed.usage, null, 2),
          // );
          // console.log(
          //   "[OpenCode] API2 keys:",
          //   JSON.stringify(parsed.keys, null, 2),
          // );
          resolve(parsed);
        });
      });

      request.on("error", (error) => {
        reject(error);
      });
      request.write(body);
      request.end();
    });
  },
);

// OpenCode 逐条明细 API（API3）
ipcMain.handle(
  "fetch-opencode-usage-records",
  async (
    _,
    options: {
      cookies: string;
      serverId: string;
      serverInstance: string;
      body: string;
    },
  ) => {
    const { cookies, serverId, serverInstance, body } = options;

    let workspaceId = "";
    try {
      const bodyObj = JSON.parse(body);
      workspaceId = bodyObj?.t?.a?.[0]?.s || "";
    } catch {}

    console.log("[OpenCode] API3 明细请求:", {
      serverId: serverId?.substring(0, 16) + "...",
      serverInstance,
      workspaceId,
      bodyLength: body?.length,
    });

    const url = "https://opencode.ai/_server";
    if (!isAllowedUrl(url)) {
      throw new Error("URL not allowed");
    }

    return new Promise<any>((resolve, reject) => {
      const requestHeaders: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
        "Content-Type": "application/json",
        Accept: "*/*",
        "Accept-Encoding": "gzip, deflate, br",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        Origin: "https://opencode.ai",
        Referer: workspaceId
          ? `https://opencode.ai/workspace/${workspaceId}/usage`
          : "https://opencode.ai/",
        "Sec-Fetch-Dest": "empty",
        "Sec-Fetch-Mode": "cors",
        "Sec-Fetch-Site": "same-origin",
        "X-Server-Id": serverId,
        "X-Server-Instance": serverInstance || "server-fn:2",
      };
      if (cookies) {
        requestHeaders["Cookie"] = cookies;
      }

      const request = net.request({
        method: "POST",
        url,
        headers: requestHeaders,
      });
      let responseData = "";

      request.on("response", (response) => {
        response.on("data", (chunk: Buffer) => {
          responseData += chunk.toString();
        });
        response.on("end", () => {
          console.log(
            "[OpenCode] API3 响应状态:",
            response.statusCode,
            "长度:",
            responseData.length,
          );

          if (response.statusCode === 401 || response.statusCode === 403) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("login-needed");
            }
            reject(
              Object.assign(new Error("Cookie expired"), {
                code: "COOKIE_EXPIRED",
              }),
            );
            return;
          }

          const parsed = parseOpenCodeRecordsResponse(responseData);
          console.log("[OpenCode] API3 解析结果:", parsed.records.length, "条");
          // console.log("[OpenCode] API3 records:", JSON.stringify(parsed.records, null, 2));
          resolve(parsed);
        });
      });

      request.on("error", (error) => {
        reject(error);
      });
      request.write(body);
      request.end();
    });
  },
);

// Open Code 登录窗口管理
let openCodeLoginInProgress = false;
let openCodeLoginPromise: Promise<{
  cookies: string | null;
  baseUrl: string | null;
  api1ServerId: string | null;
  api1Instance: string | null;
  api2ServerId: string | null;
  api2Instance: string | null;
  api3ServerId: string | null;
  api3Instance: string | null;
}> | null = null;

ipcMain.handle("open-opencode-login", async (_, modelId?: string) => {
  console.log(
    "[OpenCodeLogin] open-opencode-login handler 被调用, loginInProgress:",
    openCodeLoginInProgress,
    "modelId:",
    modelId,
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
    api1ServerId: string | null;
    api1Instance: string | null;
    api2ServerId: string | null;
    api2Instance: string | null;
    api3ServerId: string | null;
    api3Instance: string | null;
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
        console.log(
          "[OpenCodeLogin] 未找到已有 OpenCode 模型, 直接打开登录窗口",
        );
        doOpenCodeLogin(loginUrl, resolvePromise, modelId);
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
                api1ServerId: opencodeModel.serverId || null,
                api1Instance: opencodeModel.serverInstance || null,
                api2ServerId: opencodeModel.dailyServerId || null,
                api2Instance: opencodeModel.dailyServerInstance || null,
                api3ServerId: opencodeModel.recordsServerId || null,
                api3Instance: opencodeModel.recordsServerInstance || null,
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
          const opencodeModel = config.models?.find(
            (m: any) => m.provider === "opencode",
          );
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
    api1ServerId: string | null;
    api1Instance: string | null;
    api2ServerId: string | null;
    api2Instance: string | null;
    api3ServerId: string | null;
    api3Instance: string | null;
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
            // API1 GET (基础数据 + 刷新器)
            if (data.api1ServerId) {
              opencodeModel.serverId = data.api1ServerId;
            }
            if (data.api1Instance) {
              opencodeModel.serverInstance = data.api1Instance;
            }
            // API2 POST (日用量详情)
            if (data.api2ServerId) {
              opencodeModel.dailyServerId = data.api2ServerId;
            }
            if (data.api2Instance) {
              opencodeModel.dailyServerInstance = data.api2Instance;
            }
            // API3 POST (调用记录)
            if (data.api3ServerId) {
              opencodeModel.recordsServerId = data.api3ServerId;
            }
            if (data.api3Instance) {
              opencodeModel.recordsServerInstance = data.api3Instance;
            }
            writeFileSync(configPath, JSON.stringify(config, null, 2));
            console.log(
              "[OpenCodeLogin] 已保存到 config, modelId:",
              opencodeModel.id,
            );
            console.log(
              "[OpenCodeLogin] API1 instance:",
              data.api1Instance,
              "API2 instance:",
              data.api2Instance,
              "API3 instance:",
              data.api3Instance,
            );
          }
        }
      } catch (error) {
        console.error("[OpenCodeLogin] 保存配置失败:", error);
      }

      resolvePromise({
        cookies: data.cookies,
        baseUrl,
        api1ServerId: data.api1ServerId,
        api1Instance: data.api1Instance,
        api2ServerId: data.api2ServerId,
        api2Instance: data.api2Instance,
        api3ServerId: data.api3ServerId,
        api3Instance: data.api3Instance,
      });
    } else {
      console.warn("[OpenCodeLogin] 登录失败或已取消");
      resolvePromise({
        cookies: null,
        baseUrl: null,
        api1ServerId: null,
        api1Instance: null,
        api2ServerId: null,
        api2Instance: null,
        api3ServerId: null,
        api3Instance: null,
      });
    }
  });
}

// ── 数据导出：文件保存对话框 ──
ipcMain.handle(
  "show-save-dialog",
  async (_, options: Electron.SaveDialogOptions) => {
    if (!mainWindow) return { canceled: true, filePath: "" };
    return dialog.showSaveDialog(mainWindow, options);
  },
);

// ── 数据导出：写入文件 ──
ipcMain.handle(
  "save-file",
  async (_, { filePath, content }: { filePath: string; content: string }) => {
    const { writeFile } = await import("fs/promises");
    await writeFile(filePath, content, "utf-8");
    return true;
  },
);
