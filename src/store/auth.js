import { create } from 'zustand'

const TOKEN_KEY = 'bos_token'

export const useAuthStore = create((set, get) => ({
  user: null,
  permissions: {},
  agent: null,
  token: localStorage.getItem(TOKEN_KEY) || null,
  loading: true,

  setAuth: ({ user, permissions, agent, token }) => {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    set({ user, permissions: permissions || {}, agent, token })
  },

  clearAuth: () => {
    localStorage.removeItem(TOKEN_KEY)
    set({ user: null, permissions: {}, agent: null, token: null })
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

  // 启动时从已存 token 恢复会话
  init: async () => {
    const { token } = get()
    if (!token) {
      set({ loading: false })
      return
    }
    set({ loading: true })
    try {
      const res = await fetch('/api/auth/me', {
        credentials: 'include',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        set({ user: data.user, permissions: data.permissions || {}, agent: data.agent })
      } else {
        // Token 失效，清除
        localStorage.removeItem(TOKEN_KEY)
        set({ user: null, token: null })
      }
    } catch {
      set({ user: null })
    } finally {
      set({ loading: false })
    }
  },
}))
