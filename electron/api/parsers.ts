import vm from "vm";

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024; // 5MB safety limit
const VM_TIMEOUT_MS = 5000; // 5s execution timeout

// OpenCode 日用量明细解析
export function parseOpenCodeDailyResponse(jsCode: string): {
  usage: any[];
  keys: any[];
} {
  try {
    if (typeof jsCode !== "string" || jsCode.length === 0) {
      return { usage: [], keys: [] };
    }
    if (jsCode.length > MAX_RESPONSE_SIZE) {
      console.warn("[OpenCode] 响应超过大小限制:", jsCode.length);
      return { usage: [], keys: [] };
    }

    // 提取 JS 代码部分：从 ((self.$R 开始到末尾
    const startIdx = jsCode.indexOf("((self.$R");
    if (startIdx === -1) {
      return { usage: [], keys: [] };
    }

    const code = jsCode.substring(startIdx);
    const rObj: any = {};
    const context: any = { self: { $R: rObj }, $R: rObj };
    const script = new vm.Script(code, { filename: "opencode-daily.js" });
    script.runInNewContext(context, { timeout: VM_TIMEOUT_MS });

    // 遍历 $R 找到包含 usage 数据的项
    const rData = context.$R;
    let usage: any[] = [];
    let keys: any[] = [];

    for (const key of Object.keys(rData)) {
      const entry = rData[key];
      if (Array.isArray(entry) && entry.length > 0) {
        const first = entry[0];
        if (first && Array.isArray(first.usage)) {
          usage = first.usage;
          keys = first.keys || [];
          break;
        }
      }
    }

    return { usage, keys };
  } catch (e) {
    console.error("[OpenCode] 日用量解析失败:", e instanceof Error ? e.message : e);
    return { usage: [], keys: [] };
  }
}

// OpenCode 逐条明细解析（API3）
export function parseOpenCodeRecordsResponse(jsCode: string): { records: any[] } {
  try {
    if (typeof jsCode !== "string" || jsCode.length === 0) {
      return { records: [] };
    }
    if (jsCode.length > MAX_RESPONSE_SIZE) {
      console.warn("[OpenCode] API3 响应超过大小限制:", jsCode.length);
      return { records: [] };
    }

    const startIdx = jsCode.indexOf("((self.$R");
    if (startIdx === -1) {
      return { records: [] };
    }

    const code = jsCode.substring(startIdx);
    const rObj: any = {};
    const context: any = { self: { $R: rObj }, $R: rObj, Date };
    const script = new vm.Script(code, { filename: "opencode-records.js" });
    script.runInNewContext(context, { timeout: VM_TIMEOUT_MS });

    // 遍历 $R 找到数组，提取包含 id/model/cost 的记录
    const records: any[] = [];
    for (const key of Object.keys(rObj)) {
      const entry = rObj[key];
      if (Array.isArray(entry)) {
        for (const item of entry) {
          if (
            item &&
            typeof item === "object" &&
            item.id &&
            item.model &&
            item.cost != null
          ) {
            records.push({
              id: item.id,
              model: item.model,
              provider: item.provider || "",
              inputTokens: item.inputTokens || 0,
              outputTokens: item.outputTokens || 0,
              reasoningTokens: item.reasoningTokens || 0,
              cacheReadTokens: item.cacheReadTokens || 0,
              cost: item.cost || 0,
              keyID: item.keyID || "",
              timeCreated:
                item.timeCreated instanceof Date
                  ? item.timeCreated.toISOString()
                  : String(item.timeCreated || ""),
              plan: item.enrichment?.plan || "",
            });
          }
        }
      }
    }

    return { records };
  } catch (e) {
    console.error("[OpenCode] API3 解析失败:", e instanceof Error ? e.message : e);
    return { records: [] };
  }
}
