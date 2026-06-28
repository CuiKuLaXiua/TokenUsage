import { BrowserWindow, ipcMain, screen } from "electron";
import { FLOAT_WIDTH, FLOAT_HEIGHT } from "../utils/position";

// ── 常量 ──

export const EDGE_THRESHOLD = 0; // 只有贴到边缘才触发靠边隐藏
export const DOCK_VISIBLE_WIDTH = 8; // 吸附后露出边缘的宽度
export const EDGE_MARGIN = 2; // 贴边条与屏幕边缘的间距
const EDGE_REVEAL_ZONE = 5; // 鼠标距离边缘 5px 内触发弹出
const EDGE_HIDE_ZONE = 50; // 鼠标距离窗口 50px 外触发收起
const HOVER_REVEAL_DELAY = 200; // 鼠标在检测区停留 200ms 才触发弹出（防划过误触）

// ── 接口定义 ──

export interface EdgeDockState {
  isDocked: boolean;
  edge: "left" | "right" | "top" | null;
  dockX: number;
  dockY: number;
  originalX: number;
  originalY: number;
}

interface DragState {
  isDragging: boolean;
  startMouseX: number;
  startMouseY: number;
  startPosX: number;
  startPosY: number;
  intervalId: ReturnType<typeof setInterval> | null;
  lastSetX: number;
  lastSetY: number;
  workArea: { x: number; y: number; width: number; height: number };
  winSize: [number, number];
}

// ── 缓动函数 ──

export function springOvershoot(p: number): number {
  if (p === 0 || p === 1) return p;
  if (p < 0.5) return 1 - Math.pow(1 - p / 0.5, 3) * 0.85;
  const pp = (p - 0.5) / 0.5;
  return 1 + 0.15 * Math.pow(1 - pp, 2) - 0.15 * Math.pow(1 - pp, 4);
}

// ── 依赖接口 ──

export interface EdgeDockDeps {
  getFloatWindow: () => BrowserWindow | null;
  getFloatStripWindow: () => BrowserWindow | null;
  setFloatStripWindow: (w: BrowserWindow | null) => void;
  createFloatStripWindow: () => void;
  saveFloatPosition: (win: BrowserWindow) => void;
}

// ── EdgeDockManager ──

export class EdgeDockManager {
  readonly edgeDockState = new Map<number, EdgeDockState>();
  readonly dragStateMap = new Map<number, DragState>();

  private hoverPollTimer: ReturnType<typeof setTimeout> | null = null;
  private revealAnimating = false;
  private hideAnimating = false;
  private hoverEnterTime = 0;

  constructor(private deps: EdgeDockDeps) {}

  // ── strip 窗口定位 ──

  positionStripWindow(edge: "left" | "right" | "top" | null, dockY: number) {
    if (!edge) return;
    const floatStripWindow = this.deps.getFloatStripWindow();
    const floatWindow = this.deps.getFloatWindow();
    if (!floatStripWindow || floatStripWindow.isDestroyed() || !floatWindow) return;
    const display = screen.getDisplayMatching(floatWindow.getBounds());
    const { x: workX, y: workY, width: workW } = display.workArea;
    let sx: number;
    switch (edge) {
      case "left":
        sx = workX + EDGE_MARGIN;
        break;
      case "right":
        sx = workX + workW - DOCK_VISIBLE_WIDTH - EDGE_MARGIN;
        break;
      case "top":
        sx = workX + EDGE_MARGIN;
        break;
      default:
        return;
    }
    floatStripWindow.setPosition(Math.round(sx), Math.round(dockY));
    if (!floatStripWindow.isVisible()) {
      floatStripWindow.show();
    }
    if (floatWindow) floatStripWindow.moveTop();
  }

  // ── 动画 ──

  async animateWindowPosition(
    win: BrowserWindow,
    targetX: number,
    targetY: number,
    duration: number = 400,
    easing: (p: number) => number = springOvershoot,
  ): Promise<void> {
    return new Promise((resolve) => {
      const [startX, startY] = win.getPosition();
      const startTime = performance.now();

      const animate = () => {
        if (win.isDestroyed()) {
          resolve();
          return;
        }

        const elapsed = performance.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const t = easing(progress);

        const x = Math.round(startX + (targetX - startX) * t);
        const y = Math.round(startY + (targetY - startY) * t);

        win.setPosition(x, y);

        if (progress < 1) {
          setTimeout(animate, 16);
        } else {
          resolve();
        }
      };

      animate();
    });
  }

