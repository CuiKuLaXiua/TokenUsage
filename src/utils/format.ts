export function formatTokens(tokens: number | undefined | null): string {
  if (tokens == null || isNaN(tokens)) return '-'
  if (tokens >= 1e12) return (tokens / 1e12).toFixed(2) + 'T'
  if (tokens >= 1e8) return (tokens / 1e6).toFixed(2) + 'M'
  if (tokens >= 1e4) return (tokens / 1e3).toFixed(2) + 'K'
  return tokens.toLocaleString('zh-CN')
}

export function formatTokensFull(tokens: number | undefined | null): string {
  if (tokens == null || isNaN(tokens)) return '-'
  return tokens.toLocaleString('zh-CN')
}

/** 仅用于图表坐标轴：最大单位为 K，不保留小数 */
export function formatTokensAxis(tokens: number): string {
  if (tokens >= 1000) return Math.floor(tokens / 1000) + 'K'
  return String(tokens)
}

export function formatBalance(balance: number, currency: string = 'CNY'): string {
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency + ' '
  return symbol + balance.toFixed(2)
}

export function formatPercent(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '-'
  return value.toFixed(1)
}

/** WCAG 2.1 相对亮度计算 */
export function getLuminance(hex: string): number {
  const r = parseInt(hex.slice(1, 3), 16) / 255
  const g = parseInt(hex.slice(3, 5), 16) / 255
  const b = parseInt(hex.slice(5, 7), 16) / 255
  const toLinear = (c: number) =>
    c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b)
}

/** WCAG 2.1 对比度 (L1 为较亮色) */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getLuminance(hex1)
  const l2 = getLuminance(hex2)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

export function getProgressColor(percent: number | undefined | null): string {
  if (percent == null || isNaN(percent)) return 'var(--border-light)'
  if (percent >= 90) return 'var(--neon-red)'
  if (percent >= 70) return 'var(--neon-amber)'
  return 'var(--neon-green)'
}

export function getProgressColorHex(percent: number): string {
  if (percent >= 90) return '#d4776a'
  if (percent >= 70) return '#d4a855'
  return '#7cc48a'
}

export function getProgressColorSmooth(percent: number | undefined | null): string {
  if (percent == null || isNaN(percent)) return 'var(--border-light)'
  const t = Math.min(100, Math.max(0, percent)) / 100
  // OKLCH 感知均匀插值: 0% → 绿 → 50% → 琥珀 → 100% → 红
  const l = t < 0.5
    ? 0.68 + (0.72 - 0.68) * (t / 0.5)
    : 0.72 + (0.62 - 0.72) * ((t - 0.5) / 0.5)
  const c = t < 0.5
    ? 0.17 + (0.15 - 0.17) * (t / 0.5)
    : 0.15 + (0.22 - 0.15) * ((t - 0.5) / 0.5)
  const h = t < 0.5
    ? 142 - (142 - 85) * (t / 0.5)
    : 85 - (85 - 25) * ((t - 0.5) / 0.5)
  return `oklch(${l.toFixed(2)} ${c.toFixed(2)} ${Math.round(h)})`
}

export function formatResetTime(timeStr: string): string {
  try {
    const date = new Date(timeStr)
    const now = new Date()
    const diff = date.getTime() - now.getTime()

    if (diff <= 0) return '即将重置'

    const totalMinutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60
    const days = Math.floor(hours / 24)
    const remainHours = hours % 24

    if (days > 0) {
      if (remainHours > 0) {
        return `${days}天${remainHours}时后`
      }
      return `${days}天后`
    }
    if (hours > 0) {
      if (minutes > 0) {
        return `${hours}时${minutes}分后`
      }
      return `${hours}时后`
    }
    return `${minutes}分后`
  } catch {
    return timeStr
  }
}

/** OpenCode totalCost 格式化（API 单位为 1e-8 美元） */
export function formatCost(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '-'
  const dollars = value / 1e8
  return '$' + dollars.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 })
}

/** OpenCode 图表坐标轴花费格式化 */
export function formatCostAxis(value: number): string {
  const dollars = value / 1e8
  if (dollars >= 1) return '$' + dollars.toFixed(0)
  if (dollars >= 0.01) return '$' + dollars.toFixed(2)
  return '$' + dollars.toFixed(4)
}
