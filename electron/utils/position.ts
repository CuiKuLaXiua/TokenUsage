import { Rectangle } from 'electron'
import { screenManager } from '../core/screen-manager'

// 窗口尺寸常量（DIP，Device Independent Pixels）。
// Electron 的 BrowserWindow 坐标/尺寸默认使用 DIP，跨 DPI 显示器时由系统自动缩放。
// 如需按显示器 DPI 微调，可使用 screenManager 上的坐标转换辅助方法。

export const FLOAT_SIZE = {
  width: 260,
  height: 82,
  listHeight: 82,
  carouselHeight: 220,
} as const

export const DETAIL_SIZE = {
  width: 320,
  height: 420,
  gap: 8,
} as const

export const CTX_MENU_SIZE = {
  width: 180,
  heightNoModel: 198,
  heightWithModel: 198,
} as const

export const TRAY_MENU_SIZE = {
  width: 220,
  baseHeight: 265,
  modelRowHeight: 34,
  maxHeight: 520,
} as const

// 向后兼容的独立常量导出（避免一次性改动过多引用方）
export const FLOAT_WIDTH = FLOAT_SIZE.width
export const FLOAT_HEIGHT = FLOAT_SIZE.height
export const FLOAT_LIST_HEIGHT = FLOAT_SIZE.listHeight
export const FLOAT_CAROUSEL_HEIGHT = FLOAT_SIZE.carouselHeight
export const DETAIL_WIDTH = DETAIL_SIZE.width
export const DETAIL_HEIGHT = DETAIL_SIZE.height
export const DETAIL_GAP = DETAIL_SIZE.gap
export const CTX_MENU_WIDTH = CTX_MENU_SIZE.width
export const CTX_MENU_HEIGHT_NO_MODEL = CTX_MENU_SIZE.heightNoModel
export const CTX_MENU_HEIGHT_WITH_MODEL = CTX_MENU_SIZE.heightWithModel
export const TRAY_MENU_WIDTH = TRAY_MENU_SIZE.width
export const TRAY_MENU_BASE_HEIGHT = TRAY_MENU_SIZE.baseHeight
export const TRAY_MENU_MODEL_ROW_HEIGHT = TRAY_MENU_SIZE.modelRowHeight
export const TRAY_MENU_MAX_HEIGHT = TRAY_MENU_SIZE.maxHeight

