// Electron IPC 通道集中定义
// 主进程与渲染进程统一使用这些常量，避免硬编码字符串导致的拼写错误。

export const IPC = {
  // ── Config / data ──
  CONFIG: {
    LOAD: 'load-config',
    SAVE: 'save-config',
  },
  USAGE: {
    LOAD: 'load-usage',
    SAVE: 'save-usage',
  },
  DATA_PATH: 'get-data-path',

  // ── API proxies ──
  API: {
    MIMO_USAGE: 'fetch-mimo-usage',
    MIMO_TOKEN_PLAN: 'fetch-mimo-token-plan',
    MIMO_TOKEN_PLAN_DETAIL: 'fetch-mimo-token-plan-detail',
    KIMI_SUBSCRIPTION: 'fetch-kimi-subscription',
    OPCODE_USAGE_DETAIL: 'fetch-opencode-usage-detail',
    OPCODE_USAGE_RECORDS: 'fetch-opencode-usage-records',
  },

  // ── Main window control ──
  MAIN_WINDOW: {
    SHOW: 'show-main-window',
    MINIMIZE: 'window-minimize',
    MAXIMIZE: 'window-maximize',
    CLOSE: 'window-close',
  },

  // ── Float window ──
  FLOAT: {
    OPEN: 'open-float-window',
    CLOSE: 'close-float-window',
    STATE: 'get-float-window-state',
    FOCUS: 'focus-float-window',
    SET_ALWAYS_ON_TOP: 'set-float-always-on-top',
    SET_POSITION: 'set-float-window-position',
    GET_BOUNDS: 'get-float-window-bounds',
    RESIZE: 'resize-float-window',
    RESIZE_ANIMATED: 'resize-float-window-animated',
    READY: 'float-ready',
    CLOSED: 'float-window-closed',
    OPENED: 'float-window-opened',
  },

  // ── Window drag ──
  DRAG: {
    START: 'start-window-drag',
    STOP: 'stop-window-drag',
  },

  // ── Detail popup ──
  DETAIL: {
    SHOW: 'show-float-detail',
    HIDE: 'hide-float-detail',
    RESIZE: 'resize-detail-window',
    HOVER_NOTIFY: 'notify-detail-hover',
    HOVER_CHANGED: 'detail-hover-changed',
    READY: 'detail-ready',
  },

  // ── Context menu popup ──
  CTX_MENU: {
    SHOW: 'show-ctx-menu',
    HIDE: 'hide-ctx-menu',
    ACTION: 'ctx-menu-action',
    GET_CONFIG: 'get-ctx-menu-config',
    CONFIG: 'ctx-menu-config',
    ACTION_EXECUTE: 'execute-ctx-menu-action',
    CLOSED: 'ctx-menu-closed',
  },

  // ── Edge docking ──
  EDGE_DOCK: {
    DOCK: 'dock-float-window',
    UNDOCK: 'undock-float-window',
    GET_STATE: 'get-edge-dock-state',
    CHANGED: 'edge-dock-changed',
    STRIP_MOUSEDOWN: 'strip-mousedown',
  },

  // ── Theme sync ──
  THEME: {
    GET: 'theme:get',
    NOTIFY_CHANGED: 'notify-theme-changed',
    CHANGED: 'theme-changed',
    INIT: 'theme:init',
  },

  // ── Config update ──
  CONFIG_UPDATED: 'config-updated',

  // ── Usage refresh ──
  USAGE_REFRESH: {
    CACHED: 'get-cached-usage',
    FETCHING: 'get-fetching-state',
    STRIP_DATA: 'get-strip-data',
    REFRESH_ALL: 'refresh-all-models',
    REFRESH_MODEL: 'refresh-model',
    UPDATED: 'usage-updated',
    FETCHING_CHANGED: 'usage-fetching',
  },

  // ── Login ──
  LOGIN: {
    MIMO: 'open-mimo-login',
    OPCODE: 'open-opencode-login',
    KIMI: 'open-kimi-login',
    KIMI_SUCCESS: 'kimi-login-success',
    NEEDED: 'login-needed',
    API_KEY_INVALID: 'api-key-invalid',
  },

  // ── Close action ──
  CLOSE_ACTION: {
    GET: 'get-close-action',
    SET: 'set-close-action',
    CHOSEN: 'close-action-chosen',
    UPDATED: 'close-action-updated',
    SHOW_DIALOG: 'show-close-dialog',
    RESET_DIALOG: 'reset-close-dialog',
  },

  // ── Tray menu ──
  TRAY_MENU: {
    GET_CONFIG: 'get-tray-menu-config',
    ACTION: 'tray-menu-action',
    UPDATE: 'tray-menu-update',
    HIDE: 'tray-menu-hide',
  },

  // ── Tray actions (broadcast from main to renderer) ──
  TRAY: {
    TOGGLE_THEME: 'tray-toggle-theme',
    SET_ACCENT: 'tray-set-accent',
    SET_PRESET: 'tray-set-preset',
  },

  // ── Export ──
  EXPORT: {
    SAVE_DIALOG: 'show-save-dialog',
    SAVE_FILE: 'save-file',
  },

  // ── Debug ──
  DEBUG_LOG: 'debug-log',
} as const