  // ── 边缘吸附检测 ──

  checkEdgeDocking(win: BrowserWindow): EdgeDockState | null {
    const [x, y] = win.getPosition();
    const [w, h] = win.getSize();
    const display = screen.getDisplayMatching(win.getBounds());
    const { x: workX, y: workY, width: workW, height: workH } = display.workArea;

    // 检查左侧
    if (x <= workX + EDGE_THRESHOLD) {
      return {
        isDocked: true,
        edge: "left",
        dockX: workX - w + DOCK_VISIBLE_WIDTH,
        dockY: y,
        originalX: workX,
        originalY: y,
      };
    }
    // 检查右侧
    if (x + w >= workX + workW - EDGE_THRESHOLD) {
      return {
        isDocked: true,
        edge: "right",
        dockX: workX + workW - DOCK_VISIBLE_WIDTH,
        dockY: y,
        originalX: workX + workW - w,
        originalY: y,
      };
    }
    // 检查顶部
    if (y <= workY + EDGE_THRESHOLD) {
      return {
        isDocked: true,
        edge: "top",
        dockX: x,
        dockY: workY - h + DOCK_VISIBLE_WIDTH,
        originalX: x,
        originalY: workY,
      };
    }

    return null;
  }

  // ── 弹出/收起 ──

  revealFloatWindow() {
    const floatWindow = this.deps.getFloatWindow();
    const floatStripWindow = this.deps.getFloatStripWindow();
    if (!floatWindow || floatWindow.isDestroyed()) return;
    const state = this.edgeDockState.get(floatWindow.id);
    if (!state || !state.isDocked) return;
    if (this.revealAnimating) return;
    this.revealAnimating = true;

    // 1. strip 吸入动画（CSS），同时屏蔽鼠标事件防止动画期间误触
    if (floatStripWindow && !floatStripWindow.isDestroyed()) {
      floatStripWindow.setIgnoreMouseEvents(true, { forward: true });
      floatStripWindow.webContents.send("edge-dock-changed", {
        isDocked: false,
        edge: state.edge,
      });
    }

    // 2. 等待 strip 收入动画基本完成（200ms），提前显示悬浮窗消除空白
    setTimeout(() => {
      const fsAfter = this.deps.getFloatStripWindow();
      const fwAfter = this.deps.getFloatWindow();
      if (!fwAfter) { this.revealAnimating = false; return; }

      // 3. 更新状态 + 显示悬浮窗（与 strip 收入动画重叠）
      this.edgeDockState.set(fwAfter.id, { ...state, isDocked: false });
      fwAfter.webContents.send("edge-dock-changed", {
        isDocked: false,
        edge: state.edge,
      });

      // 4. 显示并弹簧弹出
      fwAfter.setPosition(state.dockX, state.dockY);
      fwAfter.show();
      fwAfter.moveTop();

      // 5. strip 收入动画完成后 OS 级隐藏
      setTimeout(() => {
        if (fsAfter && !fsAfter.isDestroyed()) {
          fsAfter.hide();
          fsAfter.setIgnoreMouseEvents(false);
        }
      }, 80);

      this.animateWindowPosition(
        fwAfter,
        state.originalX,
        state.originalY,
        400,
        springOvershoot,
      ).then(() => {
        this.revealAnimating = false;
      });
    }, 200);
  }

  hideFloatWindow() {
    const floatWindow = this.deps.getFloatWindow();
    const floatStripWindow = this.deps.getFloatStripWindow();
    if (!floatWindow || floatWindow.isDestroyed()) return;
    const state = this.edgeDockState.get(floatWindow.id);
    if (!state || state.isDocked) return;
    if (this.hideAnimating) return;
    this.hideAnimating = true;

    // 悬浮窗收回过半（150ms）时提前展开 strip，消除空白
    setTimeout(() => {
      const fs = this.deps.getFloatStripWindow();
      if (fs && !fs.isDestroyed()) {
        this.positionStripWindow(state.edge, state.dockY);
        fs.webContents.send("edge-dock-changed", {
          isDocked: true,
          edge: state.edge,
        });
      }
    }, 150);

    this.animateWindowPosition(
      floatWindow,
      state.dockX,
      state.dockY,
      300,
      (p) => 1 - Math.pow(1 - p, 3),
    ).then(() => {
      const fw = this.deps.getFloatWindow();
      if (fw && !fw.isDestroyed()) {
        fw.hide();
        this.edgeDockState.set(fw.id, { ...state, isDocked: true });
        fw.webContents.send("edge-dock-changed", {
          isDocked: true,
          edge: state.edge,
        });
      }
      this.hideAnimating = false;
    });
  }

