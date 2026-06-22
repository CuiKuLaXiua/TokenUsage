/**
 * P0 探测：Kimi 网页版 Cookie 接口
 * 接口: POST https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStat
 *
 * 用法：
 *   1. 在浏览器中登录 kimi.com，打开控制台 → Application → Cookies → 复制完整 cookie 字符串
 *   2. node scripts/test-kimi-cookie.mjs "cookie_string_here"
 */

const COOKIE = process.argv[2]

if (!COOKIE) {
  console.error('用法: node scripts/test-kimi-cookie.mjs "your_cookie_string"')
  console.error('获取方式：浏览器登录 kimi.com → DevTools → Application → Cookies → 复制')
  process.exit(1)
}

const URL = 'https://www.kimi.com/apiv2/kimi.gateway.membership.v2.MembershipService/GetSubscriptionStat'

// ConnectRPC 格式变体：逐个尝试
async function testConnectRPC() {
  const variants = [
    {
      name: 'Connect-JSON (推荐)',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: '{}'
    },
    {
      name: 'Connect-JSON + Connect-Version',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Connect-Protocol-Version': '1',
      },
      body: '{}'
    },
    {
      name: 'Connect-Unary',
      headers: {
        'Content-Type': 'application/connect+json',
        'Accept': 'application/connect+json',
      },
      body: '{}'
    },
    {
      name: 'gRPC-Web-JSON',
      headers: {
        'Content-Type': 'application/grpc-web+json',
        'Accept': 'application/grpc-web+json',
        'X-Grpc-Web': '1',
      },
      body: '{}'
    },
    {
      name: '空 Body 变体',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: ''
    }
  ]

  for (const variant of variants) {
    console.log(`\n=== 测试: ${variant.name} ===`)

    try {
      const headers = {
        'Cookie': COOKIE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36',
        'Referer': 'https://www.kimi.com/',
        'Origin': 'https://www.kimi.com',
        ...variant.headers
      }

      const resp = await fetch(URL, {
        method: 'POST',
        headers,
        body: variant.body
      })

      const contentType = resp.headers.get('content-type') || 'unknown'
      const bodyText = await resp.text()

      console.log(`  HTTP: ${resp.status} ${resp.statusText}`)
      console.log(`  Content-Type: ${contentType}`)
      console.log(`  Body 前 500 字符: ${bodyText.substring(0, 500)}`)

      // 尝试解析 JSON
      if (contentType.includes('json') || bodyText.startsWith('{')) {
        try {
          const data = JSON.parse(bodyText)
          console.log('  ✅ JSON 解析成功!')
          console.log('  结构:', JSON.stringify(data, null, 2).substring(0, 800))

          // 如果响应成功，返回数据
          if (resp.status === 200) {
            console.log('\n  ⭐ 成功! 此变体可用，完整响应如下:')
            console.log(JSON.stringify(data, null, 2))
            return { variant: variant.name, data }
          }
        } catch (e) {
          console.log('  ❌ JSON 解析失败')
        }
      }

      // 401/403 = Cookie 问题
      if (resp.status === 401 || resp.status === 403) {
        console.log('  ⚠️ 认证失败，Cookie 可能过期或不完整')
      }
    } catch (err) {
      console.error(`  ❌ 请求异常: ${err.message}`)
    }
  }

  return null
}

// 同时测试旧版 API Key 接口做对比
async function testApiKey() {
  const API_KEY = process.env.KIMI_API_KEY
  if (!API_KEY) return

  console.log('\n=== 对比: 旧版 API Key 接口 ===')
  try {
    const resp = await fetch('https://api.kimi.com/coding/v1/usages', {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json'
      }
    })
    const data = await resp.json()
    console.log('  HTTP:', resp.status)
    console.log('  结构:', JSON.stringify(data, null, 2).substring(0, 500))
  } catch (e) {
    console.error('  API Key 接口测试失败:', e.message)
  }
}

const result = await testConnectRPC()
await testApiKey()

if (!result) {
  console.log('\n❌ 所有变体都失败了。可能原因：')
  console.log('  1. Cookie 不完整 - 需要包含 access_token 或 session 相关字段')
  console.log('  2. 需要额外 Header - 如 X-Request-Id, X-Device-Id 等')
  console.log('  3. Body 需要特定字段 - 可能需要 proto 序列化而非空 JSON')
  console.log('  4. 接口路径有变化')
}
