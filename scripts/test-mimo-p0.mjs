/**
 * P0 验证：测试 MiMo Token Plan API 是否仅凭 API Key（无 Cookie）即可查询额度
 *
 * 用法：
 *   node scripts/test-mimo-p0.mjs <your-tp-api-key>
 *
 * 示例：
 *   node scripts/test-mimo-p0.mjs tp-abc123xyz
 */

const API_KEY = process.argv[2]

if (!API_KEY) {
  console.error('用法: node scripts/test-mimo-p0.mjs <your-tp-api-key>')
  process.exit(1)
}

const URL = 'https://platform.xiaomimimo.com/api/v1/tokenPlan/usage'

async function testWithoutCookie() {
  console.log('=== P0 验证: 无 Cookie 请求 ===')
  console.log(`URL: ${URL}`)
  console.log(`API Key: ${API_KEY.slice(0, 8)}...`)
  console.log()

  try {
    const resp = await fetch(URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
        'User-Agent': 'TokenUsage-P0-Test/1.0',
      },
    })

    console.log(`HTTP 状态码: ${resp.status}`)
    console.log()

    const body = await resp.json()
    console.log('响应体:')
    console.log(JSON.stringify(body, null, 2))
    console.log()

    if (body.code === 0) {
      console.log('✅ 成功! API Key 无需 Cookie 即可查询额度')
      if (body.data) {
        const items = body.data.usage?.items || body.data.monthUsage?.items || []
        if (items.length > 0) {
          console.log()
          console.log('套餐额度:')
          for (const item of items) {
            const used = item.used ?? 0
            const limit = item.limit ?? 0
            const percent = limit > 0 ? ((used / limit) * 100).toFixed(2) : '0'
            console.log(`  ${item.name}: ${used} / ${limit} (${percent}%)`)
          }
        }
      }
    } else {
      console.log(`❌ 失败: code=${body.code}, message=${body.message || '未知'}`)
      if (resp.status === 401 || resp.status === 403) {
        console.log('   → 可能需要 Cookie，或 API Key 无效')
      }
    }
  } catch (err) {
    console.error(`❌ 请求异常: ${err.message}`)
  }
}

async function testWithAlternativeEndpoints() {
  console.log()
  console.log('=== 附加测试: 尝试其他可能的端点 ===')
  console.log()

  const endpoints = [
    'https://platform.xiaomimimo.com/api/v1/tokenPlan/quota',
    'https://platform.xiaomimimo.com/api/v1/tokenPlan/info',
    'https://platform.xiaomimimo.com/api/v1/user/balance',
    'https://platform.xiaomimimo.com/api/v1/account/balance',
    'https://api.xiaomimimo.com/v1/users/me/balance',
  ]

  for (const url of endpoints) {
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json',
        },
      })
      const text = await resp.text()
      let body
      try { body = JSON.parse(text) } catch { body = text.slice(0, 200) }

      const status = resp.status
      const ok = status >= 200 && status < 300
      console.log(`${ok ? '✅' : '❌'} ${status} ${url}`)
      if (ok) {
        console.log(`   ${JSON.stringify(body).slice(0, 300)}`)
      }
    } catch (err) {
      console.log(`❌ ERR ${url} → ${err.message}`)
    }
  }
}

await testWithoutCookie()
await testWithAlternativeEndpoints()