  // ── 拖拽停止 ──

  stopDragForWindow(windowId: number) {
    const state = this.dragStateMap.get(windowId);
    if (!state) return;

    state.isDragging = false;
    if (state.intervalId) {
      clearInterval(state.intervalId);
      state.intervalId = null;
    }
    this.dragStateMap.delete(windowId);

    // 基于窗口当前位置重新检测边缘吸附
    const win = BrowserWindow.fromId(windowId);
    if (win && !win.isDestroyed()) {
      const dockState = this.checkEdgeDocking(win);
      if (dockState) {
        // 吸附：创建/定位 strip，float 滑入边缘后完全隐藏
        const fs = this.deps.getFloatStripWindow();
        if (!fs || fs.isDestroyed()) {
          this.deps.createFloatStripWindow();
        }
        this.positionStripWindow(dockState.edge, dockState.dockY);
        this.animateWindowPosition(
          win,
          dockState.dockX,
          dockState.dockY,
          200,
          (p) => 1 - Math.pow(1 - p, 3),
        ).then(() => {
          if (win && !win.isDestroyed()) {
            win.hide();
            setTimeout(() => {
              this.edgeDockState.set(windowId, dockState);
              this.startHoverPolling();
              win?.webContents.send("edge-dock-changed", {
                isDocked: true,
                edge: dockState.edge,
              });
              const floatStripWindow = this.deps.getFloatStripWindow();
              floatStripWindow?.webContents.send("edge-dock-changed", {
                isDocked: true,
                edge: dockState.edge,
              });
            }, 150);
          }
        });
      } else {
        // 离开边缘
        if (this.edgeDockState.has(windowId)) {
          this.edgeDockState.delete(windowId);
          if (!win.isVisible()) win.show();
          win.webContents.send("edge-dock-changed", {
            isDocked: false,
            edge: null,
          });
          const floatStripWindow = this.deps.getFloatStripWindow();
          if (floatStripWindow && !floatStripWindow.isDestroyed()) {
            floatStripWindow.close();
            this.deps.setFloatStripWindow(null);
          }
        }
        // 非贴边状态，保存悬浮窗位置
        this.deps.saveFloatPosition(win);
      }
    }
  }

  // ── hover 轮询 ──

  startHoverPolling() {
    if (this.hoverPollTimer) return;

    const pollHover = () => {
      const floatWindow = this.deps.getFloatWindow();
      if (!floatWindow || floatWindow.isDestroyed()) {
        this.stopHoverPolling();
        return;
      }

      const state = this.edgeDockState.get(floatWindow.id);
      if (!state) {
        this.stopHoverPolling();
        return;
      }

      const cursor = screen.getCursorScreenPoint();

      if (state.isDocked) {
        let shouldReveal = false;
        const display = screen.getDisplayMatching({
          x: state.dockX, y: state.dockY, width: FLOAT_WIDTH, height: FLOAT_HEIGHT,
        } as any);
        const { x: workX, y: workY, width: workW } = display.workArea;

        switch (state.edge) {
          case "left":
            shouldReveal =
              cursor.x <= workX + DOCK_VISIBLE_WIDTH + EDGE_REVEAL_ZONE &&
              cursor.y >= state.dockY &&
              cursor.y <= state.dockY + FLOAT_HEIGHT;
            break;
          case "right":
            shouldReveal =
              cursor.x >= workX + workW - DOCK_VISIBLE_WIDTH - EDGE_REVEAL_ZONE &&
              cursor.y >= state.dockY &&
              cursor.y <= state.dockY + FLOAT_HEIGHT;
            break;
          case "top":
            shouldReveal =
              cursor.y <= workY + DOCK_VISIBLE_WIDTH + EDGE_REVEAL_ZONE &&
              cursor.x >= state.dockX &&
              cursor.x <= state.dockX + FLOAT_WIDTH;
            break;
        }

        if (shouldReveal) {
          if (this.hoverEnterTime === 0) {
            this.hoverEnterTime = Date.now();
          } else if (Date.now() - this.hoverEnterTime >= HOVER_REVEAL_DELAY) {
            this.hoverEnterTime = 0;
            this.revealFloatWindow();
          }
        } else {
          this.hoverEnterTime = 0;
        }
      } else {
        const { x: winX, y: winY, width: winW, height: winH } = floatWindow.getBounds();
        let shouldHide = false;
        switch (state.edge) {
          case "left":
            shouldHide = cursor.x > winX + winW + EDGE_HIDE_ZONE;
            break;
          case "right":
            shouldHide = cursor.x < winX - EDGE_HIDE_ZONE;
            break;
          case "top":
            shouldHide = cursor.y > winY + winH + EDGE_HIDE_ZONE;
            break;
        }
        const isMouseOutsideWindow =
          cursor.x < winX - EDGE_HIDE_ZONE ||
          cursor.x > winX + winW + EDGE_HIDE_ZONE ||
          cursor.y < winY - EDGE_HIDE_ZONE ||
          cursor.y > winY + winH + EDGE_HIDE_ZONE;

        if (shouldHide || isMouseOutsideWindow) {
          this.hideFloatWindow();
        }
      }

      const interval = state.isDocked ? 100 : 500;
      this.hoverPollTimer = setTimeout(pollHover, interval);
    };

    this.hoverPollTimer = setTimeout(pollHover, 100);
  }

