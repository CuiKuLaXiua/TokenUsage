# Token Usage

<h4 align="center">优雅的 AI 模型用量监控桌面工具</h4>

<p align="center">
  <img src="public/logo.png" alt="Token Usage Logo" width="120" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Vue-3.3-4FC08D?logo=vuedotjs&logoColor=fff" alt="Vue" />
  <img src="https://img.shields.io/badge/Electron-28-47848F?logo=electron&logoColor=fff" alt="Electron" />
  <img src="https://img.shields.io/badge/TypeScript-5.3-3178C6?logo=typescript&logoColor=fff" alt="TypeScript" />
  <img src="https://img.shields.io/badge/ECharts-6.1-AA344D?logo=apacheecharts&logoColor=fff" alt="ECharts" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/version-1.0.0-blue" alt="Version" />
</p>

---

## ✨ 特性

<table>
  <tr>
    <td width="50%">
      <h4>📊 多模型支持</h4>
      <p>一站式监控 <strong>MiMo</strong>、<strong>OpenCode</strong>、<strong>Kimi</strong>、<strong>DeepSeek</strong> 等主流 AI 平台的 Token 用量与额度余额，支持自定义扩展。</p>
    </td>
    <td width="50%">
      <h4>🪟 智能悬浮窗</h4>
      <p>可拖拽的迷你监控窗口，支持<strong>屏幕边缘吸附</strong>与鼠标悬停弹出，不影响工作流的优雅存在。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🎨 深度主题定制</h4>
      <p><strong>Midnight Pro</strong>、<strong>Aurora</strong>、<strong>Default</strong> 三套预设主题，<strong>Forest / Moss / Matcha</strong> 三种强调色，明暗双模自由切换。</p>
    </td>
    <td>
      <h4>📈 数据可视化</h4>
      <p>基于 ECharts 的 Token 环形图、用量趋势、分布饼图，直观掌握消耗全貌。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🔄 自动刷新</h4>
      <p>可配置的定时刷新策略，下拉即得最新数据；统一刷新管理，一键拉取所有模型状态。</p>
    </td>
    <td>
      <h4>📦 灵活导出</h4>
      <p>支持 <strong>CSV</strong> / <strong>JSON</strong> 格式导出，MiMo 月度明细与 OpenCode 调用记录均可完整导出。</p>
    </td>
  </tr>
  <tr>
    <td>
      <h4>🔔 系统托盘集成</h4>
      <p>最小化到托盘、快捷菜单切换主题 / 刷新数据 / 开关悬浮窗，后台常驻不打扰。</p>
    </td>
    <td>
      <h4>🔐 安全认证</h4>
      <p>内置登录窗口管理，Cookie / API Key 双重认证，过期自动提醒，数据全程本地存储。</p>
    </td>
  </tr>
</table>

---

## 🖥️ 界面预览

| Dashboard | Config | Float Window |
|:---:|:---:|:---:|
| 仪表盘总览 · Token 环形图 · 模型卡片 | 模型管理 · 拖拽排序 · 自动刷新配置 | 迷你浮窗 · 边缘吸附 · 右键菜单 |

> 💡 浮窗支持靠左/靠右/靠顶三条边吸附，鼠标悬停即弹出，移开自动收回。

---

## 🛠️ 技术栈

| 分层 | 技术选型 |
|:---|:---|
| **前端框架** | Vue 3 (Composition API) + TypeScript |
| **桌面框架** | Electron 28 — 主进程 / 渲染进程 / Preload 安全隔离 |
| **UI 组件库** | Element Plus + 自定义玻璃拟态组件 |
| **数据可视化** | ECharts 6 + vue-echarts |
| **状态管理** | Pinia |
| **路由** | Vue Router 4 |
| **构建工具** | Vite 5 |
| **打包分发** | electron-builder — NSIS (Windows) / DMG (macOS) / AppImage (Linux) |

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18
- **npm** ≥ 9
- **Windows** 10+ / **macOS** 12+ / **Linux** (X11/Wayland)

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

启动后 Electron 窗口自动打开，支持 Vite HMR 热更新。

### 构建生产版本

```bash
npm run build
```

### 打包桌面应用

```bash
npm run electron:build
```

构建产物位于 `dist/` 目录，安装包位于 `release/` 目录。

---

## 📁 项目结构

