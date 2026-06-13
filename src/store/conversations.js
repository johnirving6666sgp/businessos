import { create } from 'zustand'

export const useConversationsStore = create((set, get) => ({
  list: [],           // 对话列表
  current: null,      // 当前对话 {id, title, agent_type, context_level}
  messages: [],       // 当前对话消息
  streaming: false,   // 是否正在流式输出
  streamContent: '',  // 流式中的内容
  contextLevel: 0,    // 当前对话上下文级别

  setList: (list) => set({ list }),
  setCurrent: (conv) => set({ current: conv, messages: [], streamContent: '', streaming: false }),
  setMessages: (messages) => set({ messages }),
  setContextLevel: (level) => set({ contextLevel: level }),

  appendMessage: (msg) => set((s) => ({ messages: [...s.messages, msg] })),

  startStream: () => set({ streaming: true, streamContent: '' }),
  appendStream: (token) => set((s) => ({ streamContent: s.streamContent + token })),
  endStream: (finalMsg) => set((s) => ({
    streaming: false,
    streamContent: '',
    messages: finalMsg
      ? [...s.messages, finalMsg]
      : s.messages,
  })),

  // 更新对话列表中的某条
  updateInList: (id, patch) => set((s) => ({
    list: s.list.map(c => c.id === id ? { ...c, ...patch } : c)
  })),

  // 把新对话插入列表顶部
  prependToList: (conv) => set((s) => ({
    list: [conv, ...s.list.filter(c => c.id !== conv.id)]
  })),
}))
