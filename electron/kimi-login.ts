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
   * @param url 登录页 URL
   * @param modelId 模型 ID，用于生成独立 partition
   * @param parentWindow 父窗口（可选）
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
    console.log(`[KimiLogin] 使用独立 partition: ${this.partition}`);
    console.log("[KimiLogin] 清除当前 partition 的 Kimi cookies...");
    const existingCookies = await loginSession.cookies.get({});
    for (const cookie of existingCookies) {
      if (cookie.domain?.includes(KIMI_TOP_DOMAIN)) {
        await loginSession.cookies.remove(cookie.domain, cookie.name);
      }
    }
    console.log("[KimiLogin] 已清除当前 partition 的 Kimi 相关 cookies");
    await new Promise((resolve) => setTimeout(resolve, 500));

    // 注册请求拦截器：捕获 GetSubscriptionStat 请求中的 JWT
    loginSession.webRequest.onBeforeSendHeaders(
      { urls: ["*://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/*"] },
      (details, callback) => {
        const auth = details.requestHeaders["Authorization"] || details.requestHeaders["authorization"];
        if (auth && auth.startsWith("Bearer ")) {
          const jwt = auth.slice(7);
          if (jwt.startsWith("eyJ") && !this.interceptedJwt) {
            this.interceptedJwt = jwt;
            console.log("[KimiLogin] ✅ 从 GetSubscriptionStat 请求拦截到 JWT，长度:", jwt.length);

            // 弹窗提示
            new Notification({
              title: "Kimi 登录成功",
              body: "已捕获订阅接口 JWT，窗口将自动关闭",
            }).show();

            // 1 秒后自动关闭登录窗口
            setTimeout(() => {
              if (this.loginWindow && !this.loginWindow.isDestroyed()) {
                console.log("[KimiLogin] 自动关闭登录窗口");
                this.loginWindow.close();
              }
            }, 1000);
          }
        }
        callback({ requestHeaders: details.requestHeaders });
      }
    );
    console.log("[KimiLogin] 已注册 GetSubscriptionStat 请求拦截器");

    const windowOptions: Electron.BrowserWindowConstructorOptions = {
      width: 900,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        // 每个账号独立 session partition
        partition: this.partition,
      },
    };

    if (parentWindow && !parentWindow.isDestroyed()) {
      windowOptions.parent = parentWindow;
    }

    this.loginWindow = new BrowserWindow(windowOptions);

    // 调试：自动打开 DevTools
    this.loginWindow.webContents.openDevTools();

    console.log("[KimiLogin] 加载登录页:", url);
    this.loginWindow.loadURL(url);

    // 页面加载完成后检查 cookies / 提取 JWT
    this.loginWindow.webContents.on("did-finish-load", () => {
      console.log("[KimiLogin] 页面加载完成，1秒后检查 cookies 和 JWT");
      setTimeout(() => {
        this.checkAndExtractCookies();
        this.fetchAndExtractJwt();
      }, 1000);
    });

    // 监听导航事件：用户手动导航到订阅页时触发检查
    this.loginWindow.webContents.on("did-navigate", () => {
      setTimeout(() => {
        this.checkAndExtractCookies();
        this.fetchAndExtractJwt();
      }, 500);
    });

    // 窗口关闭前提取 cookies
    this.loginWindow.on("close", () => {
      console.log("[KimiLogin] 窗口即将关闭，立即提取 cookies");
      this.extractCookiesFromSession(true);
      // 清理请求拦截器
      try {
        loginSession.webRequest.onBeforeSendHeaders(null as any, null as any);
      } catch { /* 忽略清理错误 */ }
    });

    this.loginWindow.on("closed", () => {
      this.clearTimer();
      this.loginWindow = null;
    });

    // 超时保护
    this.timeoutTimer = setTimeout(() => {
      console.warn("[KimiLogin] 登录超时（调试模式不自动关闭窗口）");
    }, LOGIN_TIMEOUT_MS);
  }

  onLoginComplete(callback: (data: KimiLoginResult | null) => void): void {
    this.loginCompleteCallback = callback;
  }

  private getSession() {
    return session.fromPartition(this.partition);
  }

  private async fetchAndExtractJwt(): Promise<void> {
    if (this.resolved) return;
    if (!this.loginWindow || this.loginWindow.isDestroyed()) return;

    // 优先使用拦截到的 JWT（来自 GetSubscriptionStat 请求）
    if (this.interceptedJwt) {
      console.log("[KimiLogin] ✅ 使用拦截到的 JWT，长度:", this.interceptedJwt.length);
      (this.loginWindow as any).__kimiJwt = this.interceptedJwt;
      return;
    }

    // 回退：从 kimi-auth cookie 提取
    try {
      const cookies = await this.getSession().cookies.get({});
      const authCookie = cookies.find(
        (c) => c.name === "kimi-auth" && c.domain?.includes(KIMI_TOP_DOMAIN),
      );
      if (authCookie?.value && authCookie.value.startsWith("eyJ")) {
        console.log(
          "[KimiLogin] ✅ 从 kimi-auth cookie 提取到 JWT，长度:",
          authCookie.value.length,
        );
        (this.loginWindow as any).__kimiJwt = authCookie.value;
        return;
      }
    } catch (error) {
      console.error("[KimiLogin] 从 cookies 提取 JWT 失败:", error);
    }

    // 备用：尝试通过 /api/user 获取（通常不需要）
    try {
      const result = await this.loginWindow.webContents.executeJavaScript(
        `
        (async () => {
          try {
            const resp = await fetch('https://www.kimi.com/api/user?t=' + Date.now(), {
              credentials: 'include',
              headers: { 'Accept': 'application/json' }
            });
            const text = await resp.text();
            return { ok: resp.ok, status: resp.status, text };
          } catch (e) {
            return { ok: false, error: e.message };
          }
        })()
        `,
        true,
      );

      console.log("[KimiLogin] /api/user fetch 结果:", result?.ok, result?.status);
      if (result?.ok && result?.text) {
        let data: any = null;
        try {
          data = JSON.parse(result.text);
          console.log("[KimiLogin] /api/user 响应:", JSON.stringify(data).slice(0, 500));
        } catch {
          console.log("[KimiLogin] /api/user 响应不是 JSON:", result.text.slice(0, 200));
        }
        if (data) {
          const token = this.extractJwtFromUserResponse(data);
          if (token) {
            console.log("[KimiLogin] ✅ 从 /api/user 提取到 JWT token，长度:", token.length);
            (this.loginWindow as any).__kimiJwt = token;
          }
        }
      }
    } catch (error) {
      console.error("[KimiLogin] 主动获取 /api/user JWT 失败:", error);
    }
  }

  private extractJwtFromUserResponse(data: any): string | null {
    if (!data || typeof data !== 'object') return null;
    // 常见字段：token, accessToken, jwt, data.token, result.token
    const candidates = [
      data.token,
      data.accessToken,
      data.jwt,
      data.data?.token,
      data.data?.accessToken,
      data.data?.jwt,
      data.result?.token,
      data.result?.accessToken,
      data.result?.jwt,
    ];
    for (const value of candidates) {
      if (typeof value === 'string' && value.startsWith('eyJ')) {
        return value;
      }
    }
    return null;
  }

  private async checkAndExtractCookies(): Promise<void> {
    if (this.resolved) return;
    if (!this.loginWindow || this.loginWindow.isDestroyed()) return;

    try {
      const cookies = await this.getSession().cookies.get({});
      const kimiCookies = cookies.filter(
        (c) => c.domain?.includes(KIMI_TOP_DOMAIN),
      );

      console.log("[KimiLogin] 检查 cookies:", cookies.length, "个");
      if (kimiCookies.length > 0) {
        for (const cookie of kimiCookies) {
          console.log(
            `[KimiLogin] Cookie: ${cookie.name}=... (domain: ${cookie.domain})`,
          );
        }

        // 关键凭证是 kimi-auth cookie
        const hasAuthCookie = kimiCookies.some((c) => c.name === "kimi-auth");
        if (hasAuthCookie) {
          if (this.interceptedJwt) {
            console.log("[KimiLogin] ✅ 已捕获 GetSubscriptionStat JWT，可关闭窗口");
          } else {
            console.log("[KimiLogin] ✅ 检测到 kimi-auth，请导航到「订阅额度」页面以捕获 JWT，然后关闭窗口");
          }
          const cookieString = kimiCookies
            .map((c) => `${c.name}=${c.value}`)
            .join("; ");
          // 调试模式：不自动关闭窗口，用户可手动检查 DevTools；关闭时通过 close 事件提取 cookies
          console.log("[KimiLogin] 当前 Cookie 预览:", cookieString.slice(0, 200) + "...");
          return;
        } else {
          console.log("[KimiLogin] 未检测到 kimi-auth，等待用户登录");
        }
      } else {
        console.log("[KimiLogin] 未检测到 cookies，等待用户登录");
      }
    } catch (error) {
      console.error("[KimiLogin] 检查 cookies 失败:", error);
    }
  }

  private async extractCookiesFromSession(verbose = false): Promise<void> {
    if (this.resolved) return;

    try {
      const cookies = await this.getSession().cookies.get({});

      const kimiCookies = cookies.filter(
        (c) => c.domain?.includes(KIMI_TOP_DOMAIN),
      );

      console.log("[KimiLogin] 从 session 提取 cookies:", kimiCookies.length, "个");
      if (verbose) {
        for (const cookie of kimiCookies) {
          console.log(
            `[KimiLogin] 提取到 Cookie: name=${cookie.name}, domain=${cookie.domain}, path=${cookie.path}, value 长度=${cookie.value?.length || 0}`,
          );
        }
      }
      if (kimiCookies.length > 0) {
        const cookieString = kimiCookies
          .map((c) => `${c.name}=${c.value}`)
          .join("; ");
        console.log("[KimiLogin] Cookie 字符串总长度:", cookieString.length);

        // 优先使用拦截到的 JWT（来自 GetSubscriptionStat 请求，最准确）
        let token: string | undefined;
        if (this.interceptedJwt) {
          token = this.interceptedJwt;
          console.log(`[KimiLogin] JWT 来源: GetSubscriptionStat 拦截，长度: ${token.length}`);
        } else {
          // 回退：从 kimi-auth cookie 提取
          const authCookie = kimiCookies.find(c => c.name === "kimi-auth");
          if (authCookie?.value && authCookie.value.startsWith("eyJ")) {
            token = authCookie.value;
            console.log(`[KimiLogin] JWT 来源: kimi-auth cookie（回退），长度: ${token.length}`);
            console.warn("[KimiLogin] ⚠️ 未捕获到 GetSubscriptionStat JWT，使用 kimi-auth cookie 可能不准确");
          }
        }

        this.triggerCallback({ cookies: cookieString, token });
      } else {
        console.warn("[KimiLogin] 未提取到 cookies");
        this.triggerCallback(null);
      }
    } catch (error) {
      console.error("[KimiLogin] 提取 cookies 失败:", error);
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