export interface Point {
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

/**
 * 计算详情窗口位置，支持边缘检测。
 */
export function computeDetailPosition(
  anchorX: number,
  anchorY: number,
  anchorW: number,
  _anchorH: number,
): { x: number; anchorTop: number; anchorBottom: number } {
  const display = screenManager.getDisplayAtPoint({ x: anchorX, y: anchorY })
  const { x: workX } = screenManager.getWorkAreaDip(display)
  const { width: workW } = display.workAreaSize
  const workWDip = workW / display.scaleFactor

  let x = anchorX
  if (x + DETAIL_SIZE.width > workX + workWDip - 20) {
    x = Math.max(workX, anchorX + anchorW - DETAIL_SIZE.width)
  }

  return {
    x: Math.round(x),
    anchorTop: anchorY,
    anchorBottom: anchorY + FLOAT_SIZE.listHeight,
  }
}

/**
 * 根据锚点和实际窗口高度计算详情窗口的 y 坐标。
 */
export function computeDetailY(
  anchorTop: number,
  anchorBottom: number,
  actualHeight: number,
): number {
  const display = screenManager.getDisplayAtPoint({ x: 0, y: anchorTop })
  const { y: workY } = screenManager.getWorkAreaDip(display)
  const { height: workH } = display.workAreaSize
  const workHDip = workH / display.scaleFactor

  let y = anchorBottom + DETAIL_SIZE.gap
  if (y + actualHeight > workY + workHDip - 20) {
    y = anchorTop - actualHeight - DETAIL_SIZE.gap
  }

  return Math.round(Math.max(workY, y))
}

/**
 * 计算右键菜单位置，支持屏幕边缘翻转。
 */
export function computeCtxMenuPosition(
  anchorX: number,
  anchorY: number,
  menuW: number,
  menuH: number,
): Point {
  const display = screenManager.getDisplayAtPoint({ x: anchorX, y: anchorY })
  const { x: workX, y: workY, width: workW, height: workH } = screenManager.getWorkAreaDip(display)

  let x = anchorX + 2
  let y = anchorY + 2

  // 右侧溢出：翻转到光标左侧
  if (x + menuW > workX + workW - 10) {
    x = anchorX - menuW - 2
  }
  // 左侧溢出
  if (x < workX + 8) x = workX + 8

  // 底部溢出：翻转到光标上方
  if (y + menuH > workY + workH - 10) {
    y = anchorY - menuH - 2
  }
  // 顶部溢出：翻转到光标下方
  if (y < workY + 8) {
    y = anchorY + 2
  }

  return { x: Math.round(x), y: Math.round(y) }
}

export type TaskbarEdge = 'top' | 'bottom' | 'left' | 'right'

/**
 * 推断当前显示器的任务栏方向。
 */
export function inferTaskbarEdge(display: Electron.Display): TaskbarEdge {
  const { bounds, workArea } = display
  const top = workArea.y - bounds.y
  const bottom = bounds.y + bounds.height - workArea.y - workArea.height
  const left = workArea.x - bounds.x
  const right = bounds.x + bounds.width - workArea.x - workArea.width

  const max = Math.max(top, bottom, left, right)
  if (max <= 0) return 'bottom'
  if (max === top) return 'top'
  if (max === bottom) return 'bottom'
  if (max === left) return 'left'
  return 'right'
}

/**
 * 计算托盘菜单弹窗位置，锚定在光标附近，并考虑任务栏方向避免遮挡。
 * 所有坐标/尺寸均为 DIP。
 */
export function computeTrayMenuPosition(
  cursorX: number,
  cursorY: number,
  menuW: number,
  menuH: number,
): Point {
  const display = screenManager.getDisplayAtPoint({ x: cursorX, y: cursorY })
  const { x: workX, y: workY, width: workW, height: workH } = screenManager.getWorkAreaDip(display)
  const edge = inferTaskbarEdge(display)

  // 水平：光标右侧对齐，右侧越界则左对齐
  let x = cursorX - 8
  if (x + menuW > workX + workW - 8) {
    x = Math.max(workX + 8, cursorX - menuW + 8)
  }
  if (x < workX + 8) x = workX + 8

  let y: number

  switch (edge) {
    case 'top':
      y = cursorY + 8
      if (y + menuH > workY + workH - 8) {
        y = Math.max(workY + 8, workY + workH - menuH - 8)
      }
      break
    case 'left':
    case 'right':
      y = cursorY + 8
      if (y + menuH > workY + workH - 8) {
        y = Math.max(workY + 8, cursorY - menuH - 8)
      }
      break
    case 'bottom':
    default:
      y = cursorY - menuH - 8
      if (y < workY + 8) {
        y = cursorY + 8
      }
      if (y + menuH > workY + workH - 8) {
        y = Math.max(workY + 8, workY + workH - menuH - 8)
      }
      break
  }

  return { x: Math.round(x), y: Math.round(y) }
}

/**
 * 计算浮窗贴边后的 strip 窗口 x 坐标。
 */
export function computeStripX(
  edge: 'left' | 'right' | 'top' | null,
  displayWorkArea: Rectangle,
  visibleWidth: number,
  margin: number,
): number | null {
  if (!edge) return null
  const { x: workX, width: workW } = displayWorkArea
  switch (edge) {
    case 'left':
    case 'top':
      return workX + margin
    case 'right':
      return workX + workW - visibleWidth - margin
    default:
      return null
  }
}
