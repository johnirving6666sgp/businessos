/**
 * LLM 路由层
 * 支持：Anthropic 直连 / OpenRouter / OpenAI（备用）
 * 统一输出 SSE 流式响应
 */

export const MODEL_MAP = {
  opus:   'claude-opus-4-8',
  sonnet: 'claude-sonnet-4-6',
  haiku:  'claude-haiku-4-5-20251001',
}

/**
 * 获取用户对应的模型名
 */
export function resolveModel(modelTier) {
  return MODEL_MAP[modelTier] || MODEL_MAP.haiku
}

/**
 * 流式聊天（SSE）
 * @param {object} env - CF Worker env bindings
 * @param {string} modelTier - 模型 tier ('opus' | 'sonnet' | 'haiku')
 * @param {{static: string, dynamic: string}|string} system - 系统提示词。
 *        对象形式时 static 段会被标记为可缓存前缀（Anthropic prompt caching）。
 * @param {Array} messages - [{role, content}]
 * @returns {ReadableStream} SSE 流
 */
export function streamChat({ env, modelTier, system, messages }) {
  const model = resolveModel(modelTier)
  // 归一化：兼容旧的纯字符串调用
  const sys = typeof system === 'string'
    ? { static: system, dynamic: '' }
    : { static: system?.static || '', dynamic: system?.dynamic || '' }

  // 优先 Anthropic 直连
  if (env.ANTHROPIC_API_KEY) {
    return streamAnthropic({ apiKey: env.ANTHROPIC_API_KEY, model, system: sys, messages })
  }
  // 备用 OpenRouter
  if (env.OPENROUTER_API_KEY) {
    return streamOpenRouter({ apiKey: env.OPENROUTER_API_KEY, model, system: sys, messages })
  }
  // 最后备用 OpenAI
  if (env.OPENAI_API_KEY) {
    return streamOpenAI({ apiKey: env.OPENAI_API_KEY, system: sys, messages })
  }

  throw new Error('未配置任何 LLM API Key')
}

/** 把 {static, dynamic} 合并成单条 system 字符串（用于不支持分块缓存的后端）*/
function flattenSystem(sys) {
  return [sys.static, sys.dynamic].filter(Boolean).join('\n')
}

// ── Anthropic ──────────────────────────────────────────────────

function streamAnthropic({ apiKey, model, system, messages }) {
  // 把静态身份/公司背景作为可缓存前缀（ephemeral，约 5 分钟 TTL）。
  // 命中后这部分输入按缓存读取计费，成本约为常规的 1/10。
  const systemBlocks = []
  if (system.static) {
    systemBlocks.push({ type: 'text', text: system.static, cache_control: { type: 'ephemeral' } })
  }
  if (system.dynamic) {
    systemBlocks.push({ type: 'text', text: system.dynamic })
  }

  const body = JSON.stringify({
    model,
    max_tokens: 4096,
    stream: true,
    system: systemBlocks.length ? systemBlocks : flattenSystem(system),
    messages: messages.map(m => ({ role: m.role, content: m.content })),
  })

  return new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body,
        })

        if (!res.ok) {
          const err = await res.text()
          controller.enqueue(encodeSSE({ type: 'error', error: `Anthropic ${res.status}: ${err}` }))
          controller.close()
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          const lines = buffer.split('\n')
          buffer = lines.pop()

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') continue
            try {
              const event = JSON.parse(data)
              if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
                controller.enqueue(encodeSSE({ type: 'token', content: event.delta.text }))
              }
              if (event.type === 'message_stop') {
                controller.enqueue(encodeSSE({ type: 'done' }))
              }
            } catch {}
          }
        }
        controller.close()
      } catch (e) {
        controller.enqueue(encodeSSE({ type: 'error', error: e.message }))
        controller.close()
      }
    }
  })
}

// ── OpenRouter ────────────────────────────────────────────────

function streamOpenRouter({ apiKey, model, system, messages }) {
  const msgs = [{ role: 'system', content: flattenSystem(system) }, ...messages]
  const body = JSON.stringify({ model: `anthropic/${model}`, stream: true, messages: msgs })

  return new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body,
        })

        if (!res.ok) {
          controller.enqueue(encodeSSE({ type: 'error', error: `OpenRouter ${res.status}` }))
          controller.close()
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') { controller.enqueue(encodeSSE({ type: 'done' })); continue }
            try {
              const event = JSON.parse(data)
              const content = event.choices?.[0]?.delta?.content
              if (content) controller.enqueue(encodeSSE({ type: 'token', content }))
            } catch {}
          }
        }
        controller.close()
      } catch (e) {
        controller.enqueue(encodeSSE({ type: 'error', error: e.message }))
        controller.close()
      }
    }
  })
}

// ── OpenAI ────────────────────────────────────────────────────

function streamOpenAI({ apiKey, system, messages }) {
  const msgs = [{ role: 'system', content: flattenSystem(system) }, ...messages]
  const body = JSON.stringify({ model: 'gpt-4o', stream: true, messages: msgs })

  return new ReadableStream({
    async start(controller) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body,
        })

        if (!res.ok) {
          controller.enqueue(encodeSSE({ type: 'error', error: `OpenAI ${res.status}` }))
          controller.close()
          return
        }

        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split('\n')
          buffer = lines.pop()

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6).trim()
            if (data === '[DONE]') { controller.enqueue(encodeSSE({ type: 'done' })); continue }
            try {
              const event = JSON.parse(data)
              const content = event.choices?.[0]?.delta?.content
              if (content) controller.enqueue(encodeSSE({ type: 'token', content }))
            } catch {}
          }
        }
        controller.close()
      } catch (e) {
        controller.enqueue(encodeSSE({ type: 'error', error: e.message }))
        controller.close()
      }
    }
  })
}

// ── Helpers ───────────────────────────────────────────────────

function encodeSSE(data) {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`)
}
