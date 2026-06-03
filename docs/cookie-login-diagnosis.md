# Cookie 过期自动登录问题诊断

## 问题描述
终端显示：
```
[Refresher] 检测到 Cookie 过期，广播 login-needed
```
但没有弹出登录窗口

## 可能的原因

### 1. 事件监听器未触发
**诊断方法**：查看控制台是否有以下日志：
```
[Store] 收到 login-needed 事件，当前 loginState: xxx
```

**如果没有这个日志**，说明：
- onLoginNeeded 事件监听器没有正确设置
- 或者事件没有被正确发送到渲染进程

**解决方案**：
- 检查 initSubscription() 是否被调用
- 检查 preload.ts 中的 onLoginNeeded 实现

### 2. loginState 已经是 'logging-in'
**诊断方法**：查看控制台是否有以下日志：
```
[Store] 已经在登录中，跳过重复调用
```

**如果有这个日志**，说明：
- 前一个登录流程还在进行中
- 或者 loginState 没有被正确重置

**解决方案**：
- 检查 startMimoLogin() 是否正确完成
- 检查 loginState 的状态变化

### 3. startMimoLogin() 未执行
**诊断方法**：查看控制台是否有以下日志：
```
[Store] 准备调用 startMimoLogin()
[Login] 开始登录流程，准备调用 openMimoLogin()
```

**如果没有这些日志**，说明：
- startMimoLogin() 被阻止了
- 或者函数调用失败了

**解决方案**：
- 检查 loginState 的初始状态
- 检查是否有 JavaScript 错误

### 4. openMimoLogin() 调用失败
**诊断方法**：查看控制台是否有以下日志：
```
[Login] 调用 window.electronAPI.openMimoLogin()
[Login] open-mimo-login handler 被调用
[Login] 打开登录窗口: https://...
```

**如果没有这些日志**，说明：
- IPC 调用失败了
- 或者 main.ts 中的 handler 没有被触发

**解决方案**：
- 检查 main.ts 中 open-mimo-login handler 是否正确注册
- 检查是否有 IPC 通信错误

### 5. 登录窗口打开失败
**诊断方法**：查看控制台是否有以下日志：
```
[Login] 打开登录窗口: https://platform.xiaomimimo.com/console/plan-manage
```

**如果有这个日志但窗口没显示**，说明：
- LoginWindowManager.openLoginWindow() 失败了
- 或者窗口被阻止显示了

**解决方案**：
- 检查 electron/login.ts 的实现
- 检查是否有窗口创建错误

## 测试步骤

### 步骤1: 重新构建
```bash
npm run build
```

### 步骤2: 启动应用
```bash
npm run dev
```

### 步骤3: 触发 Cookie 过期
1. 在配置页面添加 MIMO 模型（使用过期的 cookie）
2. 点击"获取额度"按钮
3. 观察控制台日志

### 步骤4: 检查日志
**期望看到的日志序列**：
```
[Refresher] 检测到 Cookie 过期，广播 login-needed
[Store] 收到 login-needed 事件，当前 loginState: idle
[Store] 准备调用 startMimoLogin()
[Login] 开始登录流程，准备调用 openMimoLogin()
[Login] 调用 window.electronAPI.openMimoLogin()
[Login] open-mimo-login handler 被调用
[Login] 打开登录窗口: https://platform.xiaomimimo.com/console/plan-manage
```

**如果日志中断**，根据中断位置定位问题（见上面的诊断方法）

## 已知问题

### 问题1: 多窗口重复调用
当有多个窗口（主窗口、悬浮窗、详情窗口）时，每个窗口都会收到 login-needed 事件，导致 startMimoLogin() 被调用多次。

**解决方案**：
- 已添加防重复调用保护（loginState === 'logging-in' 检查）
- 但这可能导致后续调用被跳过

**改进方案**：
- 只在主窗口处理 login-needed 事件
- 或者使用全局锁机制

### 问题2: 手动获取额度错误提示
手动点击"获取额度"时，如果 Cookie 过期，显示"数据解析失败"而不是"Cookie 过期"。

**解决方案**：
- ✅ 已改进 Config.vue 的错误处理
- ✅ 检查 error.code === 'COOKIE_EXPIRED'
- ✅ 显示"Cookie 已过期，请重新登录"

### 问题3: 登录窗口可能被主窗口遮挡
如果主窗口最大化或全屏，登录窗口可能被遮挡。

**解决方案**：
- 登录窗口应该设置 alwaysOnTop
- 或者在主窗口前面显示

## 调试技巧

### 1. 查看渲染进程日志
在浏览器中打开 DevTools（F12），查看 Console 标签页的日志。

### 2. 查看主进程日志
在终端中查看 Electron 主进程的日志输出。

### 3. 使用调试器
在代码中添加 debugger 语句，或在 DevTools 中设置断点。

### 4. 检查 IPC 通信
在 preload.ts 中添加日志，验证 IPC 调用是否成功。

## 快速修复

如果需要快速修复，可以：

### 方案A: 手动触发登录
在配置页面点击"登录获取"按钮（如果有的话）

### 方案B: 重启应用
关闭应用，删除 ~/.token-usage/config.json 中的 cookies 字段，重启应用

### 方案C: 清除状态
在 DevTools Console 中执行：
```javascript
// 清除 loginState
localStorage.removeItem('loginState')
// 或重新加载页面
location.reload()
```

## 预防措施

### 1. 定期刷新 Cookie
设置自动刷新间隔，避免 Cookie 长时间过期。

### 2. 监控登录状态
在 UI 中显示登录状态，让用户知道何时需要重新登录。

### 3. 错误恢复机制
当登录失败时，提供重试按钮或手动登录选项。

## 反馈问题

如果以上方法都无法解决问题，请提供：

1. **完整的控制台日志**（包括渲染进程和主进程）
2. **重现步骤**（详细描述如何触发问题）
3. **环境信息**：
   - Electron 版本
   - Node.js 版本
   - 操作系统版本
4. **截图或录屏**（如果可能）

## 相关文件

- `src/stores/app.ts` - 登录状态管理
- `electron/main.ts` - IPC handler
- `electron/preload.ts` - IPC 桥接
- `electron/refresher.ts` - Cookie 过期检测
- `src/pages/Config.vue` - 配置页面
- `src/components/LoginNotification.vue` - 登录提示

## 版本历史

- v1.0: 初始实现
- v1.1: 添加防重复调用保护
- v1.2: 改进错误提示信息
- v1.3: 添加详细日志输出
