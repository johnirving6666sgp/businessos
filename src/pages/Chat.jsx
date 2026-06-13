import { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../store/auth.js'
import { useConversationsStore } from '../store/conversations.js'
import { MessageBubble } from '../components/chat/MessageBubble.jsx'
import { MessageInput } from '../components/chat/MessageInput.jsx'
import { Button } from '../components/ui/Button.jsx'
import {
  loadConversations, createConversation, loadMessages, sendMessage
} from '../api/conversations.js'

const CONTEXT_LEVEL_LABELS = {
  0: { label: '纯净模式', color: 'text-slate-400', desc: '不引入业务上下文' },
  1: { label: '轻量模式', color: 'text-blue-400', desc: '引入近期任务和客户' },
  2: { label: '精准模式', color: 'text-violet-400', desc: '引入相关实体详情' },
  3: { label: '完整模式', color: 'text-amber-500', desc: '引入全部相关上下文' },
}

export function Chat() {
  const user = useAuthStore(s => s.user)
  const list = useConversationsStore(s => s.list)
  const current = useConversationsStore(s => s.current)
  const messages = useConversationsStore(s => s.messages)
  const streaming = useConversationsStore(s => s.streaming)
  const streamContent = useConversationsStore(s => s.streamContent)
  const contextLevel = useConversationsStore(s => s.contextLevel)
  const setCurrent = useConversationsStore(s => s.setCurrent)

  const messagesEndRef = useRef(null)
  const [showHistory, setShowHistory] = useState(false)
  const [loadingConv, setLoadingConv] = useState(false)

  // 初始加载对话列表
  useEffect(() => {
    loadConversations().then(convs => {
      // 自动打开最近一条
      if (convs.length > 0 && !current) {
        openConversation(convs[0])
      }
    })
  }, [])

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamContent])

  async function openConversation(conv) {
    setLoadingConv(true)
    setShowHistory(false)
    try {
      await loadMessages(conv.id)
    } finally {
      setLoadingConv(false)
    }
  }

  async function handleNewConversation() {
    setShowHistory(false)
    const conv = await createConversation('personal')
    // 新对话立即激活
  }

  async function handleSend(text) {
    let convId = current?.id
    // 没有当前对话时自动创建
    if (!convId) {
      const conv = await createConversation('personal')
      convId = conv.id
    }
    await sendMessage(convId, text)
  }

  const levelInfo = CONTEXT_LEVEL_LABELS[contextLevel] || CONTEXT_LEVEL_LABELS[0]

  return (
    <div className="flex h-full">
      {/* 对话历史（侧边面板） */}
      {showHistory && (
        <div className="w-64 flex-shrink-0 border-r border-slate-100 flex flex-col bg-white">
          <div className="flex items-center justify-between px-3 py-3 border-b border-slate-100">
            <span className="text-sm font-semibold text-slate-700">对话记录</span>
            <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {list.map(conv => (
              <button
                key={conv.id}
                onClick={() => openConversation(conv)}
                className={`w-full text-left px-3 py-2.5 hover:bg-slate-50 transition-colors ${
                  current?.id === conv.id ? 'bg-blue-50 border-r-2 border-blue-500' : ''
                }`}
              >
                <p className="text-sm text-slate-800 truncate">{conv.title || '新对话'}</p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {conv.updated_at ? new Date(conv.updated_at).toLocaleDateString('zh-CN') : ''}
                </p>
              </button>
            ))}
          </div>
          <div className="px-3 py-3 border-t border-slate-100">
            <Button onClick={handleNewConversation} size="sm" className="w-full">+ 新对话</Button>
          </div>
        </div>
      )}

      {/* 主聊天区域 */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* 顶部工具栏 */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-white flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(v => !v)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100"
              title="对话记录"
            >
              ☰
            </button>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
              AI
            </div>
            <div>
              <span className="text-sm font-semibold text-slate-800">{user?.display_name}_AI</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* 上下文级别指示器 */}
            <div className="flex items-center gap-1.5 text-xs" title={levelInfo.desc}>
              <span className={`w-1.5 h-1.5 rounded-full bg-current ${levelInfo.color}`} />
              <span className={levelInfo.color}>{levelInfo.label}</span>
            </div>

            <Button onClick={handleNewConversation} size="sm" variant="ghost" className="text-xs">
              + 新对话
            </Button>
          </div>
        </div>

        {/* 消息列表 */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {loadingConv && (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loadingConv && messages.length === 0 && !streaming && (
            <EmptyState name={user?.display_name} onSend={handleSend} />
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={msg.id || i} message={msg} />
          ))}

          {/* 流式输出 */}
          {streaming && streamContent && (
            <MessageBubble
              message={{ id: null, role: 'assistant', content: streamContent }}
              isStreaming
            />
          )}

          {streaming && !streamContent && (
            <div className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex-shrink-0" />
              <div className="bg-white border border-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                <div className="flex gap-1">
                  {[0, 1, 2].map(i => (
                    <div key={i} className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 输入框 */}
        <div className="flex-shrink-0">
          <MessageInput onSend={handleSend} disabled={streaming} />
        </div>
      </div>
    </div>
  )
}

function EmptyState({ name, onSend }) {
  const suggestions = [
    '帮我分析一下真空感应熔炼炉的市场竞争格局',
    '我刚和客户开完会，帮我整理一下下一步计划',
    '有一个新招标，帮我判断是否值得跟进',
    '帮我起草一封设备报价邮件',
  ]

  return (
    <div className="flex flex-col items-center justify-center h-full py-12">
      <div className="w-16 h-16 bg-gradient-to-br from-violet-100 to-blue-100 rounded-2xl flex items-center justify-center text-3xl mb-4">
        💬
      </div>
      <h2 className="text-lg font-semibold text-slate-700 mb-1">开始一段新对话</h2>
      <p className="text-sm text-slate-400 text-center max-w-xs mb-6">
        直接输入，或选择一个建议开始
      </p>
      <div className="grid grid-cols-1 gap-2 w-full max-w-sm">
        {suggestions.map((s, i) => (
          <button
            key={i}
            onClick={() => onSend(s)}
            className="text-left text-sm px-4 py-3 bg-white border border-slate-100 rounded-xl text-slate-600 hover:border-blue-200 hover:text-blue-700 hover:bg-blue-50 transition-colors shadow-sm"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
