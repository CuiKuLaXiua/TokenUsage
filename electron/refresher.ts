import { BrowserWindow, net } from "electron";
import { readFileSync, existsSync } from "fs";

// ── 类型定义 ──

interface ModelConfig {
  id: string;
  name: string;
  provider: string;
  apiKey?: string;
  baseUrl: string;
  cookies: string;
  refreshInterval?: number;
  refreshUnit?: "second" | "minute" | "hour";
  enabled: boolean;
  // OpenCode 专用
  serverId?: string; // API1 GET x-server-id（基础数据 + 刷新器）
  serverInstance?: string; // API1 GET x-server-instance
  dailyServerId?: string; // API2 POST x-server-id
  dailyServerInstance?: string; // API2 POST x-server-instance
  recordsServerId?: string; // API3 POST x-server-id
  recordsServerInstance?: string; // API3 POST x-server-instance
}

interface UsageTier {
  name: string;
  label: string;
  used?: number;
  total?: number;
  remaining?: number;
  percent: number;
  resetAt?: string;
}

interface ModelUsageStatus {
  usageType: "token" | "balance" | "percent";
  planName: string;
  lastUpdated: number;
  used?: number;
  total?: number;
  remaining?: number;
  percent?: number;
  balance?: number;
  currency?: string;
  tiers?: UsageTier[];
  // MIMO 套餐详情
  planCode?: string;
  currentPeriodEnd?: string;
  expired?: boolean;
  enableAutoRenew?: boolean;
  hasAutoRenewSubscribed?: boolean;
}

// ── API URL 常量 ──

const MIMO_DEFAULT_BASE_URL =
  "https://platform.xiaomimimo.com/api/v1/tokenPlan/usage";
const MIMO_DEFAULT_DETAIL_URL =
  "https://platform.xiaomimimo.com/api/v1/tokenPlan/detail";
const KIMI_DEFAULT_BASE_URL = "https://api.kimi.com/coding/v1/usages";
const DEEPSEEK_DEFAULT_BASE_URL = "https://api.deepseek.com/user/balance";
const OPENCODE_DEFAULT_BASE_URL = "https://opencode.ai/_server";

// ── 解析逻辑（从 src/services/api.ts 复制） ──

interface MimoResponseItem {
  name: string;
  used: number;
  limit: number;
}

function extractQuota(items?: MimoResponseItem[]) {
  let totalLimit = 0;
  let totalUsed = 0;
  if (items && Array.isArray(items)) {
    for (const item of items) {
      if (
        item.name === "plan_total_token" ||
        item.name === "compensation_total_token"
      ) {
        totalLimit += item.limit || 0;
        totalUsed += item.used || 0;
      }
    }
  }
  return { totalLimit, totalUsed };
}

function parseMimoResponse(response: any): ModelUsageStatus | null {
  if (!response || response.code !== 0 || !response.data) return null;

  const { data } = response;
  const usageQuota = extractQuota(data.usage?.items);
  const monthQuota = extractQuota(data.monthUsage?.items);

  const total = usageQuota.totalLimit || monthQuota.totalLimit;
  const used = usageQuota.totalUsed || monthQuota.totalUsed;
  const remaining = Math.max(0, total - used);
  const percent = total > 0 ? Math.round((used / total) * 10000) / 100 : 0;

  let planName = "未知套餐";
  if (data.usage?.items) {
    for (const item of data.usage.items) {
      if (item.name === "plan_total_token") {
        planName = "基础套餐";
        break;
      }
    }
  } else if (data.monthUsage?.items) {
    for (const item of data.monthUsage.items) {
      if (item.name === "month_total_token") {
        planName = "月度套餐";
        break;
      }
    }
  }

  // 解析套餐详情（tokenPlan/detail）
  const detail = response.detail?.data;
  if (detail) {
    if (detail.planName) {
      planName = detail.planName;
    }
  }

  const result: ModelUsageStatus = {
    usageType: "token",
    planName,
    used,
    total,
    remaining,
    percent,
    lastUpdated: Date.now(),
  };

  if (detail) {
    result.planCode = detail.planCode;
    result.currentPeriodEnd = detail.currentPeriodEnd;
    result.expired = detail.expired;
    result.enableAutoRenew = detail.enableAutoRenew;
    result.hasAutoRenewSubscribed = detail.hasAutoRenewSubscribed;
  }

  return result;
}

