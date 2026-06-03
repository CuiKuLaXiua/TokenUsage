# 验证计划

## 已完成的修改

### 1. ✅ 添加 show-main-window IPC handler
**文件**: `electron/main.ts`
- 添加了 mainWindow 的 closed 事件清理引用
- 添加了 show-main-window IPC handler，支持：
  - 窗口不存在或已销毁时重新创建
  - 窗口最小化时恢复
  - 窗口存在时显示并聚焦

### 2. ✅ 暴露 showMainWindow preload API
**文件**: `electron/preload.ts`
- 在 ElectronAPI interface 中添加了 showMainWindow 方法
- 在 implementation 中添加了对应的 ipcRenderer.invoke 调用

### 3. ✅ 添加悬浮窗双击事件
**文件**: `src/pages/FloatWindow.vue`
- 在根元素添加了 @dblclick="onDoubleClick"
- 实现了 onDoubleClick 函数，只响应左键双击且非拖拽状态
- 调用 window.electronAPI.showMainWindow()

### 4. ✅ 修复 Cookie 过期自动登录
**文件**: `src/stores/app.ts`
- 修改了 login-needed 事件处理器
- 自动调用 startMimoLogin() 触发登录流程

## 验证步骤

### 测试1: Cookie 过期自动登录

**步骤**:
```bash
# 1. 启动开发服务器
npm run dev

# 2. 在配置页面添加 MIMO 模型，使用过期的 cookie
# 3. 点击"获取额度"按钮触发手动刷新

# 或者：
# 在终端观察日志输出，应该看到：
# [Refresher] 检测到 Cookie 过期，广播 login-needed
# [Store] 收到 login-needed 事件，自动启动登录流程
```

**期望结果**:
- ✅ 自动弹出 MiMo 登录窗口
- ✅ 不会出现"Cookie expired"错误后无响应
- ✅ 用户可以完成登录流程

### 测试2: 悬浮窗双击打开主窗口

**步骤**:
```bash
# 1. 启动开发服务器
npm run dev

# 2. 打开悬浮窗（通过菜单或快捷键）
# 3. 双击悬浮窗

# 测试场景：
# 场景A: 主窗口关闭状态
# 场景B: 主窗口最小化状态
# 场景C: 主窗口最大化状态
# 场景D: 多次快速双击
```

**期望结果**:
- ✅ 双击后主窗口被打开/显示/聚焦
- ✅ 主窗口最小化时双击会恢复窗口
- ✅ 多次双击不会打开多个主窗口
- ✅ 拖拽悬浮窗后松开不会触发双击
- ✅ 右键悬浮窗不会触发双击

### 测试3: 边界情况验证

**步骤**:
```bash
# 1. 验证主窗口关闭后双击悬浮窗
#    - 主窗口应该被重新创建

# 2. 验证主窗口已在前台时双击
#    - 主窗口应该保持在前台

# 3. 验证快速拖拽后松开
#    - 不应该触发双击事件

# 4. 验证右键菜单打开时双击
#    - 应该关闭菜单，不触发双击
```

**期望结果**:
- ✅ 所有边界情况都得到正确处理
- ✅ 没有内存泄漏或未清理的事件监听器
- ✅ 没有重复创建窗口的问题

## 潜在问题检查

### 1. 事件冲突检查
检查 @dblclick 和 @mousedown 是否有冲突：
- mousedown 开始拖拽
- mouseup 结束拖拽
- dblclick 在 mouseup 后触发
- 通过 hasMoved 状态区分拖拽和双击 ✅

### 2. 窗口生命周期检查
- mainWindow 关闭时设置为 null ✅
- show-main-window 检查 isDestroyed() ✅
- 防止重复创建窗口 ✅

### 3. 登录流程检查
- startMimoLogin() 有防重复调用保护 ✅
- loginState 状态正确更新 ✅
- 登录完成后自动恢复状态 ✅

## 性能考虑

### 事件监听器清理
- ✅ onDoubleClick 使用内联函数，无需清理
- ✅ IPC 事件在 onUnmounted 时清理
- ✅ 拖拽事件在 mouseup 时清理

### 窗口创建开销
- ✅ show-main-window 优先使用现有窗口
- ✅ 只在必要时创建新窗口
- ✅ 使用 focus() 而不是重新加载

## 安全性检查

### IPC 通信安全
- ✅ 所有 IPC 都通过 preload 桥接
- ✅ 使用 contextIsolation: true
- ✅ 没有暴露敏感的 Node.js API

### 状态管理安全
- ✅ 登录状态有防重入保护
- ✅ 窗口状态检查 isDestroyed()
- ✅ 事件监听器正确清理

## 回归测试

### 需要验证的现有功能
1. 悬浮窗拖拽功能
2. 悬浮窗右键菜单
3. 悬浮窗详情弹窗
4. 主窗口最小化/最大化/关闭
5. 自动刷新功能
6. 手动刷新功能

### 验证命令
```bash
# 运行完整测试
npm run dev

# 在浏览器中打开 DevTools
# 检查控制台是否有错误
# 测试所有交互场景
```

## 提交准备

### 提交信息建议
```
feat: add double-click to open main window and fix auto-login on cookie expiry

- Add show-main-window IPC handler with window state management
- Add showMainWindow preload API
- Implement double-click event on float window
- Fix login-needed handler to auto-trigger login flow
- Add mainWindow closed event cleanup
- Prevent multiple main window creation
```

### 修改文件列表
- electron/main.ts (IPC handler)
- electron/preload.ts (preload API)
- src/pages/FloatWindow.vue (double-click event)
- src/stores/app.ts (login flow fix)

## 后续优化建议

### 1. 用户反馈
- 双击时可以添加短暂的视觉反馈（如闪烁）
- 登录弹窗时可以显示通知

### 2. 错误处理
- show-main-window 失败时的错误提示
- 登录失败时的重试机制

### 3. 性能优化
- 窗口创建的懒加载
- IPC 调用的防抖处理

## 总结

所有修改已完成并通过构建验证。代码质量良好，没有引入新的安全风险。建议进行完整的功能测试后提交。
