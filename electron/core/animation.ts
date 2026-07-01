import { BrowserWindow } from 'electron'
import { windowLifecycle } from './window-lifecycle'

/**
 * 主进程动画工具：在主进程提供类 requestAnimationFrame 的调度。
 * Electron 主进程没有 rAF，使用 setImmediate 作为最接近的替代。
 */
export function rafLike(callback: () => void): void {
  if (typeof setImmediate === 'function') {
    setImmediate(callback)
  } else {
    setTimeout(callback, 0)
  }
}

export interface AnimateOptions {
  duration?: number
  easing?: (p: number) => number
  onUpdate: (value: number) => void
  onComplete?: () => void
}

/**
 * 通用动画函数，基于时间而非固定帧率，避免 setTimeout(..., 16) 的跳帧问题。
 */
export function animate({
  duration = 300,
  easing = (p) => p,
  onUpdate,
  onComplete,
}: AnimateOptions): () => void {
  const startTime = performance.now()
  let cancelled = false
  let rafId: ReturnType<typeof setImmediate> | null = null

  const tick = () => {
    if (cancelled) return
    const elapsed = performance.now() - startTime
    const progress = Math.min(elapsed / duration, 1)
    onUpdate(easing(progress))
    if (progress < 1) {
      rafId = setImmediate(tick)
    } else {
      onComplete?.()
    }
  }

  rafId = setImmediate(tick)

  return () => {
    cancelled = true
    if (rafId !== null) {
      clearImmediate(rafId)
      rafId = null
    }
  }
}

export interface WindowPositionAnimationOptions {
  win: BrowserWindow
  targetX: number
  targetY: number
  duration?: number
  easing?: (p: number) => number
}

/**
 * 窗口位置动画，绑定到 WindowLifecycleManager 以便自动清理。
 */
export function animateWindowPosition(
  windowName: string,
  { win, targetX, targetY, duration = 400, easing = (p) => p }: WindowPositionAnimationOptions,
): Promise<void> {
  return new Promise((resolve) => {
    if (win.isDestroyed()) {
      resolve()
      return
    }

    const [startX, startY] = win.getPosition()
    const cancel = animate({
      duration,
      easing,
      onUpdate: (progress) => {
        if (win.isDestroyed()) return
        const x = Math.round(startX + (targetX - startX) * progress)
        const y = Math.round(startY + (targetY - startY) * progress)
        win.setPosition(x, y)
      },
      onComplete: () => {
        windowLifecycle.clearTimers(windowName)
        resolve()
      },
    })

    // 窗口关闭时自动取消动画
    windowLifecycle.once(windowName, win, 'closed', () => {
      cancel()
      resolve()
    })
  })
}

export interface WindowSizeAnimationOptions {
  win: BrowserWindow
  targetWidth: number
  targetHeight: number
  duration?: number
  easing?: (p: number) => number
}

/**
 * 窗口尺寸动画。
 */
export function animateWindowSize(
  windowName: string,
  { win, targetWidth, targetHeight, duration = 300, easing = (p) => p }: WindowSizeAnimationOptions,
): Promise<void> {
  return new Promise((resolve) => {
    if (win.isDestroyed()) {
      resolve()
      return
    }

    const [startW, startH] = win.getSize()
    const cancel = animate({
      duration,
      easing,
      onUpdate: (progress) => {
        if (win.isDestroyed()) return
        const w = Math.round(startW + (targetWidth - startW) * progress)
        const h = Math.round(startH + (targetHeight - startH) * progress)
        win.setSize(w, h)
      },
      onComplete: () => {
        windowLifecycle.clearTimers(windowName)
        resolve()
      },
    })

    windowLifecycle.once(windowName, win, 'closed', () => {
      cancel()
      resolve()
    })
  })
}
