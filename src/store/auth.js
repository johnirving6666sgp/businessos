import { create } from 'zustand'

export const useAuthStore = create((set, get) => ({
  user: null,
  permissions: {},
  agent: null,
  loading: true,

  // 会话依赖 HttpOnly cookie，前端不再保存 token
  setAuth: ({ user, permissions, agent }) => {
    set({ user, permissions: permissions || {}, agent })
  },

  clearAuth: () => {
    set({ user: null, permissions: {}, agent: null })
  },

  setLoading: (loading) => set({ loading }),

  can: (key) => {
    const { user, permissions } = get()
    if (!user) return false
    if (user.role === 'super_admin') return true
    return Boolean(permissions[key])
  },

  isAdmin: () => {
    const { user } = get()
    return user?.role === 'super_admin' || user?.role === 'admin'
  },

  // 启动时用 cookie 校验会话（/me 命中则恢复，未登录返回 401）
  init: async () => {
    set({ loading: true })
    try {
      const res = await fetch('/api/auth/me', { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        set({ user: data.user, permissions: data.permissions || {}, agent: data.agent })
      } else {
        set({ user: null, permissions: {}, agent: null })
      }
    } catch {
      set({ user: null })
    } finally {
      set({ loading: false })
    }
  },
}))
