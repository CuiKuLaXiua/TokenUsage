import { createRouter, createWebHashHistory } from 'vue-router'

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
      component: () => import('@/pages/Dashboard.vue')
    },
    {
      path: '/config',
      name: 'Config',
      component: () => import('@/pages/Config.vue')
    },
    {
      path: '/usage',
      name: 'Usage',
      component: () => import('@/pages/Usage.vue')
    },
    {
      path: '/export',
      name: 'Export',
      component: () => import('@/pages/Export.vue')
    },
    {
      path: '/float',
      name: 'Float',
      component: () => import('@/pages/FloatWindow.vue')
    }
  ]
})

export default router