function parseF64(value: unknown): number | null {
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const n = Number(value);
    return isNaN(n) ? null : n;
  }
  return null;
}

function makeTier(name: string, label: string, detail: any): UsageTier | null {
  const total = parseF64(detail.limit) ?? 0;
  const used = parseF64(detail.used) ?? 0;
  const remaining = parseF64(detail.remaining) ?? 0;
  if (total <= 0) return null;
  const percent = Math.round((used / total) * 10000) / 100;
  return {
    name,
    label,
    used,
    total,
    remaining,
    percent,
    resetAt:
      typeof detail.resetTime === "string" ? detail.resetTime : undefined,
  };
}

function parseKimiResponse(response: any): ModelUsageStatus | null {
  if (!response || typeof response !== "object") return null;

  const tiers: UsageTier[] = [];

  // 1. 五小时窗口限额 (limits[].detail)
  const limits = response.limits;
  if (Array.isArray(limits)) {
    for (const item of limits) {
      const detail = item?.detail;
      if (detail && typeof detail === "object") {
        const tier = makeTier("five_hour", "5H", detail);
        if (tier) tiers.push(tier);
      }
    }
  }

  // 2. 7天限额 (usage)
  const usage = response.usage;
  if (usage && typeof usage === "object") {
    const tier = makeTier("seven_day", "7D", usage);
    if (tier) tiers.push(tier);
  }

  if (tiers.length === 0) return null;

  return {
    usageType: "percent",
    planName: "Kimi Coding",
    lastUpdated: Date.now(),
    tiers,
  };
}

function parseDeepSeekResponse(response: any): ModelUsageStatus | null {
  if (
    !response ||
    !Array.isArray(response.balance_infos) ||
    response.balance_infos.length === 0
  ) {
    return null;
  }

  const info = response.balance_infos[0];
  const balance = Number(info.total_balance) || 0;
  const currency = info.currency ?? "CNY";

  return {
    usageType: "balance",
    planName: "DeepSeek",
    lastUpdated: Date.now(),
    balance,
    currency,
  };
}

