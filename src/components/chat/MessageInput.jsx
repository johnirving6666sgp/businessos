import { useState, useRef, useCallback } from 'react'
import { Button } from '../ui/Button.jsx'

export function MessageInput({ onSend, disabled = false, placeholder = '输入消息...' }) {
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const textareaRef = useRef(null)
  const mediaRef = useRef(null)
  const chunksRef = useRef([])

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleSend() {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }

  function handleInput(e) {
    setText(e.target.value)
    // 自动增高
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 200) + 'px'
  }

  // 语音录制
  async function toggleRecording() {
    if (recording) {
      mediaRef.current?.stop()
      setRecording(false)
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const recorder = new MediaRecorder(stream)
      chunksRef.current = []
      mediaRef.current = recorder

      recorder.ondataavailable = e => chunksRef.current.push(e.data)
      recorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await transcribeAudio(blob)
      }

      recorder.start()
      setRecording(true)
    } catch (err) {
      console.error('麦克风权限被拒绝', err)
    }
  }

  async function transcribeAudio(blob) {
    const form = new FormData()
    form.append('audio', blob, 'recording.webm')
    try {
      const res = await fetch('/api/speech/transcribe', {
        method: 'POST',
        credentials: 'include',
        body: form,
      })
      if (res.ok) {
        const { text: transcript } = await res.json()
        setText(prev => prev + (prev ? ' ' : '') + transcript)
      }
    } catch (err) {
      console.error('转录失败', err)
    }
  }

  return (
    <div className="flex items-end gap-2 p-3 border-t border-slate-100 bg-white">
      <div className="flex-1 flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl px-3 py-2 focus-within:border-blue-300 transition-colors">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          placeholder={disabled ? '等待回复中...' : placeholder}
          disabled={disabled}
          className="flex-1 bg-transparent resize-none outline-none text-sm text-slate-800 placeholder-slate-400 leading-relaxed max-h-48 disabled:opacity-50"
          style={{ height: 'auto', minHeight: '24px' }}
        />

        {/* 语音按钮 */}
        <button
          onClick={toggleRecording}
          disabled={disabled}
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            recording ? 'bg-red-500 text-white animate-pulse' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
          title={recording ? '停止录音' : '语音输入'}
        >
          🎙
        </button>
      </div>

      {/* 发送按钮 */}
      <Button
        onClick={handleSend}
        disabled={disabled || !text.trim()}
        size="icon"
        className="flex-shrink-0 rounded-xl"
      >
        ↑
      </Button>
    </div>
  )
}
