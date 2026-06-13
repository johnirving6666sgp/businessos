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
 * @param {string} model - 模型 tier ('opus' | 'sonnet' | 'haiku')
 * @param {string} systemPrompt
 * @param {Array} messages - [{role, content}]
 * @returns {ReadableStream} SSE 流
 */
export function streamChat({ env, modelTier, systemPrompt, messages }) {
  const model = resolveModel(modelTier)

  // 优先 Anthropic 直连
  if (env.ANTHROPIC_API_KEY) {
    return streamAnthropic({ apiKey: env.ANTHROPIC_API_KEY, model, systemPrompt, messages })
  }
  // 备用 OpenRouter
  if (env.OPENROUTER_API_KEY) {
    return streamOpenRouter({ apiKey: env.OPENROUTER_API_KEY, model, systemPrompt, messages })
  }
  // 最后备用 OpenAI
  if (env.OPENAI_API_KEY) {
    return streamOpenAI({ apiKey: env.OPENAI_API_KEY, systemPrompt, messages })
  }

  throw new Error('未配置任何 LLM API Key')
}

// ── Anthropic ──────────────────────────────────────────────────

function streamAnthropic({ apiKey, model, systemPrompt, messages }) {
  const body = JSON.stringify({
    model,
    max_tokens: 4096,
    stream: true,
    system: systemPrompt,
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

function streamOpenRouter({ apiKey, model, systemPrompt, messages }) {
  const msgs = [{ role: 'system', content: systemPrompt }, ...messages]
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

function streamOpenAI({ apiKey, systemPrompt, messages }) {
  const msgs = [{ role: 'system', content: systemPrompt }, ...messages]
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
