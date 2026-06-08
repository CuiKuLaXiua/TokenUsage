// 供应商用量详情页的共享类型定义

/** MiMo 每日用量项 */
export interface MimoDailyItem {
  date: string
  model: string
  provider: 'mimo'
  totalToken: number
  inputHitToken: number
  inputMissToken: number
  outputToken: number
  requestCount: number
  inputAudioDuration: number
}

/** OpenCode 每日用量项 */
export interface OpenCodeDailyItem {
  date: string
  model: string
  provider: 'opencode'
  totalCost: number
  keyId: string
  keyName: string
  plan: string
  inputTokens: number
  outputTokens: number
  reasoningTokens: number
  cacheReadTokens: number
  totalTokens: number
}

/** 联合类型：所有供应商的每日用量项 */
export type DailyUsageItem = MimoDailyItem | OpenCodeDailyItem

/** ECharts 图表主题色（由 useChartTheme composable 计算） */
export interface ChartThemeColors {
  isDark: boolean
  accentHex: string
  tooltipBg: string
  tooltipText: string
  tooltipBorder: string
  axisColor: string
  splitLineColor: string
  pointerShadow: string
}

/** 面板暴露给父组件的方法接口 */
export interface UsagePanelExpose {
  refresh(): void
}
