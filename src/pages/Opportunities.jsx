import { useState, useEffect } from 'react'
import { api } from '../api/client.js'
import { useAuthStore } from '../store/auth.js'
import { useUIStore } from '../store/ui.js'
import { useConversationsStore } from '../store/conversations.js'
import { createConversation } from '../api/conversations.js'
import { Badge, RatingBadge } from '../components/ui/Badge.jsx'
import { Button } from '../components/ui/Button.jsx'

const SCORES = [0, 30, 60, 80, 100]
const SCORE_LABELS = { 0: '无用', 30: '一般', 60: '有用', 80: '重要', 100: '优先' }
const SCORE_COLORS = { 0: 'bg-slate-100 text-slate-500', 30: 'bg-yellow-50 text-yellow-600', 60: 'bg-blue-50 text-blue-600', 80: 'bg-green-50 text-green-700', 100: 'bg-emerald-100 text-emerald-700' }
const SOURCE_LABELS = { ctbpsp: '中国招标', qianlima: '千里马', manual: '手动添加', unknown: '未知' }

export function Opportunities({ onNavigate }) {
  const user = useAuthStore(s => s.user)
  const toast = useUIStore(s => s.toast)
  const setPendingEntityRef = useConversationsStore(s => s.setPendingEntityRef)

  const [opps, setOpps] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const [pullingId, setPullingId] = useState(null)

  async function load(p = 1) {
    setLoading(true)
    try {
      const data = await api.get(`/api/opportunities?page=${p}&limit=20`)
      setOpps(data.opportunities)
      setTotal(data.total)
      setPage(p)
    } catch (e) {
      toast(e.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load(1) }, [])

  async function handleRate(oppId, score) {
    await api.post(`/api/opportunities/${oppId}/rate`, { score })
    setOpps(prev => prev.map(o => o.id === oppId ? { ...o, my_rating: score } : o))
    toast('评分已保存', 'success')
  }

  async function handleSave(oppId, save) {
    await api.post(`/api/opportunities/${oppId}/save`, { save })
    setOpps(prev => prev.map(o => o.id === oppId ? { ...o, is_saved: save } : o))
    toast(save ? '已收藏' : '已取消收藏', 'success')
  }

  async function handlePullToChat(opp) {
    setPullingId(opp.id)
    try {
      // 创建新对话（类型为 opportunity）
      await createConversation('opportunity')
      // 把商机存进 store，Chat 发第一条消息时会带上
      setPendingEntityRef({ type: 'opportunity', id: opp.id, name: opp.title })
      // 跳转到对话页
      onNavigate?.('chat')
      toast(`已拉入对话：${opp.title.slice(0, 20)}...`, 'success')
    } catch (e) {
      toast('拉入失败：' + e.message, 'error')
    } finally {
      setPullingId(null)
    }
  }

  const totalPages = Math.ceil(total / 20)

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-slate-800">线索池</h1>
          <p className="text-sm text-slate-500 mt-0.5">{total} 条线索</p>
        </div>
        <Button size="sm" variant="secondary" onClick={() => load(page)}>刷新</Button>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-2xl border border-slate-100 p-4 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-3/4 mb-2" />
              <div className="h-3 bg-slate-50 rounded w-1/2" />
            </div>
          ))}
        </div>
      )}

      {/* 线索卡片列表 */}
      <div className="space-y-2">
        {opps.map(opp => (
          <OpportunityCard
            key={opp.id}
            opp={opp}
            expanded={expanded === opp.id}
            onToggle={() => setExpanded(v => v === opp.id ? null : opp.id)}
            onRate={handleRate}
            onSave={handleSave}
            onPullToChat={handlePullToChat}
            pulling={pullingId === opp.id}
          />
        ))}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button size="sm" variant="secondary" disabled={page <= 1} onClick={() => load(page - 1)}>上一页</Button>
          <span className="text-sm text-slate-500">{page} / {totalPages}</span>
          <Button size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => load(page + 1)}>下一页</Button>
        </div>
      )}

      {!loading && opps.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <div className="text-4xl mb-3">🔍</div>
          <p>暂无线索</p>
          <p className="text-sm mt-1">等待爬虫抓取或手动添加</p>
        </div>
      )}
    </div>
  )
}

function OpportunityCard({ opp, expanded, onToggle, onRate, onSave, onPullToChat, pulling }) {
  const hasHighRating = opp.max_rating >= 80
  const isNew = new Date(opp.created_at) > new Date(Date.now() - 86400000 * 2)

  return (
    <div className={`bg-white rounded-2xl border transition-all ${
      expanded ? 'border-blue-200 shadow-md' : 'border-slate-100 shadow-sm hover:border-slate-200'
    }`}>
      {/* 卡片头部（可点击展开） */}
      <button
        onClick={onToggle}
        className="w-full text-left px-4 py-3.5 flex items-start gap-3"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {isNew && <Badge variant="green">新</Badge>}
            {hasHighRating && <Badge variant="amber">热门</Badge>}
            <Badge variant="default">{SOURCE_LABELS[opp.source_platform] || opp.source_platform}</Badge>
            {opp.max_rating != null && <RatingBadge score={opp.max_rating} />}
          </div>
          <h3 className="text-sm font-semibold text-slate-800 leading-snug">{opp.title}</h3>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-2 flex-wrap">
            {opp.org_name && <span>📌 {opp.org_name}</span>}
            {opp.budget && <span>💰 {opp.budget}</span>}
            {opp.deadline && <span>⏰ {opp.deadline}</span>}
          </p>
        </div>
        <span className={`text-slate-300 transition-transform flex-shrink-0 mt-0.5 ${expanded ? 'rotate-180' : ''}`}>▾</span>
      </button>

      {/* 展开详情 */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-slate-50 pt-3">
          {/* 正文 */}
          {opp.raw_content && (
            <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3 whitespace-pre-wrap">
              {opp.raw_content}
            </div>
          )}

          {/* 关键词 */}
          {opp.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {opp.keywords.map(k => (
                <span key={k} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{k}</span>
              ))}
            </div>
          )}

          {/* 来源链接 */}
          {opp.source_url && (
            <a
              href={opp.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline"
            >
              查看原始链接 →
            </a>
          )}

          {/* 操作区 */}
          <div className="space-y-3 pt-1">
            {/* 评分 */}
            <div>
              <p className="text-xs text-slate-400 mb-2">我的评分{opp.rating_count > 0 ? ` · ${opp.rating_count} 人已评` : ''}</p>
              <div className="flex gap-2 flex-wrap">
                {SCORES.map(score => (
                  <button
                    key={score}
                    onClick={() => onRate(opp.id, score)}
                    className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all border ${
                      opp.my_rating === score
                        ? `${SCORE_COLORS[score]} border-current ring-2 ring-offset-1 ring-current`
                        : 'border-slate-100 text-slate-500 hover:border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {score} · {SCORE_LABELS[score]}
                  </button>
                ))}
              </div>
            </div>

            {/* 按钮区 */}
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant={opp.is_saved ? 'secondary' : 'secondary'}
                onClick={() => onSave(opp.id, !opp.is_saved)}
                icon={opp.is_saved ? '⭐' : '☆'}
              >
                {opp.is_saved ? '已收藏' : '收藏'}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                icon="💬"
                onClick={() => onPullToChat(opp)}
                disabled={pulling}
              >
                {pulling ? '跳转中...' : '拉进对话'}
              </Button>
              <button onClick={onToggle} className="ml-auto text-xs text-slate-400 hover:text-slate-600">收起</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
