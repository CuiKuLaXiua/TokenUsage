import { BrowserWindow, Rectangle, screen, Display, Point } from 'electron'

export interface Bounds extends Point {
  width: number
  height: number
}

/**
 * 屏幕管理器：封装多显示器、DPI、workArea 相关操作。
 *
 * Electron 的窗口坐标使用 DIP（Device Independent Pixels），但 `screen` API 同时暴露
 * 物理像素和 DIP 两种单位。本管理器统一以 DIP 为单位进行计算，并提供显式的 DIP ↔ 屏幕像素
 * 转换辅助方法，供需要精细控制 DPI 的场景使用。
 */
export class ScreenManager {
  private displays: Display[] = []

  init(): void {
    this.refresh()
    screen.on('display-added', this.refresh)
    screen.on('display-removed', this.refresh)
    screen.on('display-metrics-changed', this.refresh)
  }

  destroy(): void {
    screen.off('display-added', this.refresh)
    screen.off('display-removed', this.refresh)
    screen.off('display-metrics-changed', this.refresh)
  }

  refresh = (): void => {
    this.displays = screen.getAllDisplays()
  }

  getAllDisplays(): Display[] {
    return this.displays
  }

  getPrimaryDisplay(): Display {
    return screen.getPrimaryDisplay()
  }

  getDisplayForWindow(win: BrowserWindow): Display {
    return screen.getDisplayMatching(win.getBounds())
  }

  getDisplayAtPoint(point: Point): Display {
    return screen.getDisplayNearestPoint(point)
  }

  getDisplayMatching(rect: Rectangle): Display {
    return screen.getDisplayMatching(rect)
  }

  /**
   * 获取指定显示器的 workArea，转换为 DIP 单位。
   * Electron 的 Display.workArea 是物理像素，而 BrowserWindow 使用 DIP，
   * 所以进行位置计算前需要先转换。
   */
  getWorkAreaDip(display?: Display): Rectangle {
    const d = display ?? this.getPrimaryDisplay()
    const { scaleFactor, workArea } = d
    return {
      x: workArea.x / scaleFactor,
      y: workArea.y / scaleFactor,
      width: workArea.width / scaleFactor,
      height: workArea.height / scaleFactor,
    }
  }

  /**
   * 获取指定位置所在显示器的缩放比例。
   */
  getScaleFactorAtPoint(point: Point): number {
    return this.getDisplayAtPoint(point).scaleFactor
  }

  /**
   * 将 DIP 矩形转换为屏幕物理像素矩形。
   * 在不支持该 API 的平台（如部分 Linux）上原样返回。
   */
  dipToScreenRect(win: BrowserWindow, rect: Rectangle): Rectangle {
    if (typeof (screen as any).dipToScreenRect === 'function') {
      return (screen as any).dipToScreenRect(win, rect)
    }
    return rect
  }

  /**
   * 将屏幕物理像素矩形转换为 DIP 矩形。
   * 在不支持该 API 的平台（如部分 Linux）上原样返回。
   */
  screenToDipRect(win: BrowserWindow, rect: Rectangle): Rectangle {
    if (typeof (screen as any).screenToDipRect === 'function') {
      return (screen as any).screenToDipRect(win, rect)
    }
    return rect
  }

  /**
   * 将 DIP 点转换为屏幕物理像素点。
   */
  dipToScreenPoint(point: Point): Point {
    if (typeof (screen as any).dipToScreenPoint === 'function') {
      return (screen as any).dipToScreenPoint(point)
    }
    const scale = this.getScaleFactorAtPoint(point)
    return { x: Math.round(point.x * scale), y: Math.round(point.y * scale) }
  }

  /**
   * 将屏幕物理像素点转换为 DIP 点。
   */
  screenToDipPoint(point: Point): Point {
    if (typeof (screen as any).screenToDipPoint === 'function') {
      return (screen as any).screenToDipPoint(point)
    }
    const scale = this.getScaleFactorAtPoint(point)
    return { x: Math.round(point.x / scale), y: Math.round(point.y / scale) }
  }

  /**
   * 将矩形限制在指定显示器的工作区内，保持尺寸不变优先；
   * 若窗口尺寸超过工作区，则改为贴边。
   */
  clampToWorkArea(rect: Bounds, display?: Display): Bounds {
    const d = display ?? this.getDisplayAtPoint(rect)
    const { x, y, width, height } = d.workArea

    return {
      x: Math.max(x, Math.min(rect.x, x + width - rect.width)),
      y: Math.max(y, Math.min(rect.y, y + height - rect.height)),
      width: Math.min(rect.width, width),
      height: Math.min(rect.height, height),
    }
  }

  /**
   * 判断矩形是否至少有一部分落在任意显示器的工作区内。
   */
  isVisibleOnAnyDisplay(rect: Rectangle): boolean {
    return this.displays.some((d) => this.intersectsWorkArea(rect, d))
  }

  /**
   * 判断矩形是否完全在某个显示器工作区内。
   */
  isFullyInsideWorkArea(rect: Rectangle, display?: Display): boolean {
    const d = display ?? this.getDisplayMatching(rect)
    const wa = d.workArea
    return (
      rect.x >= wa.x &&
      rect.y >= wa.y &&
      rect.x + rect.width <= wa.x + wa.width &&
      rect.y + rect.height <= wa.y + wa.height
    )
  }

  /**
   * 计算两个矩形的重叠面积。
   */
  intersectArea(a: Rectangle, b: Rectangle): number {
    const xOverlap = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x))
    const yOverlap = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
    return xOverlap * yOverlap
  }

  /**
   * 将窗口移回可见区域（例如显示器断开或缩放变化后）。
   * 优先移回面积重叠最大的显示器。
   */
  bringBackToVisible(rect: Rectangle): Bounds {
    if (this.isVisibleOnAnyDisplay(rect)) {
      // 已经在某个屏幕内，仅做边界 clamp
      return this.clampToWorkArea(rect)
    }

    // 找到与原始矩形重叠面积最大的显示器
    let bestDisplay = this.getPrimaryDisplay()
    let bestArea = 0
    for (const d of this.displays) {
      const area = this.intersectArea(rect, d.workArea)
      if (area > bestArea) {
        bestArea = area
        bestDisplay = d
      }
    }

    return this.clampToWorkArea(
      {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      bestDisplay,
    )
  }

  private intersectsWorkArea(rect: Rectangle, display: Display): boolean {
    const wa = display.workArea
    return (
      rect.x < wa.x + wa.width &&
      rect.x + rect.width > wa.x &&
      rect.y < wa.y + wa.height &&
      rect.y + rect.height > wa.y
    )
  }
}

export const screenManager = new ScreenManager()