  stopHoverPolling() {
    if (this.hoverPollTimer) {
      clearTimeout(this.hoverPollTimer);
      this.hoverPollTimer = null;
    }
  }

  // ── 注册所有 IPC handlers ──

  registerIpc(): void {
    ipcMain.handle(
      "start-window-drag",
      (event, options: { mouseX: number; mouseY: number }) => {
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win || win.isDestroyed()) return;

        if (this.edgeDockState.has(win.id)) {
          this.stopHoverPolling();
        }

        const [posX, posY] = win.getPosition();

        const existingState = this.dragStateMap.get(win.id);
        if (existingState) {
          if (existingState.intervalId) clearInterval(existingState.intervalId);
        }

        // 缓存显示区域和窗口尺寸，避免每 tick 重复调用原生 API
        const [winW, winH] = win.getSize();
        const display = screen.getDisplayMatching(win.getBounds());
        const workArea = display.workArea;

        const state: DragState = {
          isDragging: true,
          startMouseX: options.mouseX,
          startMouseY: options.mouseY,
          startPosX: posX,
          startPosY: posY,
          intervalId: null,
          lastSetX: posX,
          lastSetY: posY,
          workArea: { x: workArea.x, y: workArea.y, width: workArea.width, height: workArea.height },
          winSize: [winW, winH],
        };

        state.intervalId = setInterval(() => {
          if (!state.isDragging || win.isDestroyed()) {
            if (state.intervalId) {
              clearInterval(state.intervalId);
              state.intervalId = null;
            }
            return;
          }

          const cursor = screen.getCursorScreenPoint();
          const dx = cursor.x - state.startMouseX;
          const dy = cursor.y - state.startMouseY;
          let newX = state.startPosX + dx;
          let newY = state.startPosY + dy;

          // clamp 到缓存的显示区域
          const { x: wX, y: wY, width: wW, height: wH } = state.workArea;
          newX = Math.max(wX, Math.min(newX, wX + wW - state.winSize[0]));
          newY = Math.max(wY, Math.min(newY, wY + wH - state.winSize[1]));

          // 用缓存位置判断是否需要更新，避免 win.getPosition() 原生调用
          if (state.lastSetX !== newX || state.lastSetY !== newY) {
            state.lastSetX = newX;
            state.lastSetY = newY;
            win.setPosition(Math.round(newX), Math.round(newY));
          }
        }, 16);

        this.dragStateMap.set(win.id, state);
      },
    );

    ipcMain.handle("stop-window-drag", async (event) => {
      const win = BrowserWindow.fromWebContents(event.sender);
      if (!win || win.isDestroyed()) return;
      this.stopDragForWindow(win.id);
    });

