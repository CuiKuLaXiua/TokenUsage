import type { ModelConfig } from '@/stores/app'

/** Provider 颜色映射（用于图表和标签） */
export const PROVIDER_COLORS: Record<string, string> = {
  mimo: '#d4a855',
  kimi: '#b8a088',
  deepseek: '#7cc48a',
  opencode: '#6b9e7a',
}

export function providerColor(provider: string): string {
  return PROVIDER_COLORS[provider] || 'var(--text-tertiary)'
}

/** OpenCode baseUrl 参数提取结果 */
export interface OpenCodeParams {
  workspaceId: string
  dailyServerId: string
  recordsServerId: string
  dailyServerInstance: string
  recordsServerInstance: string
}

/** 从 OpenCode 模型配置中提取 API 请求所需的参数 */
export function extractOpencodeParams(model: ModelConfig): OpenCodeParams {
  let workspaceId = ''
  if (model.baseUrl) {
    try {
      const u = new URL(model.baseUrl)
      const argsStr = u.searchParams.get('args') || ''
      if (argsStr) {
        const args = JSON.parse(argsStr)
        workspaceId = args?.t?.a?.[0]?.s || ''
      }
    } catch {}
  }

  const dailyServerId = model.dailyServerId || model.serverId || ''
  const recordsServerId = model.recordsServerId || model.dailyServerId || model.serverId || ''

  let fallbackServerId = ''
  if (model.baseUrl) {
    try {
      const u = new URL(model.baseUrl)
      fallbackServerId = u.searchParams.get('id') || ''
    } catch {}
  }

  return {
    workspaceId,
    dailyServerId: dailyServerId || fallbackServerId,
    recordsServerId: recordsServerId || fallbackServerId,
    dailyServerInstance: model.dailyServerInstance || model.serverInstance || model.postServerInstance || '',
    recordsServerInstance: model.recordsServerInstance || model.dailyServerInstance || model.serverInstance || '',
  }
}

/**
 * 从 OpenCode 模型中提取单个 API 调用所需的 serverId 和 serverInstance
 * @param model 模型配置
 * @param apiType 'daily' 使用 dailyServerId，'records' 使用 recordsServerId
 */
export function extractOpencodeServerInfo(
  model: ModelConfig,
  apiType: 'daily' | 'records',
): { workspaceId: string; serverId: string; serverInstance: string } | null {
  const params = extractOpencodeParams(model)
  const serverId = apiType === 'records' ? params.recordsServerId : params.dailyServerId
  const serverInstance = apiType === 'records' ? params.recordsServerInstance : params.dailyServerInstance
  if (!serverId || !params.workspaceId) return null
  return { workspaceId: params.workspaceId, serverId, serverInstance }
}
