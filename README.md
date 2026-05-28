# Token Usage - AI模型用量监控工具

一个桌面端应用程序，用于监控和管理各种AI模型的token使用量和费用。

## 功能特性

- **多模型支持**：支持OpenAI、Claude、DeepSeek、Kimi、MIMO等主流AI模型
- **实时监控**：实时跟踪token使用量和费用
- **数据可视化**：丰富的图表展示用量趋势和分布
- **主题切换**：支持浅色/深色主题切换
- **数据导出**：支持CSV、JSON格式导出
- **预算管理**：设置预算和预警阈值
- **本地存储**：数据安全存储在本地

## 技术栈

- **前端框架**：Vue 3 + TypeScript
- **桌面框架**：Electron
- **UI组件库**：Element Plus
- **图表库**：ECharts
- **状态管理**：Pinia
- **构建工具**：Vite

## 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 构建应用

```bash
npm run build
```

### 打包Electron应用

```bash
npm run electron:build
```

## 项目结构

```
TokenUsage/
├── electron/               # Electron主进程
│   ├── main.ts            # 主进程入口
│   └── preload.ts         # 预加载脚本
├── src/                   # Vue前端应用
│   ├── components/        # 通用组件
│   ├── pages/             # 页面组件
│   ├── services/          # API服务
│   ├── stores/            # 状态管理
│   └── styles/            # 全局样式
├── data/                  # 本地数据存储
└── config/                # 配置文件
```

## 使用说明

### 配置模型

1. 打开应用后，进入"配置管理"页面
2. 点击"添加模型"按钮
3. 填写模型信息（名称、API地址、API密钥等）
4. 设置token价格
5. 保存配置

### 查看用量

1. 在"仪表盘"页面查看总览信息
2. 在"用量详情"页面查看详细记录
3. 使用筛选功能查看特定时间段或模型的数据

### 导出数据

1. 进入"数据导出"页面
2. 选择导出格式（CSV/JSON）
3. 设置时间范围
4. 点击"导出数据"

## 数据存储

应用数据存储在用户主目录下的`.token-usage`文件夹中：

- `config.json`：用户配置
- `usage/`：按月存储的用量数据

## 开发说明

### 添加新模型支持

在`src/services/api.ts`中添加新的API调用方法：

```typescript
private async fetchNewModelUsage(model: ModelConfig, startDate: Date, endDate: Date): Promise<APIResponse> {
  // 实现新模型的API调用
}
```

### 自定义主题

在`src/styles/`目录下修改CSS变量：

```css
:root {
  --primary-color: #409eff;
  --bg-color: #ffffff;
  /* ... */
}
```

## 许可证

MIT License