```
TokenUsage/
├── electron/                  # Electron 主进程
│   ├── main.ts                # 主进程入口 · 窗口管理 · IPC 注册 · 刷新调度
│   ├── preload.ts             # 预加载脚本 · contextBridge API 暴露
│   ├── ipc-validators.ts      # IPC 输入校验
│   ├── login.ts               # MiMo 登录窗口管理
│   ├── opencode-login.ts      # OpenCode 登录窗口管理
│   └── refresher.ts           # 统一用量刷新调度器
├── src/                       # Vue 渲染进程
│   ├── components/            # 通用组件 (17 个)
│   │   ├── AppLayout.vue      # 应用布局 · 自定义标题栏 · 导航
│   │   ├── TokenRing.vue      # Token 环形进度图
│   │   ├── BalanceCard.vue    # 余额信息卡片
│   │   ├── FloatModelCard.vue # 浮窗模型卡片
│   │   ├── GlowBorder.vue     # 发光边框效果
│   │   ├── ParticleBg.vue     # 粒子背景动画
│   │   └── ...
│   ├── pages/                 # 页面组件 (10 个)
│   │   ├── Dashboard.vue      # 仪表盘 · 用量总览
│   │   ├── Config.vue         # 模型配置 · 拖拽排序
│   │   ├── Usage.vue          # 用量详情 · 图表分析
│   │   ├── Export.vue         # 数据导出 · CSV/JSON
│   │   ├── FloatWindow.vue    # 悬浮窗主视图
│   │   ├── FloatDetail.vue    # 悬浮详情弹窗
│   │   ├── FloatStrip.vue     # 边缘吸附指示条
│   │   └── CtxMenu.vue        # 右键快捷菜单
│   ├── composables/           # 组合式函数
│   │   ├── useChartTheme.ts   # ECharts 主题适配
│   │   ├── useUsageAggregation.ts  # 用量聚合计算
│   │   └── useMonthDays.ts    # 月度日期工具
│   ├── services/              # 服务层
│   │   ├── api.ts             # 多平台 API 调用 · 数据解析
│   │   └── storage.ts         # 本地存储读写
│   ├── stores/                # 状态管理
│   │   ├── app.ts             # 应用核心状态 · 模型 · 用量
│   │   └── theme.ts           # 主题状态 · 预设 · 强调色
│   └── styles/                # 全局样式
│       └── theme.css          # 主题 CSS 变量 · 预设定义
├── data/                      # 本地数据存储 (~/.token-usage)
├── build/                     # 构建资源 · 图标
├── public/                    # 静态资源
└── scripts/                   # 辅助脚本
```

---

## 🎯 支持平台

| 提供商 | 用量类型 | 数据明细 | 状态 |
|:---|:---|:---|:---:|
| **MiMo** (小米) | Token 总量 · 月度用量 | 日用量 · 调用明细 | ✅ |
| **OpenCode** | Token 总量 · 月度用量 | 日用量 · 调用记录 | ✅ |
| **Kimi** (月之暗面) | 多级 Tier 百分比 | — | ✅ |
| **DeepSeek** | 余额查询 | — | ✅ |
| **自定义 API** | 兼容 OpenAI 格式 | — | 🔧 |

---

## ⚙️ 配置说明

### 添加模型

1. 进入 **配置管理** 页面
2. 点击 **添加模型**，选择提供商类型
3. 填写 API 地址、Key / Cookie 等认证信息
4. 设置 Token 单价（用于成本计算）
5. 可选：配置自动刷新间隔

### 悬浮窗操作

| 操作 | 手势 |
|:---|:---|
| 拖拽移动 | 按住悬浮窗任意位置拖动 |
| 右键菜单 | 在悬浮窗上右键点击 |
| 边缘吸附 | 拖到屏幕边缘自动吸附 |
| 贴边弹出 | 鼠标悬停在吸边指示条上 |
| 查看详情 | 点击模型卡片展开详情弹窗 |

### 主题切换

通过 **右键菜单** 或 **托盘菜单** 快速切换：

- 🖤 **Midnight Pro** — 深邃暗色调，推荐主力使用
- 🌌 **Aurora** — 极光紫调暗色
- ☀️ **Default** — 明亮浅色

---

## 🔧 环境变量

创建 `.env.local` 文件配置默认模型：

```env
# MiMo 默认配置
MIMO_API_KEY=your_api_key_here
MIMO_COOKIES=your_cookies_here
MIMO_BASE_URL=https://platform.xiaomimimo.com/api/v1/tokenPlan/usage
```

---

## 🏗️ 构建产物

| 平台 | 格式 |
|:---|:---|
| **Windows** | `.exe` (NSIS 安装包) · `.zip` (便携版) |
| **macOS** | `.dmg` · `.zip` |
| **Linux** | `.AppImage` · `.zip` |

---

## 📄 许可证

本项目基于 [MIT License](LICENSE) 开源。

---

<p align="center">
  <sub>Built with ❤️ using Vue 3 · Electron · TypeScript</sub>
</p>
