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
  if (percent >= 90) return '#f87171'
  if (percent >= 70) return '#fbbf24'
  return '#22d3ee'
}

export function formatResetTime(timeStr: string): string {
  try {
    const date = new Date(timeStr)
    const now = new Date()
    const diff = date.getTime() - now.getTime()

    if (diff <= 0) return '即将重置'

    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

    if (hours > 24) {
      const days = Math.floor(hours / 24)
      return `${days}天${hours % 24}时后`
    }
    if (hours > 0) return `${hours}时${minutes}分后`
    return `${minutes}分后`
  } catch {
    return timeStr
  }
}
