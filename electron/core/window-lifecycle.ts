import { BrowserWindow } from 'electron'
import { EventEmitter } from 'events'

export type WindowState = 'creating' | 'ready' | 'showing' | 'visible' | 'hiding' | 'closed'

export interface ManagedWindowOptions {
  name: string
  /** 是否允许同名窗口多实例；默认 false */
  allowMultiple?: boolean
  /** 窗口关闭时的清理回调 */
  onClose?: () => void
  /** 创建工厂 */
  factory: () => BrowserWindow
}

interface ListenerEntry {
  target: EventEmitter
  event: string
  handler: (...args: any[]) => void
}

/**
 * WindowLifecycleManager
 *
 * 统一管理所有 BrowserWindow 的生命周期：创建、注册、销毁、定时器清理、事件监听清理。
 * 解决原代码中 floatWindow/detailWindow/ctxMenuWindow 等引用悬空、状态分散、内存泄漏的问题。
 */
export class WindowLifecycleManager {
  private windows = new Map<string, ManagedWindow>()

  /**
   * 获取或创建窗口。若同名窗口已存在且未被销毁，则返回现有窗口。
   */
  getOrCreate(options: ManagedWindowOptions): BrowserWindow {
    const existing = this.get(options.name)
    if (existing) return existing

    const win = options.factory()
    const managed: ManagedWindow = {
      name: options.name,
      ref: win,
      state: 'creating',
      timers: new Set(),
      listeners: [],
      onClose: options.onClose,
    }

    this.windows.set(options.name, managed)

    // 清理窗口引用
    this.on(options.name, win, 'closed', () => {
      this.cleanup(managed)
      this.windows.delete(options.name)
      options.onClose?.()
    })

    return win
  }

  /**
   * 获取窗口。若不存在或已销毁，返回 undefined（兼容旧 WindowManager 接口）。
   */
  get(name: string): BrowserWindow | undefined {
    const managed = this.windows.get(name)
    if (!managed) return undefined
    if (!managed.ref || managed.ref.isDestroyed()) {
      this.windows.delete(name)
      return undefined
    }
    return managed.ref
  }

  /**
   * 检查窗口是否存在且未销毁。
   */
  has(name: string): boolean {
    return this.get(name) !== undefined
  }

  /**
   * 获取窗口状态。
   */
  getState(name: string): WindowState | null {
    return this.windows.get(name)?.state ?? null
  }

  /**
   * 设置窗口状态。
   */
  setState(name: string, state: WindowState): void {
    const managed = this.windows.get(name)
    if (managed) managed.state = state
  }

  /**
   * 关闭窗口（如果存在）。
   */
  close(name: string): void {
    const win = this.get(name)
    if (win && !win.isDestroyed()) {
      win.close()
    }
  }

  /**
   * 销毁窗口（如果存在）。
   */
  destroy(name: string): void {
    const win = this.get(name)
    if (win && !win.isDestroyed()) {
      win.destroy()
    }
  }

  /**
   * 隐藏窗口（如果存在）。
   */
  hide(name: string): void {
    const win = this.get(name)
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide()
    }
  }

  /**
   * 显示窗口（如果存在）。
   */
  show(name: string): void {
    const win = this.get(name)
    if (win && !win.isDestroyed() && !win.isVisible()) {
      win.show()
    }
  }

  /**
   * 注册事件监听器，并在窗口销毁时自动清理。
   */
  on(name: string, target: EventEmitter, event: string, handler: (...args: any[]) => void): void {
    const managed = this.windows.get(name)
    if (!managed) return
    managed.listeners.push({ target, event, handler })
    target.on(event, handler)
  }

  /**
   * 注册一次性事件监听器。
   */
  once(name: string, target: EventEmitter, event: string, handler: (...args: any[]) => void): void {
    const managed = this.windows.get(name)
    if (!managed) return
    const wrapped = (...args: any[]) => {
      this.removeListener(managed, target, event, wrapped)
      handler(...args)
    }
    managed.listeners.push({ target, event, handler: wrapped })
    target.once(event, wrapped)
  }

  /**
   * 注册 setTimeout，窗口销毁时自动清理。
   */
  setTimeout(name: string, fn: () => void, ms: number): ReturnType<typeof setTimeout> {
    const managed = this.windows.get(name)
    if (!managed) return setTimeout(fn, ms)
    const id = setTimeout(() => {
      managed.timers.delete(id)
      fn()
    }, ms)
    managed.timers.add(id)
    return id
  }

  /**
   * 注册 setInterval，窗口销毁时自动清理。
   */
  setInterval(name: string, fn: () => void, ms: number): ReturnType<typeof setInterval> {
    const managed = this.windows.get(name)
    if (!managed) return setInterval(fn, ms)
    const id = setInterval(() => {
      fn()
    }, ms)
    managed.timers.add(id)
    return id
  }

  /**
   * 清除指定窗口的所有定时器。
   */
  clearTimers(name: string): void {
    const managed = this.windows.get(name)
    if (!managed) return
    for (const id of managed.timers) {
      clearTimeout(id)
      clearInterval(id)
    }
    managed.timers.clear()
  }

  /**
   * 清理窗口所有资源。
   */
  private cleanup(managed: ManagedWindow): void {
    for (const id of managed.timers) {
      clearTimeout(id)
      clearInterval(id)
    }
    managed.timers.clear()

    for (const { target, event, handler } of managed.listeners) {
      target.removeListener(event, handler)
    }
    managed.listeners = []

    managed.ref = null
    managed.state = 'closed'
  }

  private removeListener(
    managed: ManagedWindow,
    target: EventEmitter,
    event: string,
    handler: (...args: any[]) => void,
  ): void {
    const idx = managed.listeners.findIndex(
      (l) => l.target === target && l.event === event && l.handler === handler,
    )
    if (idx >= 0) managed.listeners.splice(idx, 1)
  }
}

interface ManagedWindow {
  name: string
  ref: BrowserWindow | null
  state: WindowState
  timers: Set<ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>>
  listeners: ListenerEntry[]
  onClose?: () => void
}

export const windowLifecycle = new WindowLifecycleManager()
