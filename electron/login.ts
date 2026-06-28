import { BrowserWindow, session } from "electron";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const MIMO_COOKIE_DOMAIN = "platform.xiaomimimo.com";

export class LoginWindowManager {
  private loginWindow: BrowserWindow | null = null;
  private loginCompleteCallback: ((cookies: string | null) => void) | null =
    null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private resolved = false;
  private partition: string = "";

  /**
   * 打开登录窗口。每个 modelId 使用独立 Session partition，实现 Cookie 隔离。
   * @param url 登录页 URL
   * @param modelId 模型 ID，用于生成独立 partition
   * @param parentWindow 父窗口（可选，关联但不模态）
   */
  async openLoginWindow(
    url: string,
    modelId?: string,
    parentWindow?: BrowserWindow,
  ): Promise<void> {
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      this.loginWindow.focus();
      return;
    }

    this.resolved = false;
    this.partition = modelId
      ? `persist:mimo-${modelId}`
      : "persist:mimo-shared";

    const loginSession = session.fromPartition(this.partition);
    // 清除该 partition 下所有 cookies（不仅是 mimo 域，避免任何残留）
    await loginSession.clearStorageData({
      storages: ["cookies"],
    });

    // 等待一下确保清除完成
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 验证清除结果
    const remainingCookies = await loginSession.cookies.get({
      domain: MIMO_COOKIE_DOMAIN,
    });
    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: 800,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        partition: this.partition,
      },
    };

    if (parentWindow && !parentWindow.isDestroyed()) {
      windowOptions.parent = parentWindow;
    }

    this.loginWindow = new BrowserWindow(windowOptions);

    // 加载登录页
    this.loginWindow.loadURL(url);

    // 页面加载完成后检查 cookies
    this.loginWindow.webContents.on("did-finish-load", () => {
      setTimeout(() => {
        this.checkAndExtractCookies();
      }, 1000);
    });

    // 窗口关闭前提取 cookies
    this.loginWindow.on("close", () => {
      this.extractCookiesFromSession();
    });

    // 窗口关闭后清理
    this.loginWindow.on("closed", () => {
      this.clearTimeout();
      this.loginWindow = null;
    });

    // 设置超时
    this.timeoutTimer = setTimeout(() => {
      console.warn("[LoginWindow] 登录超时，自动关闭窗口");
      if (!this.resolved) {
        this.triggerCallback(null);
      }
      if (this.loginWindow && !this.loginWindow.isDestroyed()) {
        this.loginWindow.close();
      }
    }, LOGIN_TIMEOUT_MS);
  }

  /**
   * 注册登录完成回调
   */
  onLoginComplete(callback: (cookies: string | null) => void): void {
    this.loginCompleteCallback = callback;
  }

  private getSession() {
    return session.fromPartition(this.partition);
  }

  /**
   * 检查并提取 cookies
   */
  private async checkAndExtractCookies(): Promise<void> {
    if (this.resolved) return;
    if (!this.loginWindow || this.loginWindow.isDestroyed()) return;

    try {
      // 从登录窗口的 webContents session 提取 cookies
      const cookies = await this.getSession().cookies.get({});

      if (cookies.length > 0) {
        // 检查是否有 platform.xiaomimimo.com 的 cookies
        const hasPlatformCookies = cookies.some(
          (c) => c.domain?.includes("xiaomimimo.com"),
        );

        if (hasPlatformCookies) {
          const cookieString = cookies
            .map((c) => `${c.name}=${c.value}`)
            .join("; ");
          this.triggerCallback(cookieString);
          // 关闭窗口
          if (this.loginWindow && !this.loginWindow.isDestroyed()) {
            this.loginWindow.close();
          }
        } else {
          // 未检测到 xiaomimimo.com 的 cookies，等待用户登录
        }
      } else {
        // 未检测到 cookies，等待用户登录
      }
    } catch (error) {
      console.error("[LoginWindow] 检查 cookies 失败:", error);
    }
  }

  /**
   * 从 session 提取 cookies
   */
  private async extractCookiesFromSession(): Promise<void> {
    if (this.resolved) return;

    try {
      // 从当前 partition session 提取 cookies
      const cookies = await this.getSession().cookies.get({});

      if (cookies.length > 0) {
        // 使用所有 cookies（不过滤域名）
        const cookieString = cookies
          .map((c) => `${c.name}=${c.value}`)
          .join("; ");
        this.triggerCallback(cookieString);
      } else {
        console.warn("[LoginWindow] 未提取到 cookies");
        this.triggerCallback(null);
      }
    } catch (error) {
      console.error("[LoginWindow] 提取 cookies 失败:", error);
      this.triggerCallback(null);
    }
  }

  private triggerCallback(cookies: string | null): void {
    if (this.resolved) return;
    this.resolved = true;
    this.clearTimeout();

    if (this.loginCompleteCallback) {
      this.loginCompleteCallback(cookies);
      this.loginCompleteCallback = null;
    }
  }

  private clearTimeout(): void {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
  }

  getLoginWindow(): BrowserWindow | null {
    if (this.loginWindow && !this.loginWindow.isDestroyed()) {
      return this.loginWindow;
    }
    return null;
  }
}
