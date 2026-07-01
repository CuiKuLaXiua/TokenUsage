import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  net,
  Tray,
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
import { KimiLoginWindowManager } from "./kimi-login";
import { UsageRefresher } from "./refresher";
import { parseOpenCodeDailyResponse, parseOpenCodeRecordsResponse } from "./api/parsers";
import {
  configPath,
  ensureDataDir,
  loadWindowState,
  saveWindowState,
  getCloseActionFromConfig,
  saveCloseActionToConfig,
} from "./services/persistence";
import type { CloseAction } from "./services/persistence";
import { themeService } from "./services/theme";
import { CtxMenuManager } from "./features/ctx-menu";
import { TrayMenuManager } from "./features/tray-menu";
import { floatWindowManager } from "./managers/float-window";
import { screenManager } from "./core/screen-manager";
import { IPC } from "./core/ipc-channels";
import { windowLifecycle } from "./core/window-lifecycle";
import { getPreloadPath, getRendererPath, getIconPath, getTrayIconPath } from "./utils/resource-path";

// 加载 .env.local 环境变量（仅在开发环境）
if (isDev) {
  loadDotenv({ path: join(__dirname, "../.env.local") });
}

// 捕获未处理的错误，防止进程退出
process.on("uncaughtException", (error) => {
  console.error("未捕获的异常:", error);
});

process.on("unhandledRejection", (reason) => {
  console.error("未处理的Promise拒绝:", reason);
});

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

const loginManager = new LoginWindowManager();
const openCodeLoginManager = new OpenCodeLoginWindowManager();
const kimiLoginManager = new KimiLoginWindowManager();

const refresher = new UsageRefresher(configPath);

// ── 系统托盘 ──
let trayClickTimer: ReturnType<typeof setTimeout> | null = null;

function showTrayMenu(cursorX: number, cursorY: number) {
  if (trayClickTimer) {
    clearTimeout(trayClickTimer);
    trayClickTimer = null;
  }
  trayMenuMgr.show(cursorX, cursorY);
}

function toggleTrayMenuByClick(cursorX: number, cursorY: number) {
  if (trayClickTimer) return;
  trayClickTimer = setTimeout(() => {
    trayClickTimer = null;
  }, 200);

  if (trayMenuMgr.isVisible()) {
    trayMenuMgr.hide();
  } else {
    trayMenuMgr.show(cursorX, cursorY);
  }
}

function createTray() {
  const iconPath = getTrayIconPath();
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    console.error("[Tray] 图标加载失败:", iconPath);
  }
  icon = icon.resize({ width: 32, height: 32 });

  tray = new Tray(icon);
  tray.setToolTip("Token Usage");

  tray.on("click", () => {
    const { screen } = require("electron");
    const pos = screen.getCursorScreenPoint();
    toggleTrayMenuByClick(pos.x, pos.y);
  });
  tray.on("right-click", () => {
    const { screen } = require("electron");
    const pos = screen.getCursorScreenPoint();
    showTrayMenu(pos.x, pos.y);
  });

  tray.on("double-click", () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(IPC.CLOSE_ACTION.RESET_DIALOG);
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    } else {
      createWindow();
    }
  });
}

// ── 主窗口 ──
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
     preload: getPreloadPath(),
     nodeIntegration: false,
     contextIsolation: true,
      sandbox: false,
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

    if (isQuitting) return;

    const closeAction = getCloseActionFromConfig();
    if (closeAction === "minimize-to-tray") {
      event.preventDefault();
      mainWindow?.hide();
      return;
    }
    if (closeAction === "quit") {
      isQuitting = true;
      setTimeout(() => app.quit(), 0);
      return;
    }
    event.preventDefault();
    mainWindow?.webContents.send(IPC.CLOSE_ACTION.SHOW_DIALOG);
  });

  if (isDev) {
    mainWindow.loadURL(rendererUrl);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(getRendererPath());
  }

  themeService.register(mainWindow)

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

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

// ── 悬浮窗 / 右键菜单 / 托盘菜单管理器 ──
const ctxMenu = new CtxMenuManager({
  getFloatWindow: () => windowLifecycle.get("float") || null,
});
ctxMenu.registerIpc();

