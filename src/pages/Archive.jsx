import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client.js'
import { Button } from '../components/ui/Button.jsx'

const TYPE_ICON = {
  conversation: '💬',
  activity:     '📌',
  note:         '📝',
  pull_to_chat: '🔗',
}

export function Archive({ onNavigate }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState(null)
  const [adding, setAdding] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving] = useState(false)
  const debounce = useRef(null)

  async function load(search = q) {
    setLoading(true)
    try {
      const qs = new URLSearchParams({ q: search, limit: '50' }).toString()
      const data = await api.get(`/api/memories?${qs}`)
      setItems(data.memories || [])
    } catch {}
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  function handleSearch(val) {
    setQ(val)
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => load(val), 350)
  }

  async function togglePin(item) {
    await api.patch(`/api/memories/${item.id}`, { is_pinned: !item.is_pinned })
    setItems(prev => prev.map(m => m.id === item.id ? { ...m, is_pinned: !m.is_pinned } : m))
  }

  async function deleteItem(id) {
    if (!confirm('确认删除？')) return
    await api.delete(`/api/memories/${id}`)
    setItems(prev => prev.filter(m => m.id !== id))
    if (expanded === id) setExpanded(null)
  }

  async function saveNote() {
    if (!newTitle.trim()) return
    setSaving(true)
    await api.post('/api/memories', { type: 'note', title: newTitle.trim(), content: newContent.trim() || null })
    setNewTitle(''); setNewContent(''); setAdding(false)
    await load()
    setSaving(false)
  }

  const pinned = items.filter(m => m.is_pinned)
  const rest    = items.filter(m => !m.is_pinned)
  const sorted  = [...pinned, ...rest]

  return (
    <div className="flex flex-col h-full">
      {/* 顶栏 */}
      <div className="flex-shrink-0 px-6 py-4 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-lg font-semibold text-slate-800">🗂️ 个人档案</h1>
          <Button size="sm" onClick={() => setAdding(true)}>+ 新建笔记</Button>
        </div>
        <input
          value={q}
          onChange={e => handleSearch(e.target.value)}
          placeholder="搜索..."
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30"
        />
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-slate-400">
            <p className="text-sm">{q ? `没有找到「${q}」` : '还没有记录，从对话里归档或新建笔记吧'}</p>
          </div>
        ) : sorted.map(item => (
          <div key={item.id} className="bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-shadow hover:shadow-sm">
            {/* 头部 */}
            <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
              <span className="text-lg mt-0.5 flex-shrink-0">{TYPE_ICON[item.type] || '📝'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {item.is_pinned && <span className="text-amber-400 text-xs">📌</span>}
                  <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                </div>
                {!expanded || expanded !== item.id ? (
                  item.content && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.content}</p>
                ) : null}
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">{fmtDate(item.created_at)}</span>
            </div>

            {/* 展开内容 */}
            {expanded === item.id && (
              <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                {item.content && (
                  <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-lg p-3">{item.content}</p>
                )}
                {item.entity_name && (
                  <p className="text-xs text-slate-400 mt-2">📎 {item.entity_name}</p>
                )}
                <div className="flex gap-3 mt-3">
                  <button onClick={() => togglePin(item)} className="text-xs text-slate-400 hover:text-amber-500">
                    {item.is_pinned ? '取消置顶' : '置顶'}
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="text-xs text-slate-400 hover:text-red-500">
                    删除
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 新建笔记 */}
      {adding && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="font-semibold text-slate-800 mb-3">新建笔记</h3>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="标题"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="内容（可选）"
              rows={4}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <div className="flex gap-2 justify-end mt-3">
              <Button variant="ghost" onClick={() => setAdding(false)}>取消</Button>
              <Button onClick={saveNote} disabled={saving || !newTitle.trim()}>
                {saving ? '保存中...' : '保存'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function fmtDate(str) {
  if (!str) return ''
  const d = new Date(str)
  const now = new Date()
  const diff = now - d
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}小时前`
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}
