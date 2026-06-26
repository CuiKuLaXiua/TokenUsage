import { createRouter, createWebHashHistory } from 'vue-router'

// 主路由的懒加载函数（暴露出来用于预加载）
const Dashboard = () => import('@/pages/Dashboard.vue')
const Config = () => import('@/pages/Config.vue')
const Usage = () => import('@/pages/Usage.vue')
const Export = () => import('@/pages/Export.vue')

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
      component: () => import('@/pages/FloatWindow.vue')
    },
    {
      path: '/float-detail',
      name: 'FloatDetail',
      component: () => import('@/pages/FloatDetail.vue')
    },
    {
      path: '/float-strip',
      name: 'FloatStrip',
      component: () => import('@/pages/FloatStrip.vue')
    },
    {
      path: '/ctx-menu',
      name: 'CtxMenu',
      component: () => import('@/pages/CtxMenu.vue')
    },
    {
      path: '/tray-menu',
      name: 'TrayMenu',
      component: () => import('@/pages/TrayMenu.vue')
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

export default router