function parseOpenCodeResponse(response: any): ModelUsageStatus | null {
  // Open Code 返回的是 JavaScript 代码，需要从字符串中提取数据
  if (typeof response === "string") {
    try {
      // 提取 monthlyUsage 的 usagePercent
      const monthlyMatch = response.match(
        /monthlyUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*usagePercent:\s*(\d+)[^}]*\}/,
      );
      const weeklyMatch = response.match(
        /weeklyUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*usagePercent:\s*(\d+)[^}]*\}/,
      );
      const rollingMatch = response.match(
        /rollingUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*usagePercent:\s*(\d+)[^}]*\}/,
      );

      // 提取 resetInSec
      const monthlyResetMatch = response.match(
        /monthlyUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*resetInSec:\s*(\d+)[^}]*\}/,
      );
      const weeklyResetMatch = response.match(
        /weeklyUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*resetInSec:\s*(\d+)[^}]*\}/,
      );
      const rollingResetMatch = response.match(
        /rollingUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*resetInSec:\s*(\d+)[^}]*\}/,
      );

      // 提取 status
      const monthlyStatusMatch = response.match(
        /monthlyUsage:\s*\$R\[\d+\]\s*=\s*\{[^}]*status:\s*"(\w+)"[^}]*\}/,
      );

      const tiers: UsageTier[] = [];

      if (rollingMatch) {
        const percent = parseInt(rollingMatch[1]);
        const resetSec = rollingResetMatch
          ? parseInt(rollingResetMatch[1])
          : undefined;
        // 将秒数转换为 ISO 日期格式（当前时间 + resetInSec）
        const resetAt = resetSec
          ? new Date(Date.now() + resetSec * 1000).toISOString()
          : undefined;
        tiers.push({
          name: "five_hour",
          label: "5H",
          percent,
          resetAt,
        });
      }

      if (weeklyMatch) {
        const percent = parseInt(weeklyMatch[1]);
        const resetSec = weeklyResetMatch
          ? parseInt(weeklyResetMatch[1])
          : undefined;
        const resetAt = resetSec
          ? new Date(Date.now() + resetSec * 1000).toISOString()
          : undefined;
        tiers.push({
          name: "weekly",
          label: "7D",
          percent,
          resetAt,
        });
      }

      if (monthlyMatch) {
        const percent = parseInt(monthlyMatch[1]);
        const resetSec = monthlyResetMatch
          ? parseInt(monthlyResetMatch[1])
          : undefined;
        const resetAt = resetSec
          ? new Date(Date.now() + resetSec * 1000).toISOString()
          : undefined;
        tiers.push({
          name: "monthly",
          label: "30D",
          percent,
          resetAt,
        });
      }

      if (tiers.length > 0) {
        return {
          usageType: "percent",
          planName: "Open Code",
          lastUpdated: Date.now(),
          tiers,
        };
      }

      return null;
    } catch (e) {
      console.error("[OpenCode] 解析 JavaScript 响应失败:", e);
      return null;
    }
  }

  // 如果是对象，尝试之前的格式
  if (response && typeof response === "object") {
    // 格式 1: { usage: { used, total, remaining }, planName }
    if (response.usage && typeof response.usage === "object") {
      const { used, total, remaining } = response.usage;
      if (typeof total === "number" && total > 0) {
        return {
          usageType: "token",
          planName: response.planName || "Open Code",
          used: Number(used) || 0,
          total: Number(total) || 0,
          remaining: Number(remaining) || Math.max(0, total - (used || 0)),
          percent:
            total > 0 ? Math.round(((used || 0) / total) * 10000) / 100 : 0,
          lastUpdated: Date.now(),
        };
      }
    }

    // 格式 2: { balance: number, currency: string }
    if (typeof response.balance === "number") {
      return {
        usageType: "balance",
        planName: response.planName || "Open Code",
        balance: response.balance,
        currency: response.currency || "USD",
        lastUpdated: Date.now(),
      };
    }

    // 格式 3: { total, used, remaining } 直接在顶层
    if (typeof response.total === "number" && response.total > 0) {
      return {
        usageType: "token",
        planName: response.planName || "Open Code",
        used: Number(response.used) || 0,
        total: Number(response.total) || 0,
        remaining:
          Number(response.remaining) ||
          Math.max(0, response.total - (response.used || 0)),
        percent:
          response.total > 0
            ? Math.round(((response.used || 0) / response.total) * 10000) / 100
            : 0,
        lastUpdated: Date.now(),
      };
    }

    // 格式 4: 尝试 Kimi 风格的 limits/usage
    const kimiStyleResult = parseKimiResponse(response);
    if (kimiStyleResult) {
      kimiStyleResult.planName = "Open Code";
      return kimiStyleResult;
    }
  }

  return null;
}

function extractUsage(
  response: any,
  provider: string,
): ModelUsageStatus | null {
  let result: ModelUsageStatus | null = null;

  switch (provider) {
    case "mimo":
      result = parseMimoResponse(response);
      break;
    case "kimi":
      result = parseKimiResponse(response);
      break;
    case "deepseek":
      result = parseDeepSeekResponse(response);
      break;
    case "opencode":
      result = parseOpenCodeResponse(response);
      break;
    default:
      result = parseKimiResponse(response);
      break;
  }

  return result;
}

// ── 主进程刷新管理器 ──

const LOGIN_NEEDED_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

export class UsageRefresher {
  private modelUsageMap: Map<string, ModelUsageStatus> = new Map();
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();
  private configPath: string;
  private models: ModelConfig[] = [];
  private fetchInProgress: Set<string> = new Set();
  private loginNeededCooldown: Map<string, number> = new Map();

