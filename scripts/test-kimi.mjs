// Test script for Kimi Coding Plan API
// Usage: node scripts/test-kimi.mjs

const API_KEY = 'sk-kimi-Veq9Tu437F9FjwFFIfLSIAyTfwKcLZ3BNwo0qMgJzWJky8bGK8sxY0mvkdZhjlPo'

async function testKimi() {
  console.log('Testing Kimi Coding Plan API...')
  console.log('URL: https://api.kimi.com/coding/v1/usages')
  console.log('API Key:', API_KEY.slice(0, 20) + '...')
  console.log()

  try {
    const response = await fetch('https://api.kimi.com/coding/v1/usages', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    console.log('Status:', response.status, response.statusText)
    console.log()

    const data = await response.json()
    console.log('Raw Response:')
    console.log(JSON.stringify(data, null, 2))
    console.log()

    // Parse like the app does (with tiers)
    if (data && typeof data === 'object') {
      console.log('--- Parsing (with tiers) ---')

      function parseF64(value) {
        if (typeof value === 'number') return value
        if (typeof value === 'string') {
          const n = Number(value)
          return isNaN(n) ? null : n
        }
        return null
      }

      function makeTier(name, label, detail) {
        const total = parseF64(detail.limit) ?? 0
        const used = parseF64(detail.used) ?? 0
        const remaining = parseF64(detail.remaining) ?? 0
        if (total <= 0) return null
        const percent = Math.round((used / total) * 10000) / 100
        return { name, label, used, total, remaining, percent, resetAt: typeof detail.resetTime === 'string' ? detail.resetTime : undefined }
      }

      const tiers = []

      // 1. Five hour window
      const limits = data.limits
      if (Array.isArray(limits)) {
        for (const item of limits) {
          const detail = item?.detail
          if (detail && typeof detail === 'object') {
            const tier = makeTier('五小时窗口', '5h', detail)
            if (tier) {
              tiers.push(tier)
              console.log('Tier: 五小时窗口')
              console.log('  Total:', tier.total, 'Used:', tier.used, 'Remaining:', tier.remaining)
              console.log('  Percent:', tier.percent + '%')
            }
          }
        }
      }

      // 2. Weekly limit
      const usage = data.usage
      if (usage && typeof usage === 'object') {
        const tier = makeTier('周限额', 'weekly', usage)
        if (tier) {
          tiers.push(tier)
          console.log('Tier: 周限额')
          console.log('  Total:', tier.total, 'Used:', tier.used, 'Remaining:', tier.remaining)
          console.log('  Percent:', tier.percent + '%')
        }
      }

      console.log('\nAll tiers:', tiers.length)
      console.log('Primary (weekly) used/total:', tiers.find(t => t.name === '周限额')?.used + '/' + tiers.find(t => t.name === '周限额')?.total)
    }
  } catch (error) {
    console.error('Error:', error.message)
  }
}

testKimi()
