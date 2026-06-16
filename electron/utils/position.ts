// 窗口尺寸常量
export const FLOAT_WIDTH = 240;
export const FLOAT_HEIGHT = 88;
export const DETAIL_WIDTH = 320;
export const DETAIL_HEIGHT = 420;
export const DETAIL_GAP = 8;
export const CTX_MENU_WIDTH = 180;
export const CTX_MENU_HEIGHT_NO_MODEL = 235;
export const CTX_MENU_HEIGHT_WITH_MODEL = 295;

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

  // 底部越界：翻转到光标上方
  if (y + menuH > workY + workH - 10) {
    y = Math.max(workY, anchorY - menuH);
  }

  // 顶部安全边距
  if (y < workY) y = workY;

  return { x: Math.round(x), y: Math.round(y) };
}
