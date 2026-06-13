import { create } from 'zustand'

let toastIdCounter = 0

export const useUIStore = create((set, get) => ({
  toasts: [],
  modal: null,      // { type, props }
  sidebarOpen: false,

  // Toast 通知
  toast: (message, type = 'info', duration = 3500) => {
    const id = ++toastIdCounter
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    }, duration)
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter(t => t.id !== id) })),

  // Modal
  openModal: (type, props = {}) => set({ modal: { type, props } }),
  closeModal: () => set({ modal: null }),

  // Sidebar（移动端）
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  closeSidebar: () => set({ sidebarOpen: false }),
}))
