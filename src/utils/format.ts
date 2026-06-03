export function formatTokens(tokens: number | undefined | null): string {
  if (tokens == null || isNaN(tokens)) return '-'
  if (tokens >= 1e12) return (tokens / 1e12).toFixed(2) + 'T'
  if (tokens >= 1e8) return (tokens / 1e6).toFixed(2) + 'M'
  if (tokens >= 1e4) return (tokens / 1e3).toFixed(2) + 'K'
  return tokens.toLocaleString('zh-CN')
}

export function formatBalance(balance: number, currency: string = 'CNY'): string {
  const symbol = currency === 'CNY' ? '¥' : currency === 'USD' ? '$' : currency + ' '
  return symbol + balance.toFixed(2)
}

export function formatPercent(value: number | undefined | null): string {
  if (value == null || isNaN(value)) return '-'
  return value.toFixed(1)
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
