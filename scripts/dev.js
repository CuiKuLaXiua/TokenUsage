const { spawn } = require('child_process')

let electronProcess = null

function startElectron() {
  electronProcess = spawn('npx', ['electron', '.'], {
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, ELECTRON_RENDERER_URL: 'http://localhost:3000' }
  })
  
  electronProcess.on('close', () => {
    process.exit()
  })
}

function startVite() {
  const viteProcess = spawn('npx', ['vite'], {
    stdio: 'inherit',
    shell: true
  })
  
  viteProcess.on('close', () => {
    if (electronProcess) {
      electronProcess.kill()
    }
    process.exit()
  })
  
  setTimeout(() => {
    startElectron()
  }, 3000)
}

startVite()
