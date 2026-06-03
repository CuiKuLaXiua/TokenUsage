# API Key 失效通知功能

## 功能概述

当检测到 API key 失效时，系统会：
1. ✅ 弹出友好的通知提示
2. ✅ 询问用户是否需要更新 API key
3. ✅ 提供快捷更新 API key 的窗口
4. ✅ 处理多个模型 API key 同时失效的情况（防扎堆）

---

## 核心特性

### 1. 智能防扎堆机制

**问题场景**：
- 用户添加了多个模型（Kimi、DeepSeek 等）
- 所有模型的 API key 都失效了
- 如果每个模型都单独弹窗，会造成扎堆提示

**解决方案**：
- 使用 1 秒防抖机制，收集所有失效的 API key
- 统一显示在一个通知中
- 用户可以选择：
  - 点击"更新"按钮：更新第一个失效的模型
  - 点击特定模型：直接打开该模型的编辑对话框
  - 点击关闭按钮：忽略通知

### 2. 快捷更新流程

**单个模型失效**：
```
API key 失效
  ↓
弹出通知："Kimi 的 API key 已失效"
  ↓
点击"更新"按钮
  ↓
直接跳转到配置页面并打开 Kimi 的编辑对话框
  ↓
用户更新 API key
  ↓
保存配置
  ↓
自动重新获取额度
```

**多个模型失效**：
```
多个 API key 失效
  ↓
1秒防抖收集所有失效模型
  ↓
弹出通知："3 个模型的 API key 已失效"
  ↓
显示所有失效模型的列表
  ↓
用户点击特定模型（如 DeepSeek）
  ↓
直接跳转到配置页面并打开 DeepSeek 的编辑对话框
  ↓
用户更新 API key
  ↓
保存配置
  ↓
自动重新获取额度
```

---

## 技术实现

### 1. 通知组件（ApiKeyNotification.vue）

#### 核心功能
```typescript
// 监听 modelUsageMap 的变化，收集所有 API key 失效的模型
watch(() => store.modelUsageMap, (newMap) => {
  const failed: FailedModel[] = []

  for (const [modelId, status] of Object.entries(newMap)) {
    if (status?.usageType === 'error' && status?.error?.includes('API key')) {
      const model = store.models.find(m => m.id === modelId)
      if (model) {
        failed.push({
          id: model.id,
          name: model.name,
          provider: model.provider
        })
      }
    }
  }

  if (failed.length > 0) {
    // 防抖处理：延迟显示通知，避免扎堆提示
    if (debounceTimer.value) {
      clearTimeout(debounceTimer.value)
    }
    debounceTimer.value = setTimeout(() => {
      failedModels.value = failed
      visible.value = true
    }, 1000) // 1秒防抖
  } else {
    failedModels.value = []
    visible.value = false
  }
}, { deep: true })
```

#### 更新单个模型
```typescript
function handleUpdateModel(model: FailedModel) {
  // 直接打开特定模型的编辑对话框
  store.editingModelId = model.id
  router.push('/config')
  handleClose()
}
```

#### 更新所有模型（默认第一个）
```typescript
function handleUpdate() {
  // 如果只有一个模型，直接打开编辑对话框
  if (failedModels.value.length === 1) {
    store.editingModelId = failedModels.value[0].id
  }
  // 跳转到配置页面
  router.push('/config')
  handleClose()
}
```

### 2. Store 状态管理（stores/app.ts）

#### 添加 editingModelId 状态
```typescript
const editingModelId = ref<string | null>(null)
```

#### 导出状态
```typescript
return {
  models,
  usageRecords,
  modelUsageMap,
  // ... 其他状态
  editingModelId,  // 新增
  // ... 其他方法
}
```

### 3. 配置页面监听（Config.vue）

#### 自动打开编辑对话框
```typescript
// 监听 editingModelId，自动打开编辑对话框
watch(() => store.editingModelId, (newId) => {
  if (newId) {
    const model = store.models.find(m => m.id === newId)
    if (model) {
      editModel(model)
      // 清除 editingModelId，避免重复触发
      store.editingModelId = null
    }
  }
}, { immediate: true })
```

### 4. App.vue 集成