const trayMenuMgr = new TrayMenuManager({
  getMainWindow: () => mainWindow,
  getFloatWindow: () => windowLifecycle.get("float") || null,
  getFloatWindowActive: () => floatWindowManager.isActive(),
  toggleFloatWindow: async () => {
    await floatWindowManager.toggle();
    const active = floatWindowManager.isActive();
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(active ? IPC.FLOAT.OPENED : IPC.FLOAT.CLOSED);
    }
  },
  showOrCreateMain: () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.webContents.send(IPC.CLOSE_ACTION.RESET_DIALOG);
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      }
    } else {
      createWindow();
    }
  },
  refresher,
  isQuitting: () => isQuitting,
  setQuitting: (v: boolean) => { isQuitting = v; },
});
trayMenuMgr.registerIpc();

refresher.onUpdate = () => trayMenuMgr.refreshIfVisible();

import { registerDataIpc } from "./ipc/data";
registerDataIpc({ getRefresher: () => refresher });

// ── 应用生命周期 ──
app.whenReady().then(() => {
  screenManager.init();
  ensureDataDir();
  createTray();
  createWindow();
  floatWindowManager.ensureFloatWindow();
  trayMenuMgr.preload();
  refresher.start();

  app.on("before-quit", () => {
    isQuitting = true;
    if (tray) {
      tray.destroy();
      tray = null;
    }
    screenManager.destroy();
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

// ── 通用 IPC（已由 managers 注册的不再重复） ──
ipcMain.handle(IPC.MAIN_WINDOW.SHOW, () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createWindow();
  } else {
    mainWindow.webContents.send(IPC.CLOSE_ACTION.RESET_DIALOG);
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
  return true;
});

ipcMain.handle(IPC.MAIN_WINDOW.MINIMIZE, () => {
  mainWindow?.minimize();
});

ipcMain.handle(IPC.MAIN_WINDOW.MAXIMIZE, () => {
  if (mainWindow?.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow?.maximize();
  }
});

ipcMain.handle(IPC.MAIN_WINDOW.CLOSE, () => {
  mainWindow?.close();
});

// 关闭行为
ipcMain.handle(IPC.CLOSE_ACTION.GET, () => getCloseActionFromConfig());

ipcMain.handle(IPC.CLOSE_ACTION.SET, (_, action: CloseAction | null) => {
  saveCloseActionToConfig(action);
  return true;
});

ipcMain.handle(
  IPC.CLOSE_ACTION.CHOSEN,
  (_, action: CloseAction, remember: boolean) => {
    if (remember) {
      saveCloseActionToConfig(action);
      mainWindow?.webContents.send(IPC.CLOSE_ACTION.UPDATED, action);
    }
    if (action === "minimize-to-tray") {
      mainWindow?.hide();
    } else {
      if (mainWindow && !mainWindow.isDestroyed()) saveWindowState(mainWindow);
      isQuitting = true;
      app.quit();
    }
  },
);

// 主题同步
ipcMain.handle(IPC.THEME.NOTIFY_CHANGED, (_, theme) => {
  themeService.broadcast(theme);
  // 持久化主题到 config，便于主进程启动时直接读取
  try {
    const existing = existsSync(configPath)
      ? JSON.parse(readFileSync(configPath, "utf-8"))
      : {};
    writeFileSync(
      configPath,
      JSON.stringify({ ...existing, theme }, null, 2),
    );
  } catch {
    /* ignore */
  }
  return true;
});

ipcMain.handle(IPC.THEME.GET, () => themeService.get());

// 调试日志
const _logFile = join(app.getPath("temp"), "tokenusage-debug.log");
function _dbg(msg: string) {
  const line = `[${new Date().toLocaleTimeString()}] ${msg}\n`;
  try {
    require("fs").appendFileSync(_logFile, line);
  } catch {}
}

ipcMain.handle(IPC.DEBUG_LOG, (_, msg: string) => {
  _dbg(`[renderer] ${msg}`);
  return true;
});

// 数据刷新
ipcMain.handle(IPC.USAGE_REFRESH.CACHED, () => refresher.getCachedData());
ipcMain.handle(IPC.USAGE_REFRESH.FETCHING, () => refresher.getFetchingState());
ipcMain.handle(IPC.USAGE_REFRESH.STRIP_DATA, () => refresher.getStripData());
ipcMain.handle(IPC.USAGE_REFRESH.REFRESH_ALL, async () => {
  await refresher.refreshAll();
  return true;
});
ipcMain.handle(IPC.USAGE_REFRESH.REFRESH_MODEL, async (_, modelId: string) => {
  await refresher.fetchModelById(modelId);
  return true;
});

// ── API 代理 ──
ipcMain.handle(IPC.API.MIMO_USAGE, async (_, options) => {
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

    for (const [key, value] of Object.entries(headers)) {
      if (typeof value === "string") {
        requestHeaders[key] = value;
      }
    }

    if (method === "POST" && !requestHeaders["Content-Type"]) {
      requestHeaders["Content-Type"] = "application/json";
    }

    if (cookies) {
      requestHeaders["Cookie"] = cookies;
    }

    const request = net.request({
      method: method,
      url: url,
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
          const isMimoUrl = url.includes("platform.xiaomimimo.com");
          if (isMimoUrl) {
            if (response.statusCode === 401 || response.statusCode === 403) {
              const error = new Error("Cookie expired or unauthorized");
              (error as any).code = "COOKIE_EXPIRED";
              (error as any).statusCode = response.statusCode;
              reject(error);
              return;
            }
            if (data.loginUrl) {
              const error = new Error("Cookie expired or unauthorized");
              (error as any).code = "COOKIE_EXPIRED";
              reject(error);
              return;
            }
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

    if (body && (method === "POST" || method === "PUT" || method === "PATCH")) {
      const bodyStr = typeof body === "string" ? body : JSON.stringify(body);
      request.write(bodyStr);
    }

    request.end();
  });
});

ipcMain.handle(
  IPC.API.MIMO_TOKEN_PLAN,
  async (_, options: { year: number; month: number; cookies: string }) => {
    return new Promise((resolve, reject) => {
      const { year, month, cookies } = options;
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
            if (response.statusCode === 401 || response.statusCode === 403) {
              const error = new Error("Cookie expired");
              (error as any).code = "COOKIE_EXPIRED";
              reject(error);
              return;
            }
            if (data.loginUrl) {
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

ipcMain.handle(
  IPC.API.MIMO_TOKEN_PLAN_DETAIL,
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
            if (response.statusCode === 401 || response.statusCode === 403) {
              const error = new Error("Cookie expired");
              (error as any).code = "COOKIE_EXPIRED";
              reject(error);
              return;
            }
            if (data.loginUrl) {
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

ipcMain.handle(
  IPC.API.OPCODE_USAGE_DETAIL,
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
          if (response.statusCode === 401 || response.statusCode === 403) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send(IPC.LOGIN.NEEDED);
            }
            reject(
              Object.assign(new Error("Cookie expired"), {
                code: "COOKIE_EXPIRED",
              }),
            );
            return;
          }
          const parsed = parseOpenCodeDailyResponse(responseData);
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

ipcMain.handle(
  IPC.API.OPCODE_USAGE_RECORDS,
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
          if (response.statusCode === 401 || response.statusCode === 403) {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send(IPC.LOGIN.NEEDED);
            }
            reject(
              Object.assign(new Error("Cookie expired"), {
                code: "COOKIE_EXPIRED",
              }),
            );
            return;
          }
          const parsed = parseOpenCodeRecordsResponse(responseData);
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

// ── 登录窗口管理 ──
let loginInProgress = false;
let loginPromise: Promise<string | null> | null = null;

ipcMain.handle(IPC.LOGIN.MIMO, async (_, modelId?: string) => {
  if (loginInProgress && loginPromise) {
    return loginPromise;
  }

  loginInProgress = true;

  loginPromise = new Promise<string | null>((resolve) => {
    let loginUrl = "https://platform.xiaomimimo.com/console/plan-manage";
    try {
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        const mimoModel = modelId
          ? config.models?.find((m: any) => m.id === modelId)
          : config.models?.find((m: any) => m.provider === "mimo");
        if (!mimoModel) {
          doLogin(loginUrl, resolve, modelId);
          return;
        }
        if (mimoModel?.loginUrl) {
          loginUrl = mimoModel.loginUrl;
        }
        if (mimoModel?.cookies) {
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
                if (data.code === 0) {
                  resolve(mimoModel.cookies);
                  return;
                }
              } catch {
                /* ignore */
              }
              doLogin(loginUrl, resolve, mimoModel.id);
            });
          });
          testRequest.on("error", () => {
            doLogin(loginUrl, resolve, mimoModel.id);
          });
          testRequest.end();
          return;
        }
      }
    } catch (error) {
      console.error("[Login] 读取配置失败:", error);
    }

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
  await loginManager.openLoginWindow(loginUrl, modelId, mainWindow || undefined);
  loginManager.onLoginComplete((cookies) => {
    if (cookies) {
      try {
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          const mimoModel = modelId
            ? config.models?.find((m: any) => m.id === modelId)
            : config.models?.find((m: any) => m.provider === "mimo");
          if (mimoModel) {
            mimoModel.cookies = cookies;
            writeFileSync(configPath, JSON.stringify(config, null, 2));
          }
        }
      } catch (error) {
        console.error("[Login] 保存 cookies 失败:", error);
      }
    }
    resolve(cookies);
  });
}

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

ipcMain.handle(IPC.LOGIN.OPCODE, async (_, modelId?: string) => {
  if (openCodeLoginInProgress && openCodeLoginPromise) {
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
    const loginUrl = "https://opencode.ai/zh/go";

    if (existsSync(configPath)) {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      const opencodeModel = modelId
        ? config.models?.find((m: any) => m.id === modelId)
        : config.models?.find((m: any) => m.provider === "opencode");
      if (!opencodeModel) {
        doOpenCodeLogin(loginUrl, resolvePromise, modelId);
        return;
      }
      if (opencodeModel?.cookies && opencodeModel?.baseUrl) {
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
            if (testData.includes("usagePercent")) {
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
            doOpenCodeLogin(loginUrl, resolvePromise, opencodeModel.id);
          });
        });
        testRequest.on("error", () => {
          doOpenCodeLogin(loginUrl, resolvePromise, opencodeModel.id);
        });
        testRequest.end();
        return;
      }
    }

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
  await openCodeLoginManager.openLoginWindow(loginUrl, mainWindow || undefined);
  openCodeLoginManager.onLoginComplete((data) => {
    if (data) {
      const baseUrl = data.apiUrl;
      try {
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          const opencodeModel = modelId
            ? config.models?.find((m: any) => m.id === modelId)
            : config.models?.find((m: any) => m.provider === "opencode");
          if (opencodeModel) {
            opencodeModel.cookies = data.cookies;
            if (baseUrl) opencodeModel.baseUrl = baseUrl;
            if (data.api1ServerId) opencodeModel.serverId = data.api1ServerId;
            if (data.api1Instance) opencodeModel.serverInstance = data.api1Instance;
            if (data.api2ServerId) opencodeModel.dailyServerId = data.api2ServerId;
            if (data.api2Instance) opencodeModel.dailyServerInstance = data.api2Instance;
            if (data.api3ServerId) opencodeModel.recordsServerId = data.api3ServerId;
            if (data.api3Instance) opencodeModel.recordsServerInstance = data.api3Instance;
            writeFileSync(configPath, JSON.stringify(config, null, 2));
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

let kimiLoginInProgress = false;
let kimiLoginPromise: Promise<{ cookies: string | null; token: string | null }> | null = null;

const KIMI_DEFAULT_LOGIN_URL = "https://www.kimi.com/code/console";
const KIMI_SUBSCRIPTION_URL =
  "https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStat";

ipcMain.handle(IPC.LOGIN.KIMI, async (_, modelId?: string) => {
  if (kimiLoginInProgress && kimiLoginPromise) {
    return kimiLoginPromise;
  }

  kimiLoginInProgress = true;

  kimiLoginPromise = new Promise<{ cookies: string | null; token: string | null }>((resolvePromise) => {
    let loginUrl = KIMI_DEFAULT_LOGIN_URL;
    try {
      if (existsSync(configPath)) {
        const config = JSON.parse(readFileSync(configPath, "utf-8"));
        const kimiModel = modelId
          ? config.models?.find((m: any) => m.id === modelId)
          : config.models?.find((m: any) => m.provider === "kimi");
        if (!kimiModel) {
          doKimiLogin(loginUrl, resolvePromise, modelId);
          return;
        }
        if (kimiModel?.loginUrl) {
          loginUrl = kimiModel.loginUrl;
        }
        if (kimiModel?.cookies) {
          const testRequest = net.request({
            method: "POST",
            url: KIMI_SUBSCRIPTION_URL,
            headers: buildKimiSubscriptionHeaders(kimiModel.cookies, kimiModel.apiKey),
          });

          let testData = "";
          testRequest.on("response", (response) => {
            response.on("data", (chunk) => {
              testData += chunk.toString();
            });
            response.on("end", () => {
              try {
                const data = JSON.parse(testData);
                if (
                  response.statusCode === 200 &&
                  data?.subscriptionBalance
                ) {
                  resolvePromise({ cookies: kimiModel.cookies, token: kimiModel.apiKey || null });
                  return;
                }
              } catch {
                /* ignore */
              }
              doKimiLogin(loginUrl, resolvePromise, kimiModel.id);
            });
          });
          testRequest.on("error", () => {
            doKimiLogin(loginUrl, resolvePromise, kimiModel.id);
          });
          testRequest.write("{}");
          testRequest.end();
          return;
        }
      }
    } catch (error) {
      console.error("[KimiLogin] 读取配置失败:", error);
    }

    let modelIdForLogin = modelId;
    if (!modelIdForLogin) {
      try {
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          const kimiModel = config.models?.find((m: any) => m.provider === "kimi");
          modelIdForLogin = kimiModel?.id;
        }
      } catch {}
    }
    doKimiLogin(loginUrl, resolvePromise, modelIdForLogin);
  });

  kimiLoginPromise.finally(() => {
    kimiLoginInProgress = false;
    kimiLoginPromise = null;
  });

  return kimiLoginPromise;
});

async function doKimiLogin(
  loginUrl: string,
  resolvePromise: (result: { cookies: string | null; token: string | null }) => void,
  modelId?: string,
): Promise<void> {
  await kimiLoginManager.openLoginWindow(loginUrl, modelId, mainWindow || undefined);
  kimiLoginManager.onLoginComplete((data) => {
    if (data?.cookies) {
      try {
        if (existsSync(configPath)) {
          const config = JSON.parse(readFileSync(configPath, "utf-8"));
          const kimiModel = modelId
            ? config.models?.find((m: any) => m.id === modelId)
            : config.models?.find((m: any) => m.provider === "kimi");
          if (kimiModel) {
            kimiModel.cookies = data.cookies;
            if (data.token) {
              kimiModel.apiKey = data.token;
            }
            writeFileSync(configPath, JSON.stringify(config, null, 2));
          }
        }
      } catch (error) {
        console.error("[KimiLogin] 保存配置失败:", error);
      }
      resolvePromise({ cookies: data.cookies, token: data.token || null });

      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send(IPC.LOGIN.KIMI_SUCCESS, {
          modelId,
          hasToken: !!data.token,
        });
      }
    } else {
      console.warn("[KimiLogin] 登录失败或已取消");
      resolvePromise({ cookies: null, token: null });
    }
  });
}

function buildKimiSubscriptionHeaders(
  cookies: string,
  token?: string,
): Record<string, string> {
  const deviceId = extractDeviceIdFromJwt(token);
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    Accept: "*/*",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Accept-Encoding": "gzip, deflate, br, zstd",
    Referer: "https://www.kimi.com/membership/subscription?tab=quota",
    Origin: "https://www.kimi.com",
    "connect-protocol-version": "1",
    "content-type": "application/json",
    "x-language": "zh-CN",
    "x-msh-platform": "web",
    "x-msh-version": "1.0.0",
    "x-msh-device-id": deviceId || "",
    "x-traffic-id": deviceId || "",
    Cookie: cookies,
  };
  if (token) {
    headers["authorization"] = `Bearer ${token}`;
  }
  return headers;
}

function extractDeviceIdFromJwt(jwt?: string): string | undefined {
  if (!jwt) return undefined;
  try {
    const payload = jwt.split(".")[1];
    if (!payload) return undefined;
    const json = Buffer.from(
      payload.replace(/-/g, "+").replace(/_/g, "/"),
      "base64",
    ).toString("utf-8");
    const data = JSON.parse(json);
    return data.device_id || data.sub || undefined;
  } catch {
    return undefined;
  }
}

ipcMain.handle(
  IPC.API.KIMI_SUBSCRIPTION,
  async (_, options: { cookies: string; token?: string; baseUrl?: string }) => {
    return new Promise((resolve, reject) => {
      const { cookies, token, baseUrl } = options;
      const url = baseUrl || KIMI_SUBSCRIPTION_URL;

      if (!isAllowedUrl(url)) {
        reject(new Error("URL not allowed"));
        return;
      }

      const requestHeaders = buildKimiSubscriptionHeaders(cookies, token);

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
            if (response.statusCode === 401 || response.statusCode === 403) {
              const error = new Error("Cookie expired or unauthorized");
              (error as any).code = "COOKIE_EXPIRED";
              reject(error);
              return;
            }

            const data = JSON.parse(responseData);
            resolve(data);
          } catch {
            reject(new Error("JSON解析失败"));
          }
        });
      });

      request.on("error", (error) => {
        reject(error);
      });

      request.write("{}");
      request.end();
    });
  },
);

// ── 数据导出 ──
ipcMain.handle(
  IPC.EXPORT.SAVE_DIALOG,
  async (_, options: Electron.SaveDialogOptions) => {
    if (!mainWindow) return { canceled: true, filePath: "" };
    return dialog.showSaveDialog(mainWindow, options);
  },
);

ipcMain.handle(
  IPC.EXPORT.SAVE_FILE,
  async (_, { filePath, content }: { filePath: string; content: string }) => {
    const { writeFile } = await import("fs/promises");
    await writeFile(filePath, content, "utf-8");
    return true;
  },
);
