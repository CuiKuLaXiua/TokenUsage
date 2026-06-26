// 窗口尺寸常量
export const FLOAT_WIDTH = 240;
export const FLOAT_HEIGHT = 82;
export const DETAIL_WIDTH = 320;
export const DETAIL_HEIGHT = 420;
export const DETAIL_GAP = 8;
export const CTX_MENU_WIDTH = 180;
export const CTX_MENU_HEIGHT_NO_MODEL = 198;
export const CTX_MENU_HEIGHT_WITH_MODEL = 198;

// ── 托盘菜单弹窗 ──
export const TRAY_MENU_WIDTH = 220;
export const TRAY_MENU_BASE_HEIGHT = 265;
export const TRAY_MENU_MODEL_ROW_HEIGHT = 34;
export const TRAY_MENU_MAX_HEIGHT = 520;

/**
 * 计算详情窗口位置，支持边缘检测
 */
export function computeDetailPosition(
  anchorX: number,
  anchorY: number,
  anchorW: number,
  anchorH: number,
): { x: number; anchorTop: number; anchorBottom: number } {
  const { screen } = require("electron");
  const display = screen.getDisplayNearestPoint({ x: anchorX, y: anchorY });
  const { x: workX } = display.workArea;
  const { width: workW } = display.workAreaSize;

  // 默认与左侧对齐
  let x = anchorX;

  // 右侧超出屏幕，改为与右侧对齐
  if (x + DETAIL_WIDTH > workX + workW - 20) {
    x = Math.max(workX, anchorX + anchorW - DETAIL_WIDTH);
  }

  // y 方向由 resize-detail-window 根据实际高度计算
  return {
    x: Math.round(x),
    anchorTop: anchorY,
    anchorBottom: anchorY + anchorH,
  };
}

/** 根据锚点和实际窗口高度计算详情窗口的 y 坐标 */
export function computeDetailY(
  anchorTop: number,
  anchorBottom: number,
  actualHeight: number,
): number {
  const { screen } = require("electron");
  const display = screen.getDisplayNearestPoint({ x: 0, y: anchorTop });
  const { y: workY } = display.workArea;
  const { height: workH } = display.workAreaSize;

  // 默认放在下方
  let y = anchorBottom + DETAIL_GAP;

  // 底部空间不足，放到上方（用实际高度，间隙精确）
  if (y + actualHeight > workY + workH - 20) {
    y = anchorTop - actualHeight - DETAIL_GAP;
  }

  return Math.round(Math.max(workY, y));
}

/**
 * 计算右键菜单位置，支持屏幕边缘检测
 */
export function computeCtxMenuPosition(
  anchorX: number,
  anchorY: number,
  menuH: number,
): { x: number; y: number } {
  const { screen } = require("electron");
  const display = screen.getDisplayNearestPoint({ x: anchorX, y: anchorY });
  const { x: workX, y: workY, width: workW, height: workH } = display.workArea;

  let x = anchorX + 2;
  let y = anchorY + 2;

  // 右侧越界
  if (x + CTX_MENU_WIDTH > workX + workW - 10) {
    x = Math.max(workX, workX + workW - CTX_MENU_WIDTH - 10);
  }

  // 底部越界：翻转到光标上方（保持 2px 偏移对称）
  if (y + menuH > workY + workH - 10) {
    y = Math.max(workY, anchorY - menuH - 2);
  }

  // 顶部安全边距
  if (y < workY) y = workY;

  return { x: Math.round(x), y: Math.round(y) };
}

/**
 * 计算托盘菜单弹窗位置，锚定在光标附近
 * 菜单优先出现在光标上方偏左
 */
export function computeTrayMenuPosition(
  cursorX: number,
  cursorY: number,
  menuW: number,
  menuH: number,
): { x: number; y: number } {
  const { screen } = require("electron");
  const display = screen.getDisplayNearestPoint({ x: cursorX, y: cursorY });
  const { x: workX, y: workY, width: workW, height: workH } = display.workArea;

  // 水平：光标左侧对齐，留 4px 偏移
  let x = cursorX - menuW + 4;
  // 左侧越界
  if (x < workX + 8) x = workX + 8;
  // 右侧越界
  if (x + menuW > workX + workW - 8) x = workX + workW - menuW - 8;

  // 垂直：优先出现在光标上方
  let y = cursorY - menuH - 4;
  // 上方空间不足，放到光标下方
  if (y < workY + 8) {
    y = cursorY + 4;
  }
  // 底部越界
  if (y + menuH > workY + workH - 8) {
    y = workY + workH - menuH - 8;
  }

  return { x: Math.round(x), y: Math.round(Math.max(workY + 8, y)) };
}