  constructor(configPath: string) {
    this.configPath = configPath;
  }

  /**
   * 加载配置并启动定时刷新
   */
  start(): void {
    this.loadConfig();
    this.stopAll();

    for (const model of this.models) {
      if (!model.enabled) continue;
      // MIMO 和 OpenCode 仅需 Cookie，其他提供商需要 apiKey
      let hasAuth = false;
      if (model.provider === "mimo" || model.provider === "opencode") {
        hasAuth = !!model.cookies;
      } else {
        hasAuth = !!model.apiKey;
      }
      if (!hasAuth) continue;

      // 首次立即拉取
      this.fetchModel(model).catch(() => {});

      // 设置定时器
      if (model.refreshInterval && model.refreshInterval > 0) {
        const unit = model.refreshUnit || "minute";
        const multiplier =
          unit === "second" ? 1000 : unit === "hour" ? 3600 * 1000 : 60 * 1000;
        const intervalMs = model.refreshInterval * multiplier;
        // 最小间隔 5 秒，防止过于频繁
        const safeInterval = Math.max(intervalMs, 5000);
        const timer = setInterval(() => {
          if (!this.fetchInProgress.has(model.id)) {
            this.fetchModel(model).catch(() => {});
          }
        }, safeInterval);
        this.timers.set(model.id, timer);
      }
    }
  }

  /**
   * 重新加载配置（config 变更时调用）
   */
  restart(): void {
    console.log("[Refresher] 重启刷新服务");
    this.start();
  }

  /**
   * 拉取单个模型数据
   */
  async fetchModel(model: ModelConfig): Promise<ModelUsageStatus | null> {
    if (this.fetchInProgress.has(model.id)) return null;

    this.fetchInProgress.add(model.id);
    this.broadcastFetching(model.id, true);

    try {
      let responseData: any;

      if (model.provider === "mimo") {
        // MIMO: 同时请求 usage 和 detail
        const usageOptions = this.buildFetchOptions(model);
        const detailOptions = this.buildMimoDetailOptions(model);
        const [usageData, detailData] = await Promise.all([
          this.doRequest(usageOptions),
          this.doRequest(detailOptions).catch((err) => {
            console.warn(
              `[Refresher] ${model.name} detail 请求失败，忽略:`,
              err.message,
            );
            return null;
          }),
        ]);
        responseData = { ...usageData, detail: detailData };
      } else {
        const fetchOptions = this.buildFetchOptions(model);
        responseData = await this.doRequest(fetchOptions);
      }

      const result = extractUsage(responseData, model.provider);

      if (result) {
        this.modelUsageMap.set(model.id, result);
        this.broadcast(model.id, result);
        console.log(`[Refresher] ${model.name} 数据更新成功`);
        console.log(`[数据：] ${JSON.stringify(result)} `);
        return result;
      }
      return null;
    } catch (error) {
      console.error(`[Refresher] ${model.name} 拉取失败:`, error);

      // 检测 cookie 过期（MiMo 和 OpenCode）
      if (
        (model.provider === "mimo" || model.provider === "opencode") &&
        this.isCookieExpired(error)
      ) {
        console.log("[Refresher] 检测到 Cookie 过期，广播 login-needed");
        this.broadcastLoginNeeded(model.id);
      }

      // 检测 API key 失效（Kimi、DeepSeek 等）
      if (this.isApiKeyInvalid(error, model.provider)) {
        console.log(`[Refresher] 检测到 ${model.provider} API key 可能失效`);
        this.broadcastApiKeyInvalid(model);
      }

      throw error;
    } finally {
      this.fetchInProgress.delete(model.id);
      this.broadcastFetching(model.id, false);
    }
  }

  /**
   * 按 ID 拉取模型
   */
  async fetchModelById(modelId: string): Promise<ModelUsageStatus | null> {
    const model = this.models.find((m) => m.id === modelId);
    if (!model) return null;
    return this.fetchModel(model);
  }