    ipcMain.handle(
      "dock-float-window",
      async (_, edge: "left" | "right" | "top") => {
        const floatWindow = this.deps.getFloatWindow();
        if (!floatWindow || floatWindow.isDestroyed()) return false;

        const [x, y] = floatWindow.getPosition();
        const [w, h] = floatWindow.getSize();
        const display = screen.getDisplayMatching(floatWindow.getBounds());
        const { x: workX, y: workY, width: workW, height: workH } = display.workArea;

        let dockX = x;
        let dockY = y;

        switch (edge) {
          case "left":
            dockX = workX - w + DOCK_VISIBLE_WIDTH;
            break;
          case "right":
            dockX = workX + workW - DOCK_VISIBLE_WIDTH;
            break;
          case "top":
            dockY = workY - h + DOCK_VISIBLE_WIDTH;
            break;
        }

        const dockState: EdgeDockState = {
          isDocked: true,
          edge,
          dockX,
          dockY,
          originalX: x,
          originalY: y,
        };

        const floatStripWindow = this.deps.getFloatStripWindow();
        if (!floatStripWindow || floatStripWindow.isDestroyed()) {
          this.deps.createFloatStripWindow();
        }
        this.positionStripWindow(edge, dockY);
        await this.animateWindowPosition(
          floatWindow,
          dockX,
          dockY,
          200,
          (p) => 1 - Math.pow(1 - p, 3),
        );
        this.edgeDockState.set(floatWindow.id, dockState);
        floatWindow.hide();
        this.startHoverPolling();
        floatWindow.webContents.send("edge-dock-changed", {
          isDocked: true,
          edge,
        });
        this.deps.getFloatStripWindow()?.webContents.send("edge-dock-changed", {
          isDocked: true,
          edge,
        });

        return true;
      },
    );

    ipcMain.handle("undock-float-window", async () => {
      const floatWindow = this.deps.getFloatWindow();
      if (!floatWindow || floatWindow.isDestroyed()) return false;

      const state = this.edgeDockState.get(floatWindow.id);
      if (!state?.isDocked) return false;

      floatWindow.show();
      await this.animateWindowPosition(
        floatWindow,
        state.originalX,
        state.originalY,
        200,
        (p) => 1 - Math.pow(1 - p, 3),
      );
      this.edgeDockState.delete(floatWindow.id);
      this.stopHoverPolling();
      const floatStripWindow = this.deps.getFloatStripWindow();
      if (floatStripWindow && !floatStripWindow.isDestroyed()) {
        floatStripWindow.close();
        this.deps.setFloatStripWindow(null);
      }
      floatWindow.webContents.send("edge-dock-changed", {
        isDocked: false,
        edge: null,
      });

      return true;
    });

    ipcMain.handle("get-edge-dock-state", () => {
      const floatWindow = this.deps.getFloatWindow();
      if (!floatWindow || floatWindow.isDestroyed()) return null;
      return this.edgeDockState.get(floatWindow.id) || null;
    });

    ipcMain.handle("strip-mousedown", () => {
      const floatWindow = this.deps.getFloatWindow();
      if (!floatWindow || floatWindow.isDestroyed()) return;
      const state = this.edgeDockState.get(floatWindow.id);
      if (state?.isDocked) {
        this.revealFloatWindow();
      }
    });

    ipcMain.handle(
      "resize-float-window-animated",
      (_, width: number, height: number, duration: number = 300) => {
        const floatWindow = this.deps.getFloatWindow();
        if (!floatWindow || floatWindow.isDestroyed()) return false;
        const [startW, startH] = floatWindow.getSize();
        const targetW = Math.round(width);
        const targetH = Math.round(height);
        if (Math.abs(startW - targetW) <= 2 && Math.abs(startH - targetH) <= 2)
          return false;

        const startTime = Date.now();
        const step = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const t = 1 - Math.pow(1 - progress, 3);
          const curH = Math.round(startH + (targetH - startH) * t);
          floatWindow!.setSize(Math.round(startW + (targetW - startW) * t), curH);
          const floatStripWindow = this.deps.getFloatStripWindow();
          if (floatStripWindow && !floatStripWindow.isDestroyed()) {
            floatStripWindow.setSize(DOCK_VISIBLE_WIDTH, curH);
          }
          if (progress < 1) {
            setTimeout(step, 16);
          }
        };
        step();
        return true;
      },
    );
  }
}
