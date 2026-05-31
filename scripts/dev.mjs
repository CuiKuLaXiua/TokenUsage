import { spawn } from 'child_process'

async function main() {
  console.log('[dev] Starting Vite...')

  const vite = spawn('npx', ['vite'], {
    cwd: process.cwd(),
    stdio: ['inherit', 'pipe', 'inherit'],
    shell: true
  })

  let viteReady = false
  let buffer = ''

  vite.stdout.on('data', (data) => {
    const text = data.toString()
    process.stdout.write(text)

    if (!viteReady) {
      buffer += text
      // Strip ANSI escape codes, then match
      const clean = buffer.replace(/\x1b\[[0-9;]*m/g, '')
      const match = clean.match(/http:\/\/localhost:(\d+)/)
      if (match) {
        viteReady = true
        const port = match[1]
        console.log(`[dev] Vite ready on port ${port}, starting Electron...`)

        const electron = spawn('npx', ['electron', '.'], {
          cwd: process.cwd(),
          stdio: 'inherit',
          shell: true,
          env: { ...process.env, ELECTRON_RENDERER_URL: `http://localhost:${port}` }
        })
        electron.on('close', () => {
          vite.kill()
          process.exit()
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
