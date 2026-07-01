import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'

const isDev = !app.isPackaged

/**
 * 获取项目资源根目录，兼容 dev 和 production (asar) 环境。
 * Dev: process.cwd()
 * Production: app.getAppPath() -> app.asar
 */
function getBasePath(): string {
  return isDev ? process.cwd() : app.getAppPath()
}

/**
 * 获取 preload 脚本路径
 */
export function getPreloadPath(): string {
  return join(getBasePath(), 'dist-electron', 'preload.js')
}

/**
 * 获取渲染进程 index.html 路径
 */
export function getRendererPath(): string {
  return join(getBasePath(), 'dist', 'index.html')
}

/**
 * 获取应用窗口图标路径
 * 生产环境下优先使用 app.asar.unpacked 中的图标，避免 nativeImage 读取 asar 内部文件失败
 */
export function getIconPath(): string {
  if (isDev) {
    return join(process.cwd(), 'public', 'logo_rounded.png')
  }
  const unpackedPath = join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'logo_rounded.png')
  return existsSync(unpackedPath) ? unpackedPath : join(app.getAppPath(), 'dist', 'logo_rounded.png')
}

/**
 * 获取托盘图标路径
 */
export function getTrayIconPath(): string {
  if (isDev) {
    return join(process.cwd(), 'public', 'logo_tray.png')
  }
  const unpackedPath = join(process.resourcesPath, 'app.asar.unpacked', 'dist', 'logo_tray.png')
  return existsSync(unpackedPath) ? unpackedPath : join(app.getAppPath(), 'dist', 'logo_tray.png')
}