```vue
<template>
  <AppLayout v-if="!isFloatRoute">
    <router-view />
    <LoginNotification />
    <ApiKeyNotification />  <!-- 新增 -->
  </AppLayout>
  <router-view v-else />
</template>

<script setup lang="ts">
import AppLayout from '@/components/AppLayout.vue'
import LoginNotification from '@/components/LoginNotification.vue'
import ApiKeyNotification from '@/components/ApiKeyNotification.vue'  // 新增
// ...
</script>
```

---

## UI 设计

### 通知样式

#### 单个模型失效
```
┌────────────────────────────────────────────────────┐
│ ⚠️ API Key 已失效                                ✕ │
│                                                    │
│    Kimi 的 API key 已失效                          │
│                                                    │
│                                    [更新] [关闭]   │
└────────────────────────────────────────────────────┘
```

#### 多个模型失效
```
┌────────────────────────────────────────────────────┐
│ ⚠️ API Key 已失效                                ✕ │
│                                                    │
│    3 个模型的 API key 已失效                       │
│                                    [更新] [关闭]   │
│                                                    │
│ 点击更新：                                         │
│ ┌────────────────────────────────────────────┐     │
│ │ Kimi          kimi            ✏️          │     │
│ └────────────────────────────────────────────┘     │
│ ┌────────────────────────────────────────────┐     │
│ │ DeepSeek      deepseek        ✏️          │     │
│ └────────────────────────────────────────────┘     │
│ ┌────────────────────────────────────────────┐     │
│ │ MIMO Pro      mimo            ✏️          │     │
│ └────────────────────────────────────────────┘     │
└────────────────────────────────────────────────────┘
```

### 交互效果

#### 鼠标悬停
- 模型项背景变深
- 轻微向右移动（translateX(4px)）
- 显示编辑图标（✏️）

#### 点击模型
- 跳转到配置页面
- 自动打开该模型的编辑对话框
- 通知自动关闭（带滑出动画）

#### 点击"更新"按钮
- 单个模型：直接打开编辑对话框
- 多个模型：跳转到配置页面（用户手动选择）

#### 点击"关闭"按钮
- 关闭通知
- 不执行任何操作

---

## 测试场景

### 场景 1: 单个模型 API key 失效

**前提条件**：
- 只添加了 Kimi 模型
- Kimi API key 已失效

**操作步骤**：
1. 点击"获取额度"按钮
2. 等待 1 秒

**预期结果**：
- ✅ 弹出通知："Kimi 的 API key 已失效"
- ✅ 显示"更新"按钮
- ✅ 点击"更新"后跳转到配置页面
- ✅ 自动打开 Kimi 的编辑对话框
- ✅ API key 输入框获得焦点

### 场景 2: 多个模型 API key 失效

**前提条件**：
- 添加了 Kimi、DeepSeek、MIMO 三个模型
- 所有 API key 都失效

**操作步骤**：
1. 点击"获取额度"按钮
2. 等待 1 秒

**预期结果**：
- ✅ 弹出通知："3 个模型的 API key 已失效"
- ✅ 显示所有失效模型的列表
- ✅ 每个模型项都可以点击
- ✅ 点击特定模型后跳转到配置页面
- ✅ 自动打开该模型的编辑对话框
- ✅ 其他模型的通知不会同时弹出（防扎堆）

### 场景 3: 部分模型 API key 失效

**前提条件**：
- 添加了 Kimi、DeepSeek、MIMO 三个模型
- 只有 Kimi 和 DeepSeek 的 API key 失效
- MIMO 的 cookie 有效

**操作步骤**：
1. 点击"获取全部额度"按钮
2. 等待 1 秒

**预期结果**：
- ✅ 弹出通知："2 个模型的 API key 已失效"
- ✅ 显示 Kimi 和 DeepSeek
- ✅ MIMO 正常获取额度，不显示在通知中
- ✅ 点击 Kimi 后只打开 Kimi 的编辑对话框

### 场景 4: Cookie 过期 + API key 失效

**前提条件**：
- MIMO 模型的 cookie 过期
- Kimi 的 API key 失效

**操作步骤**：
1. 点击"获取全部额度"按钮
2. 等待 1 秒

**预期结果**：
- ✅ 弹出登录窗口（MIMO 自动登录）
- ✅ 弹出通知："Kimi 的 API key 已失效"
- ✅ 两个通知互不干扰
- ✅ 用户可以同时处理两个问题