  /**
   * 刷新所有模型
   */
  async refreshAll(): Promise<void> {
    console.log("[Refresher] 开始刷新所有模型");
    for (const model of this.models) {
      let hasAuth = false;
      if (model.provider === "mimo" || model.provider === "opencode") {
        hasAuth = !!model.cookies;
      } else {
        hasAuth = !!model.apiKey;
      }
      if (model.enabled && hasAuth) {
        try {
          await this.fetchModel(model);
        } catch {
          // 继续刷新其他模型
        }
      }
    }
    console.log("[Refresher] 所有模型刷新完成");
  }

  /**
   * 获取当前缓存（新窗口打开时用）
   */
  getCachedData(): Record<string, ModelUsageStatus> {
    return Object.fromEntries(this.modelUsageMap);
  }

  /**
   * 获取当前正在加载的模型状态（新窗口打开时用）
   */
  getFetchingState(): Record<string, boolean> {
    const state: Record<string, boolean> = {};
    for (const modelId of this.fetchInProgress) {
      state[modelId] = true;
    }
    return state;
  }

  /**
   * 停止所有定时器
   */
  stopAll(): void {
    this.timers.forEach((t) => clearInterval(t));
    this.timers.clear();
  }

  // ── 私有方法 ──

  private loadConfig(): void {
    try {
      if (existsSync(this.configPath)) {
        const config = JSON.parse(readFileSync(this.configPath, "utf-8"));
        this.models = config.models || [];
        console.log(`[Refresher] 加载配置成功，${this.models.length} 个模型`);
      }
    } catch (error) {
      console.error("[Refresher] 加载配置失败:", error);
      this.models = [];
    }
  }

  private buildFetchOptions(model: ModelConfig): any {
    if (model.provider === "kimi") {
      return {
        url: model.baseUrl || KIMI_DEFAULT_BASE_URL,
        apiKey: model.apiKey,
        method: "GET",
        headers: { Accept: "application/json" },
      };
    } else if (model.provider === "deepseek") {
      return {
        url: model.baseUrl || DEEPSEEK_DEFAULT_BASE_URL,
        apiKey: model.apiKey,
        method: "GET",
        headers: { Accept: "application/json" },
      };
    } else if (model.provider === "opencode") {
      // Open Code 使用 Cookie 认证
      // 如果没有 baseUrl，使用默认值（会在登录时自动获取）
      const url = model.baseUrl || OPENCODE_DEFAULT_BASE_URL;

      return {
        url,
        cookies: model.cookies,
        method: "GET",
        headers: {
          Accept: "*/*",
          "x-server-id": model.serverId || "",
          "x-server-instance":
            model.serverInstance ||
            (model as any).postServerInstance || // 旧配置兼容
            (model as any).getServerInstance ||
            "",
        },
      };
    } else {
      return {
        url: model.baseUrl || MIMO_DEFAULT_BASE_URL,
        apiKey: model.apiKey || "",
        cookies: model.cookies || "",
      };
    }
  }

  private buildMimoDetailOptions(model: ModelConfig): any {
    return {
      url: MIMO_DEFAULT_DETAIL_URL,
      apiKey: model.apiKey || "",
      cookies: model.cookies || "",
    };
  }

  private doRequest(options: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const {
        url,
        apiKey,
        cookies,
        method = "GET",
        headers = {},
        body,
      } = options;

      const requestHeaders: Record<string, string> = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      };

      if (apiKey) {
        requestHeaders["Authorization"] = `Bearer ${apiKey}`;
      }

      for (const [key, value] of Object.entries(headers)) {
        if (typeof value === "string") requestHeaders[key] = value;
      }

      if (method === "POST" && !requestHeaders["Content-Type"]) {
        requestHeaders["Content-Type"] = "application/json";
      }

      if (cookies) requestHeaders["Cookie"] = cookies;

      const request = net.request({ method, url, headers: requestHeaders });
      let responseData = "";

