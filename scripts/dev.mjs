import { spawn } from 'child_process'
import http from 'http'

async function waitForServer(url, timeout = 15000) {
  const start = Date.now()
  return new Promise((resolve, reject) => {
    const tryConnect = () => {
      const req = http.get(url, { timeout: 1000 }, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 500) {
          resolve()
        } else {
          scheduleRetry()
        }
      })
      req.on('error', scheduleRetry)
      req.on('timeout', () => {
        req.destroy()
        scheduleRetry()
      })
    }

    const scheduleRetry = () => {
      if (Date.now() - start > timeout) {
        reject(new Error(`Server at ${url} did not become ready within ${timeout}ms`))
        return
      }
      setTimeout(tryConnect, 200)
    }

    tryConnect()
  })
}

async function main() {
  console.log('[dev] Starting Vite...')

  const vite = spawn('npx', ['vite'], {
    cwd: process.cwd(),
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: true
  })

  let viteReady = false
  let buffer = ''
  let port = '14200'

  vite.stdout.on('data', (data) => {
    const text = data.toString()
    process.stdout.write(text)

    if (!viteReady) {
      buffer += text
      // Strip ANSI escape codes, then match
      const clean = buffer.replace(/\x1b\[[0-9;]*m/g, '')
      const match = clean.match(/http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/)
      if (match) {
        viteReady = true
        port = match[1]
        const rendererUrl = `http://127.0.0.1:${port}`
        console.log(`[dev] Vite detected on port ${port}, waiting for server to accept connections...`)

        waitForServer(rendererUrl)
          .then(() => {
            console.log(`[dev] Server ready, starting Electron...`)
            const electron = spawn('npx', ['electron', '.'], {
              cwd: process.cwd(),
              stdio: 'inherit',
              shell: true,
              env: { ...process.env, ELECTRON_RENDERER_URL: rendererUrl }
            })
            electron.on('close', () => {
              vite.kill()
              process.exit()
            })
          })
          .catch((err) => {
            console.error('[dev]', err.message)
            vite.kill()
            process.exit(1)
          })
      }
    }
  })

  process.on('SIGINT', () => {
    vite.kill()
    process.exit()
  })
}

main()