### 场景 5: 快速连续点击

**前提条件**：
- 多个模型 API key 失效

**操作步骤**：
1. 快速连续点击"获取额度"按钮 5 次

**预期结果**：
- ✅ 只弹出一个通知（防抖机制）
- ✅ 通知显示所有失效模型
- ✅ 不会出现多个通知堆叠
- ✅ 不会造成性能问题

---

## 日志输出

### 单个模型失效
```
[Refresher] Kimi 拉取失败: Error: API request failed with status 401: unauthorized
[Refresher] 检测到 kimi API key 可能失效
[Store] 收到 api-key-invalid 事件: Kimi (kimi)
[ApiKeyNotification] 检测到 API key 失效，1秒后显示通知
[ApiKeyNotification] 显示通知：1 个模型
```

### 多个模型失效
```
[Refresher] Kimi 拉取失败: Error: API request failed with status 401: unauthorized
[Refresher] 检测到 kimi API key 可能失效
[Store] 收到 api-key-invalid 事件: Kimi (kimi)
[Refresher] DeepSeek 拉取失败: Error: API request failed with status 401: unauthorized
[Refresher] 检测到 deepseek API key 可能失效
[Store] 收到 api-key-invalid 事件: DeepSeek (deepseek)
[ApiKeyNotification] 检测到 API key 失效，1秒后显示通知
[ApiKeyNotification] 显示通知：2 个模型
```

### 用户点击更新
```
[ApiKeyNotification] 用户点击更新：Kimi
[Config] 自动打开编辑对话框：Kimi
```

---

## 文件清单

### 新增文件
- `src/components/ApiKeyNotification.vue` - API key 失效通知组件

### 修改文件
- `src/App.vue` - 集成通知组件
- `src/stores/app.ts` - 添加 editingModelId 状态
- `src/pages/Config.vue` - 监听 editingModelId 并自动打开编辑对话框
- `electron/refresher.ts` - 增强 API key 失效检测和广播
- `electron/preload.ts` - 添加 api-key-invalid 事件监听器

---

## 核心优势

### 1. 用户体验优化
- ✅ 非阻塞式通知，不影响用户操作
- ✅ 提供快捷更新入口，减少操作步骤
- ✅ 防扎堆机制，避免通知轰炸
- ✅ 清晰的视觉反馈和动画效果

### 2. 智能化处理
- ✅ 自动检测 API key 失效
- ✅ 统一收集多个失效情况
- ✅ 1秒防抖，给系统足够时间收集
- ✅ 智能路由到配置页面

### 3. 可扩展性
- ✅ 支持任意数量的模型
- ✅ 支持不同的 provider 类型
- ✅ 易于添加新的错误类型
- ✅ 组件化设计，易于维护

### 4. 性能优化
- ✅ 防抖机制避免频繁更新
- ✅ 按需加载，不阻塞主线程
- ✅ 动画使用 CSS transform，性能好
- ✅ 及时清理定时器，避免内存泄漏

---

## 后续优化建议

### 1. 通知历史
- 保存通知历史记录
- 用户可以查看历史通知
- 支持重新触发通知

### 2. 批量操作
- 支持"全部更新"功能
- 批量验证 API key
- 批量导入/导出配置

### 3. 自动重试
- API key 失效后自动重试 1-2 次
- 指数退避策略
- 重试失败后才显示通知

### 4. 系统通知
- 支持操作系统原生通知
- 声音提示
- 通知中心集成

### 5. 错误诊断
- 提供详细的错误信息
- 给出解决建议
- 链接到官方文档

---

## 版本信息

- **功能版本**: v1.5
- **实现日期**: 2026-06-02
- **依赖**: Vue 3, Vue Router, Pinia, Element Plus
- **兼容性**: 完全向后兼容

---

## 相关文档

- `IMPROVEMENTS_v1.4.md` - 基础改进（Cookie 过期、API key 检测）
- `IMPLEMENTATION_SUMMARY.md` - 总体实施总结
- `docs/verification-plan.md` - 验证计划
- `docs/cookie-login-diagnosis.md` - Cookie 登录问题诊断

---

## 致谢

感谢用户的详细需求说明，帮助我们实现了这个用户友好的 API key 管理功能。
