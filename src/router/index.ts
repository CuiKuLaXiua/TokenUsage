import { createRouter, createWebHashHistory } from 'vue-router'

// 主路由的懒加载函数（暴露出来用于预加载）
const Dashboard = () => import('@/pages/Dashboard.vue')
const Config = () => import('@/pages/Config.vue')
const Usage = () => import('@/pages/Usage.vue')
const Export = () => import('@/pages/Export.vue')

// 弹窗路由的懒加载函数（暴露出来用于预加载）
const FloatWindow = () => import('@/pages/FloatWindow.vue')
const FloatDetail = () => import('@/pages/FloatDetail.vue')
const FloatStrip = () => import('@/pages/FloatStrip.vue')
const CtxMenu = () => import('@/pages/CtxMenu.vue')
const TrayMenu = () => import('@/pages/TrayMenu.vue')

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/dashboard'
    },
    {
      path: '/dashboard',
      name: 'Dashboard',
      component: Dashboard
    },
    {
      path: '/config',
      name: 'Config',
      component: Config
    },
    {
      path: '/usage',
      name: 'Usage',
      component: Usage
    },
    {
      path: '/export',
      name: 'Export',
      component: Export
    },
    {
      path: '/float',
      name: 'Float',
      component: FloatWindow
    },
    {
      path: '/float-detail',
      name: 'FloatDetail',
      component: FloatDetail
    },
    {
      path: '/float-strip',
      name: 'FloatStrip',
      component: FloatStrip
    },
    {
      path: '/ctx-menu',
      name: 'CtxMenu',
      component: CtxMenu
    },
    {
      path: '/tray-menu',
      name: 'TrayMenu',
      component: TrayMenu
    }
  ]
})

// 预加载非当前页的主路由 chunk，消除首次点击的延迟感
export function preloadMainRoutes() {
  // 用 setTimeout 0 让出主线程，不影响首屏渲染
  setTimeout(() => {
    Dashboard()
    Config()
    Usage()
    Export()
  }, 300)
}

// 预加载弹窗路由 chunk，使悬浮窗/菜单等弹出时无需额外请求 JS
export function preloadPopupRoutes() {
  setTimeout(() => {
    FloatWindow()
    FloatDetail()
    FloatStrip()
    CtxMenu()
    TrayMenu()
  }, 500)
}

export default router
export { FloatWindow, FloatDetail, FloatStrip, CtxMenu, TrayMenu }