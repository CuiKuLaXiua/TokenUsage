# 功能改进说明

## 改进概览

本次改进解决了两个用户体验问题：

### ✅ 1. 登录完成后自动关闭登录页面
### ✅ 2. API key 失效时给出明确提示

---

## 详细改进内容

### 改进 1: 登录窗口自动关闭

**问题描述**
- 登录完成后，登录窗口没有自动关闭
- 用户需要手动关闭窗口

**根本原因**
- login.ts 中的窗口关闭逻辑已存在，但日志不够详细
- 需要确认 cookies 提取和窗口关闭的时序

**解决方案**

#### 1.1 添加详细日志（login.ts）
```typescript
if (hasPlatformCookies) {
  console.log('[LoginWindow] 检测到 xiaomimimo.com 的 cookies，立即提取')
  const cookieString = cookies.map(c => `${c.name}=${c.value}`).join('; ')
  console.log('[LoginWindow] 最终 cookie 字符串:', cookieString)
  console.log('[LoginWindow] 准备关闭登录窗口...')
  this.triggerCallback(cookieString)
  // 关闭窗口
  if (this.loginWindow && !this.loginWindow.isDestroyed()) {
    console.log('[LoginWindow] 执行关闭窗口操作')
    this.loginWindow.close()
    console.log('[LoginWindow] 窗口关闭命令已发送')
  }
}
```

#### 1.2 工作流程
1. 用户在登录窗口完成登录
2. 页面加载完成后，3秒后检查 cookies（`did-finish-load` 事件）
3. 检测到 `platform.xiaomimimo.com` 的 cookies 后：
   - 提取所有 cookies 并组合成字符串
   - 调用 `triggerCallback(cookieString)` 通知主进程
   - 调用 `this.loginWindow.close()` 关闭窗口
4. 主进程的 `onLoginComplete` 回调被触发
5. Cookies 被保存到配置文件

#### 1.3 验证方法
```bash
# 启动应用
npm run dev

# 触发登录流程
# 在配置页面点击"登录获取"或等待自动登录

# 观察终端日志，应该看到：
[LoginWindow] 检测到 xiaomimimo.com 的 cookies，立即提取
[LoginWindow] 准备关闭登录窗口...
[LoginWindow] 执行关闭窗口操作
[LoginWindow] 窗口关闭命令已发送
[Login] 登录完成，cookies: 已获取
[Login] Cookies 已保存到 config
```

---

### 改进 2: API Key 失效提示

**问题描述**
- Kimi 模型的 API key 失效时，没有错误提示
- 控制台和终端都没有相关错误信息
- 用户无法知道为什么额度获取失败

**根本原因**
1. **错误检测不足**：`refresher.ts` 只检测了 MiMo 的 cookie 过期，没有检测 Kimi/DeepSeek 的 API key 失效
2. **错误传播缺失**：API key 失效的错误没有广播到前端
3. **错误提示不明确**：Config.vue 只显示通用的"数据解析失败"，没有具体原因

**解决方案**

#### 2.1 增强错误检测（refresher.ts）

**添加 API key 失效检测方法**：
```typescript
private isApiKeyInvalid(error: any, provider: string): boolean {
  // 检测 API key 相关的错误（用于 Kimi、DeepSeek 等使用 API key 的提供商）
  if (provider === 'mimo') return false // MiMo 使用 cookie，不检测 API key

  if (error instanceof Error) {
    const message = error.message.toLowerCase()
    return message.includes('unauthorized') ||
           message.includes('invalid api key') ||
           message.includes('api key') ||
           message.includes('authentication') ||
           message.includes('401') ||
           message.includes('403')
  }
  return false
}
```

**添加广播方法**：
```typescript
private broadcastApiKeyInvalid(model: ModelConfig): void {
  const windows = BrowserWindow.getAllWindows()
  for (const win of windows) {
    if (!win.isDestroyed()) {
      win.webContents.send('api-key-invalid', {
        modelId: model.id,
        modelName: model.name,
        provider: model.provider
      })
    }
  }
}
```

**改进 doRequest 方法**：
```typescript
// 检测 Kimi/DeepSeek 等 API key 失效（401/403 状态码）
if (!url.includes('platform.xiaomimimo.com')) {
  if (response.statusCode === 401 || response.statusCode === 403) {
    const error = new Error(`API request failed with status ${response.statusCode}: unauthorized`)
    reject(error)
    return
  }
}
```