      request.on("response", (response) => {
        response.on("data", (chunk: Buffer) => {
          responseData += chunk.toString();
        });
        response.on("end", () => {
          try {
            // 记录原始响应（调试用）
            console.log(`[Refresher] ${url} 响应状态: ${response.statusCode}`);
            // console.log(`[Refresher] ${url} 响应内容前 500 字符:`, responseData.substring(0, 500))

            // 检测 MiMo 登录重定向
            if (url.includes("platform.xiaomimimo.com")) {
              if (response.statusCode === 401 || response.statusCode === 403) {
                const error = new Error("Cookie expired or unauthorized");
                (error as any).code = "COOKIE_EXPIRED";
                reject(error);
                return;
              }
            }

            // 检测 Kimi/DeepSeek/OpenCode 等 API key 失效（401/403 状态码）
            if (response.statusCode === 401 || response.statusCode === 403) {
              const error = new Error(
                `API request failed with status ${response.statusCode}: unauthorized`,
              );
              reject(error);
              return;
            }

            // 检查 Content-Type，如果是 text/javascript 则直接返回字符串
            const contentType = response.headers["content-type"] || "";
            if (
              contentType.includes("text/javascript") ||
              contentType.includes("application/javascript")
            ) {
              // 对于 Open Code 等返回 JavaScript 的 API，直接返回响应字符串
              resolve(responseData);
              return;
            }

            // 尝试解析为 JSON
            const data = JSON.parse(responseData);

            // 检测 MiMo 登录重定向（JSON 响应）
            if (url.includes("platform.xiaomimimo.com")) {
              if (data.loginUrl) {
                const error = new Error("Cookie expired or unauthorized");
                (error as any).code = "COOKIE_EXPIRED";
                reject(error);
                return;
              }
            }

            resolve(data);
          } catch (parseError) {
            console.error(`[Refresher] JSON 解析失败，原始响应:`, responseData);
            reject(
              new Error(
                `JSON解析失败，响应内容: ${responseData.substring(0, 200)}`,
              ),
            );
          }
        });
      });

      request.on("error", reject);

      if (body && ["POST", "PUT", "PATCH"].includes(method)) {
        request.write(typeof body === "string" ? body : JSON.stringify(body));
      }

      request.end();
    });
  }

  private broadcast(modelId: string, data: ModelUsageStatus): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send("usage-updated", { modelId, data });
      }
    }
  }

  private broadcastFetching(modelId: string, isFetching: boolean): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send("usage-fetching", {
          modelId,
          fetching: isFetching,
        });
      }
    }
  }

  private broadcastLoginNeeded(modelId: string): void {
    // 冷却检查：同一模型 5 分钟内不重复广播
    const lastSent = this.loginNeededCooldown.get(modelId);
    const now = Date.now();
    if (lastSent && now - lastSent < LOGIN_NEEDED_COOLDOWN_MS) {
      console.log(`[Refresher] login-needed 冷却中，跳过模型 ${modelId}`);
      return;
    }
    this.loginNeededCooldown.set(modelId, now);

    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send("login-needed", { modelId });
      }
    }
  }

  private isCookieExpired(error: any): boolean {
    return (
      error?.code === "COOKIE_EXPIRED" ||
      (error instanceof Error && error.message.includes("Cookie expired"))
    );
  }

  private isApiKeyInvalid(error: any, provider: string): boolean {
    // 检测 API key 相关的错误（用于 Kimi、DeepSeek 等使用 API key 的提供商）
    // MIMO 和 OpenCode 使用 cookie，不检测 API key
    if (provider === "mimo" || provider === "opencode") return false;

    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        message.includes("unauthorized") ||
        message.includes("invalid api key") ||
        message.includes("api key") ||
        message.includes("authentication") ||
        message.includes("401") ||
        message.includes("403")
      );
    }
    return false;
  }

  private broadcastApiKeyInvalid(model: ModelConfig): void {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send("api-key-invalid", {
          modelId: model.id,
          modelName: model.name,
          provider: model.provider,
        });
      }
    }
  }
}
