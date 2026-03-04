import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes = [
  { path: '/login',   name: 'Login',   component: () => import('@/views/LoginView.vue'),   meta: { public: true } },
  { path: '/',        redirect: '/retail' },
  { path: '/retail',  name: 'Retail',  component: () => import('@/views/RetailView.vue'),  meta: { requiresAuth: true } },
  { path: '/manager', name: 'Manager', component: () => import('@/views/ManagerView.vue'), meta: { requiresAuth: true, requiresManager: true } }
]

const router = createRouter({ history: createWebHistory(), routes })

router.beforeEach((to, from, next) => {
  const auth = useAuthStore()
  if (to.meta.public) return next()
  if (!auth.isLoggedIn) return next('/login')
  if (to.meta.requiresManager && !auth.isManager) return next('/retail')
  // Managers always go straight through — no device required
  next()
})

export default router