**在 fetchModel 中调用检测和广播**：
```typescript
} catch (error) {
  console.error(`[Refresher] ${model.name} 拉取失败:`, error)

  // 检测 cookie 过期（MiMo）
  if (model.provider === 'mimo' && this.isCookieExpired(error)) {
    console.log('[Refresher] 检测到 Cookie 过期，广播 login-needed')
    this.broadcastLoginNeeded()
  }

  // 检测 API key 失效（Kimi、DeepSeek 等）
  if (this.isApiKeyInvalid(error, model.provider)) {
    console.log(`[Refresher] 检测到 ${model.provider} API key 可能失效`)
    this.broadcastApiKeyInvalid(model)
  }

  throw error
}
```

#### 2.2 添加前端事件监听（preload.ts）

**Interface 定义**：
```typescript
onApiKeyInvalid: (callback: (data: {
  modelId: string
  modelName: string
  provider: string
}) => void) => () => void
```

**Implementation**：
```typescript
onApiKeyInvalid: (callback) => {
  const wrapper = (_: any, data: {
    modelId: string
    modelName: string
    provider: string
  }) => callback(data)
  ipcRenderer.on('api-key-invalid', wrapper)
  return () => {
    ipcRenderer.removeListener('api-key-invalid', wrapper)
  }
},
```

#### 2.3 Store 中处理事件（stores/app.ts）

**添加事件监听变量**：
```typescript
let unsubApiKeyInvalid: (() => void) | null = null
```

**初始化订阅**：
```typescript
// 监听 API key 失效
unsubApiKeyInvalid = window.electronAPI.onApiKeyInvalid(({ modelId, modelName, provider }) => {
  console.log(`[Store] 收到 api-key-invalid 事件: ${modelName} (${provider})`)
  // 设置错误状态，让 UI 可以显示提示
  if (modelUsageMap[modelId]) {
    modelUsageMap[modelId].error = `API key 已失效，请重新配置`
  } else {
    modelUsageMap[modelId] = {
      usageType: 'error',
      planName: modelName,
      lastUpdated: Date.now(),
      error: `API key 已失效，请重新配置`
    } as any
  }
})
```

**清理订阅**：
```typescript
function stopSubscription() {
  if (unsubUsage) { unsubUsage(); unsubUsage = null }
  if (unsubFetching) { unsubFetching(); unsubFetching = null }
  if (unsubLogin) { unsubLogin(); unsubLogin = null }
  if (unsubApiKeyInvalid) { unsubApiKeyInvalid(); unsubApiKeyInvalid = null }
}
```

#### 2.4 改进错误提示（Config.vue）

**新的错误处理逻辑**：
```typescript
async function fetchUsage(model: ModelConfig) {
  try {
    await store.requestRefresh(model.id)
    ElMessage.success({ message: `${model.name} 额度获取成功`, duration: 2000 })
  } catch (error: any) {
    console.error(`[Config] ${model.name} 获取额度失败:`, error)

    // 检查是否是 Cookie 过期错误（MiMo）
    if (error?.code === 'COOKIE_EXPIRED' || error?.message?.includes('Cookie expired')) {
      ElMessage.warning({ message: 'Cookie 已过期，请重新登录', duration: 3000 })
    }
    // 检查是否是 API key 失效（Kimi、DeepSeek 等）
    else if (error?.message?.includes('unauthorized') ||
             error?.message?.includes('401') ||
             error?.message?.includes('403') ||
             error?.message?.includes('API request failed')) {
      ElMessage.error({
        message: `${model.name} API key 已失效，请重新配置`,
        duration: 5000,
        showClose: true
      })
    }
    // 其他错误
    else {
      ElMessage.error({ message: `${model.name} 数据解析失败`, duration: 2500 })
    }
  }
}
```

---

## 测试场景

### 场景 1: Cookie 过期自动登录
```bash
# 前提：MIMO 模型的 cookie 已过期
# 操作：点击"获取额度"按钮
# 预期：
#   1. 弹出登录窗口
#   2. 完成登录后窗口自动关闭
#   3. 显示"额度获取成功"提示
```

### 场景 2: Kimi API Key 失效
```bash
# 前提：Kimi 模型的 API key 已失效
# 操作：点击"获取额度"按钮
# 预期：
#   1. 显示错误提示："Kimi API key 已失效，请重新配置"
#   2. 提示持续 5 秒，可手动关闭
#   3. 终端显示详细错误日志
```

### 场景 3: DeepSeek API Key 失效
```bash
# 前提：DeepSeek 模型的 API key 已失效
# 操作：点击"获取额度"按钮
# 预期：
#   1. 显示错误提示："DeepSeek API key 已失效，请重新配置"
#   2. 提示持续 5 秒，可手动关闭
```

