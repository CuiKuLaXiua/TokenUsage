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