// 辅助类型：IPC 通道字符串联合类型
export type IpcChannel =
  | typeof IPC.CONFIG.LOAD
  | typeof IPC.CONFIG.SAVE
  | typeof IPC.USAGE.LOAD
  | typeof IPC.USAGE.SAVE
  | typeof IPC.DATA_PATH
  | typeof IPC.API.MIMO_USAGE
  | typeof IPC.API.MIMO_TOKEN_PLAN
  | typeof IPC.API.MIMO_TOKEN_PLAN_DETAIL
  | typeof IPC.API.KIMI_SUBSCRIPTION
  | typeof IPC.API.OPCODE_USAGE_DETAIL
  | typeof IPC.API.OPCODE_USAGE_RECORDS
  | typeof IPC.MAIN_WINDOW.SHOW
  | typeof IPC.MAIN_WINDOW.MINIMIZE
  | typeof IPC.MAIN_WINDOW.MAXIMIZE
  | typeof IPC.MAIN_WINDOW.CLOSE
  | typeof IPC.FLOAT.OPEN
  | typeof IPC.FLOAT.CLOSE
  | typeof IPC.FLOAT.STATE
  | typeof IPC.FLOAT.FOCUS
  | typeof IPC.FLOAT.SET_ALWAYS_ON_TOP
  | typeof IPC.FLOAT.SET_POSITION
  | typeof IPC.FLOAT.GET_BOUNDS
  | typeof IPC.FLOAT.RESIZE
  | typeof IPC.FLOAT.RESIZE_ANIMATED
  | typeof IPC.FLOAT.READY
  | typeof IPC.FLOAT.CLOSED
  | typeof IPC.FLOAT.OPENED
  | typeof IPC.DRAG.START
  | typeof IPC.DRAG.STOP
  | typeof IPC.DETAIL.SHOW
  | typeof IPC.DETAIL.HIDE
  | typeof IPC.DETAIL.RESIZE
  | typeof IPC.DETAIL.HOVER_NOTIFY
  | typeof IPC.DETAIL.HOVER_CHANGED
  | typeof IPC.DETAIL.READY
  | typeof IPC.CTX_MENU.SHOW
  | typeof IPC.CTX_MENU.HIDE
  | typeof IPC.CTX_MENU.ACTION
  | typeof IPC.CTX_MENU.GET_CONFIG
  | typeof IPC.CTX_MENU.CONFIG
  | typeof IPC.CTX_MENU.ACTION_EXECUTE
  | typeof IPC.CTX_MENU.CLOSED
  | typeof IPC.EDGE_DOCK.DOCK
  | typeof IPC.EDGE_DOCK.UNDOCK
  | typeof IPC.EDGE_DOCK.GET_STATE
  | typeof IPC.EDGE_DOCK.CHANGED
  | typeof IPC.EDGE_DOCK.STRIP_MOUSEDOWN
  | typeof IPC.THEME.GET
  | typeof IPC.THEME.NOTIFY_CHANGED
  | typeof IPC.THEME.CHANGED
  | typeof IPC.THEME.INIT
  | typeof IPC.CONFIG_UPDATED
  | typeof IPC.USAGE_REFRESH.CACHED
  | typeof IPC.USAGE_REFRESH.FETCHING
  | typeof IPC.USAGE_REFRESH.STRIP_DATA
  | typeof IPC.USAGE_REFRESH.REFRESH_ALL
  | typeof IPC.USAGE_REFRESH.REFRESH_MODEL
  | typeof IPC.USAGE_REFRESH.UPDATED
  | typeof IPC.USAGE_REFRESH.FETCHING_CHANGED
  | typeof IPC.LOGIN.MIMO
  | typeof IPC.LOGIN.OPCODE
  | typeof IPC.LOGIN.KIMI
  | typeof IPC.LOGIN.KIMI_SUCCESS
  | typeof IPC.LOGIN.NEEDED
  | typeof IPC.LOGIN.API_KEY_INVALID
  | typeof IPC.CLOSE_ACTION.GET
  | typeof IPC.CLOSE_ACTION.SET
  | typeof IPC.CLOSE_ACTION.CHOSEN
  | typeof IPC.CLOSE_ACTION.UPDATED
  | typeof IPC.CLOSE_ACTION.SHOW_DIALOG
  | typeof IPC.CLOSE_ACTION.RESET_DIALOG
  | typeof IPC.TRAY_MENU.GET_CONFIG
  | typeof IPC.TRAY_MENU.ACTION
  | typeof IPC.TRAY_MENU.UPDATE
  | typeof IPC.TRAY_MENU.HIDE
  | typeof IPC.TRAY.TOGGLE_THEME
  | typeof IPC.TRAY.SET_ACCENT
  | typeof IPC.TRAY.SET_PRESET
  | typeof IPC.EXPORT.SAVE_DIALOG
  | typeof IPC.EXPORT.SAVE_FILE
  | typeof IPC.DEBUG_LOG