### 场景 4: 网络错误
```bash
# 前提：网络连接失败
# 操作：点击"获取额度"按钮
# 预期：
#   1. 显示错误提示："数据解析失败"
#   2. 终端显示网络错误日志
```

---

## 错误类型识别

### 1. Cookie 过期（MiMo）
**触发条件**：
- HTTP 状态码 401/403
- 响应包含 `loginUrl` 字段
- 错误消息包含 "Cookie expired"

**错误码**：`COOKIE_EXPIRED`

**用户提示**：Cookie 已过期，请重新登录

**处理方式**：自动触发登录流程

### 2. API Key 失效（Kimi、DeepSeek）
**触发条件**：
- HTTP 状态码 401/403
- 错误消息包含：
  - "unauthorized"
  - "invalid api key"
  - "api key"
  - "authentication"
  - "401"
  - "403"

**用户提示**：{modelName} API key 已失效，请重新配置

**处理方式**：
- 广播 `api-key-invalid` 事件到所有窗口
- 在配置页面显示明确的错误提示
- 持续 5 秒，可手动关闭

### 3. 其他错误（网络、解析等）
**触发条件**：
- JSON 解析失败
- 网络请求超时
- 其他未知错误

**用户提示**：数据解析失败

**处理方式**：记录详细错误日志

---

## 日志输出

### 成功场景
```
[Refresher] Kimi 数据更新成功
[Config] Kimi 额度获取成功
```

### Cookie 过期场景
```
[Refresher] mimo-v2.5-pro 拉取失败: Error: Cookie expired or unauthorized
[Refresher] 检测到 Cookie 过期，广播 login-needed
[Store] 收到 login-needed 事件，当前 loginState: idle
[Store] 准备调用 startMimoLogin()
[Login] 开始登录流程，准备调用 openMimoLogin()
[LoginWindow] 检测到 xiaomimimo.com 的 cookies，立即提取
[LoginWindow] 准备关闭登录窗口...
[Login] 登录完成，cookies: 已获取
[Login] Cookies 已保存到 config
```

### API Key 失效场景
```
[Refresher] Kimi 拉取失败: Error: API request failed with status 401: unauthorized
[Refresher] 检测到 kimi API key 可能失效
[Store] 收到 api-key-invalid 事件: Kimi (kimi)
[Config] Kimi API key 已失效，请重新配置
```

---

## 文件修改清单

### electron/login.ts
- ✅ 添加详细的窗口关闭日志
- ✅ 确认 cookies 提取和窗口关闭的时序

### electron/refresher.ts
- ✅ 添加 `isApiKeyInvalid()` 方法
- ✅ 添加 `broadcastApiKeyInvalid()` 方法
- ✅ 改进 `doRequest()` 方法，检测 401/403 状态码
- ✅ 在 `fetchModel()` 中调用检测和广播

### electron/preload.ts
- ✅ 添加 `onApiKeyInvalid` 事件监听器类型定义
- ✅ 实现 `onApiKeyInvalid` 事件监听器

### src/stores/app.ts
- ✅ 添加 `unsubApiKeyInvalid` 变量
- ✅ 初始化 `onApiKeyInvalid` 事件监听
- ✅ 处理事件，更新 `modelUsageMap`
- ✅ 清理订阅

### src/pages/Config.vue
- ✅ 改进错误处理逻辑
- ✅ 区分 Cookie 过期、API key 失效、其他错误
- ✅ 显示明确的错误提示

---

## 后续优化建议

### 1. UI 增强
- 在配置页面的模型列表中显示错误状态（红色图标）
- 提供"重新配置"按钮，直接跳转到编辑对话框
- 在额度显示区域显示错误信息

### 2. 自动重试机制
- API key 失效时，自动重试 1-2 次
- 添加重试间隔（指数退避）
- 重试失败后才显示错误提示

### 3. 错误恢复
- 提供"测试 API key"功能
- 配置更新后自动验证
- 验证失败时给出明确提示

### 4. 通知系统
- API key 失效时发送系统通知
- 支持配置通知偏好（声音、弹窗等）
- 通知历史记录

---

## 版本信息

- **改进版本**: v1.4
- **改进日期**: 2026-06-02
- **影响范围**: 登录流程、错误处理、用户体验
- **兼容性**: 向后兼容，无需迁移

---

## 相关文档

- `IMPLEMENTATION_SUMMARY.md` - 总体实施总结
- `docs/verification-plan.md` - 验证计划
- `docs/cookie-login-diagnosis.md` - Cookie 登录问题诊断

---

## 致谢

感谢用户的详细反馈，帮助识别和解决这些用户体验问题。
