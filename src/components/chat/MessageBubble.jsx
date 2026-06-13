import { useState } from 'react'
import { Button } from '../ui/Button.jsx'
import { sendFeedback, createTaskFromMessage } from '../../api/conversations.js'

function renderMarkdown(text) {
  // 简单 markdown 渲染（无依赖）
  return text
    .replace(/```(\w*)\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="language-${lang}">${escapeHtml(code.trim())}</code></pre>`)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/^#{3}\s(.+)$/gm, '<h3>$1</h3>')
    .replace(/^#{2}\s(.+)$/gm, '<h2>$1</h2>')
    .replace(/^#{1}\s(.+)$/gm, '<h1>$1</h1>')
    .replace(/^\-\s(.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]+?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[h|u|p|l|p])/gm, '')
    .split('\n').map(line => {
      if (/^<[hul]/.test(line) || !line.trim()) return line
      return line
    }).join('\n')
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function formatContent(content) {
  // 段落处理
  const paragraphs = content.split(/\n\n+/)
  return paragraphs.map(p => {
    p = p.trim()
    if (!p) return ''
    // 代码块
    if (p.startsWith('```')) return p
    // 标题
    if (/^#{1,3}\s/.test(p)) return p
    // 列表
    if (/^[\-\*]\s/.test(p)) return p
    // 普通段落
    return `<p>${p}</p>`
  }).join('\n')
}

export function MessageBubble({ message, isStreaming = false }) {
  const [feedbackDone, setFeedbackDone] = useState(null)
  const [showTaskForm, setShowTaskForm] = useState(false)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskDue, setTaskDue] = useState('')

  const isAssistant = message.role === 'assistant'
  const isUser = message.role === 'user'

  async function handleFeedback(type) {
    await sendFeedback(message.id, type)
    setFeedbackDone(type)
  }

  async function handleCreateTask(e) {
    e.preventDefault()
    if (!taskTitle.trim()) return
    await createTaskFromMessage(message.id, taskTitle, taskDue || null, null)
    setShowTaskForm(false)
    setTaskTitle('')
  }

  // 渲染 HTML
  const html = isAssistant && message.content
    ? renderMarkdown(message.content)
    : null

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''} group`}>
      {/* 头像 */}
      {isAssistant && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-400 to-blue-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
          AI
        </div>
      )}

      <div className={`flex flex-col gap-1 max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* 气泡 */}
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
            isUser
              ? 'bg-blue-500 text-white rounded-tr-sm'
              : 'bg-white border border-slate-100 text-slate-800 rounded-tl-sm shadow-sm'
          } ${isStreaming ? 'streaming-cursor' : ''}`}
        >
          {isAssistant && html
            ? <div className="message-content" dangerouslySetInnerHTML={{ __html: html }} />
            : <span style={{ whiteSpace: 'pre-wrap' }}>{message.content}</span>
          }
        </div>

        {/* 时间戳 */}
        <span className="text-[11px] text-slate-400 px-1">
          {message.created_at ? new Date(message.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
        </span>

        {/* AI 回复工具栏（hover 显示） */}
        {isAssistant && !isStreaming && message.id && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!feedbackDone ? (
              <>
                <FeedbackBtn icon="👍" title="有用" onClick={() => handleFeedback('useful')} />
                <FeedbackBtn icon="🎯" title="不够准确" onClick={() => handleFeedback('inaccurate')} />
                <FeedbackBtn icon="📎" title="需要更具体" onClick={() => handleFeedback('need_detail')} />
                <FeedbackBtn icon="➕" title="生成任务" onClick={() => setShowTaskForm(v => !v)} />
              </>
            ) : (
              <span className="text-xs text-slate-400 px-1">反馈已记录 ✓</span>
            )}
          </div>
        )}

        {/* 生成任务表单 */}
        {showTaskForm && (
          <form onSubmit={handleCreateTask} className="flex gap-2 items-center mt-1 bg-slate-50 border border-slate-200 rounded-xl p-3">
            <input
              className="flex-1 text-sm border border-slate-200 rounded-lg px-3 py-1.5 outline-none focus:border-blue-400 bg-white"
              placeholder="任务标题..."
              value={taskTitle}
              onChange={e => setTaskTitle(e.target.value)}
              autoFocus
            />
            <input
              type="date"
              className="text-sm border border-slate-200 rounded-lg px-2 py-1.5 outline-none focus:border-blue-400 bg-white"
              value={taskDue}
              onChange={e => setTaskDue(e.target.value)}
            />
            <Button size="sm" type="submit">创建</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setShowTaskForm(false)}>✕</Button>
          </form>
        )}
      </div>
    </div>
  )
}

function FeedbackBtn({ icon, title, onClick }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="text-sm p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-500 hover:text-slate-700"
    >
      {icon}
    </button>
  )
}
