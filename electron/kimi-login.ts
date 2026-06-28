import { BrowserWindow, session, Notification } from "electron";

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
const KIMI_TOP_DOMAIN = "kimi.com";

export interface KimiLoginResult {
  cookies: string;
  token?: string;
}

export class KimiLoginWindowManager {
  private loginWindow: BrowserWindow | null = null;
  private loginCompleteCallback: ((data: KimiLoginResult | null) => void) | null =
    null;
  private timeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private resolved = false;
  private partition: string = "";
  private interceptedJwt: string | null = null;

  /**
   * 打开 Kimi 登录窗口，每个 modelId 使用独立 Session partition，实现 Cookie 隔离。
   * 唯一有效的 JWT 来源：拦截 GetSubscriptionStat 请求的 Authorization header。
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
    this.interceptedJwt = null;
    this.partition = modelId ? `persist:kimi-${modelId}` : "persist:kimi-shared";

    // 清理该 partition 下的 Kimi cookies，避免旧账号残留
    const loginSession = session.fromPartition(this.partition);
    const existingCookies = await loginSession.cookies.get({});
    for (const cookie of existingCookies) {
      if (cookie.domain?.includes(KIMI_TOP_DOMAIN)) {
        await loginSession.cookies.remove(cookie.domain, cookie.name);
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 注册请求拦截器：捕获 GetSubscriptionStat 请求中的 JWT（唯一有效来源）
    loginSession.webRequest.onBeforeSendHeaders(
      { urls: ["*://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/*"] },
      (details, callback) => {
        const auth = details.requestHeaders["Authorization"] || details.requestHeaders["authorization"];
        if (auth && auth.startsWith("Bearer ")) {
          const jwt = auth.slice(7);
          if (jwt.startsWith("eyJ") && !this.interceptedJwt) {
            this.interceptedJwt = jwt;

            // 弹窗提示
            new Notification({
              title: "Kimi 登录成功",
              body: "已捕获订阅接口 JWT，窗口将自动关闭",
            }).show();

            // 1 秒后自动关闭登录窗口
            setTimeout(() => {
              if (this.loginWindow && !this.loginWindow.isDestroyed()) {
                this.loginWindow.close();
              }
            }, 1000);
          }
        }
        callback({ requestHeaders: details.requestHeaders });
      }
    );

    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: 900,
      height: 800,
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

    this.loginWindow.loadURL(url);

    // 监听导航事件：用户登录后可能跳转到订阅页，触发检查
    this.loginWindow.webContents.on("did-navigate", () => {});

    // 窗口关闭前提取 cookies
    this.loginWindow.on("close", () => {
      this.extractCookiesFromSession();
      // 清理请求拦截器
      try {
        loginSession.webRequest.onBeforeSendHeaders(null as any, null as any);
      } catch { /* 忽略清理错误 */ }
    });

    this.loginWindow.on("closed", () => {
      this.clearTimer();
      this.loginWindow = null;
    });

    // 超时保护：自动关闭窗口并通知
    this.timeoutTimer = setTimeout(() => {
      new Notification({
        title: "Kimi 登录超时",
        body: "未捕获到订阅接口 JWT，请重试",
      }).show();
      if (this.loginWindow && !this.loginWindow.isDestroyed()) {
        this.loginWindow.close();
      }
    }, LOGIN_TIMEOUT_MS);
  }

  onLoginComplete(callback: (data: KimiLoginResult | null) => void): void {
    this.loginCompleteCallback = callback;
  }

  private getSession() {
    return session.fromPartition(this.partition);
  }

  /**
   * 从 session 提取 cookies 并触发回调。
   * JWT 只来自 GetSubscriptionStat 请求拦截（interceptedJwt），无回退。
   */
  private async extractCookiesFromSession(): Promise<void> {
    if (this.resolved) return;

    try {
      const cookies = await this.getSession().cookies.get({});
      const kimiCookies = cookies.filter(
        (c) => c.domain?.includes(KIMI_TOP_DOMAIN),
      );

      if (kimiCookies.length > 0) {
        const cookieString = kimiCookies
          .map((c) => `${c.name}=${c.value}`)
          .join("; ");

        // JWT 只来自 GetSubscriptionStat 拦截
        const token = this.interceptedJwt ?? undefined;

        this.triggerCallback({ cookies: cookieString, token });
      } else {
        this.triggerCallback(null);
      }
    } catch (error) {
      this.triggerCallback(null);
    }
  }

  private triggerCallback(data: KimiLoginResult | null): void {
    if (this.resolved) return;
    this.resolved = true;
    this.clearTimer();

    if (this.loginCompleteCallback) {
      this.loginCompleteCallback(data);
      this.loginCompleteCallback = null;
    }
  }

  private clearTimer(): void {
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
