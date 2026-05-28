const MONTH_REGEX = /^\d{4}-\d{2}$/

const ALLOWED_URL_PREFIXES = [
  'https://platform.xiaomimimo.com',
  'https://api.kimi.com',
  'https://api.deepseek.com'
]

export function isValidMonth(month: unknown): month is string {
  return typeof month === 'string' && MONTH_REGEX.test(month)
}

export function isValidConfig(config: unknown): config is { models: unknown[] } {
  if (typeof config !== 'object' || config === null) return false
  const obj = config as Record<string, unknown>
  if (!Array.isArray(obj.models)) return false
  return obj.models.every((m: unknown) => {
    if (typeof m !== 'object' || m === null) return false
    const model = m as Record<string, unknown>
    return typeof model.id === 'string'
      && typeof model.name === 'string'
      && typeof model.provider === 'string'
  })
}

export function isAllowedUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false
  if (!url.startsWith('https://')) return false
  return ALLOWED_URL_PREFIXES.some(prefix => url.startsWith(prefix))
}

export function isValidUsageData(data: unknown): data is unknown[] {
  return Array.isArray(data)
}
