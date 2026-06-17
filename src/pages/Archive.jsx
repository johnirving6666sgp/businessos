import { useState, useEffect, useRef } from 'react'
import { api } from '../api/client.js'
import { Button } from '../components/ui/Button.jsx'
import { Icon } from '../components/ui/Icon.jsx'

const TYPE_ICON = {
  conversation: 'message',
  activity: 'target',
  note: 'edit',
  pull_to_chat: 'message',
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
    } catch { /* 忽略加载错误 */ }
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
  const rest = items.filter(m => !m.is_pinned)
  const sorted = [...pinned, ...rest]

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 px-4 py-3 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Icon name="folder" size={20} />
            </div>
            <h1 className="text-lg font-bold text-slate-800">个人档案</h1>
          </div>
          <Button size="sm" pill onClick={() => setAdding(true)} icon={<Icon name="plus" size={15} />}>新建笔记</Button>
        </div>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Icon name="search" size={16} /></span>
          <input
            value={q}
            onChange={e => handleSearch(e.target.value)}
            placeholder="搜索…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-full focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-10 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <Icon name="folder" size={28} />
            </div>
            <p className="text-sm font-medium text-slate-700">{q ? `没有找到「${q}」` : '还没有记录'}</p>
            <p className="text-xs text-slate-400 mt-1">从对话里归档，或新建一条笔记</p>
          </div>
        ) : sorted.map(item => (
          <div key={item.id} className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-shadow hover:shadow-sm">
            <div className="flex items-start gap-3 p-4 cursor-pointer" onClick={() => setExpanded(expanded === item.id ? null : item.id)}>
              <span className="mt-0.5 flex-shrink-0 text-slate-400"><Icon name={TYPE_ICON[item.type] || 'edit'} size={18} /></span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {item.is_pinned && <span className="text-amber-400"><Icon name="star" size={13} /></span>}
                  <p className="text-sm font-medium text-slate-800 truncate">{item.title}</p>
                </div>
                {expanded !== item.id && item.content && <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{item.content}</p>}
              </div>
              <span className="text-xs text-slate-400 flex-shrink-0">{fmtDate(item.created_at)}</span>
            </div>

            {expanded === item.id && (
              <div className="px-4 pb-4 border-t border-slate-100 pt-3">
                {item.content && <p className="text-sm text-slate-600 whitespace-pre-wrap bg-slate-50 rounded-2xl p-3">{item.content}</p>}
                {item.entity_name && <p className="text-xs text-slate-400 mt-2">关联：{item.entity_name}</p>}
                <div className="flex gap-3 mt-3">
                  <button onClick={() => togglePin(item)} className="text-xs text-slate-400 hover:text-amber-500">
                    {item.is_pinned ? '取消置顶' : '置顶'}
                  </button>
                  <button onClick={() => deleteItem(item.id)} className="text-xs text-slate-400 hover:text-red-500">删除</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-5 shadow-2xl">
            <h3 className="font-bold text-slate-800 mb-3">新建笔记</h3>
            <input
              autoFocus
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="标题"
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-2xl mb-2 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <textarea
              value={newContent}
              onChange={e => setNewContent(e.target.value)}
              placeholder="内容（可选）"
              rows={4}
              className="w-full px-3 py-2 text-sm border border-slate-200 rounded-2xl resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            />
            <div className="flex gap-2 justify-end mt-3">
              <Button variant="ghost" pill onClick={() => setAdding(false)}>取消</Button>
              <Button pill onClick={saveNote} disabled={saving || !newTitle.trim()}>
                {saving ? '保存中…' : '保存'}
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
