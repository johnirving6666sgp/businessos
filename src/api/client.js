/**
 * API 客户端
 * token 从 localStorage 读取，以 Authorization: Bearer 发送
 * 同时带 credentials: 'include' 保留 cookie 作为备用
 */

const BASE = ''

function getToken() {
  return localStorage.getItem('bos_token') || ''
}

async function request(path, options = {}) {
  const token = getToken()
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  }

  const res = await fetch(BASE + path, {
    credentials: 'include',
    ...options,
    headers,
  })

  if (!res.ok) {
    let message = `HTTP ${res.status}`
    try { const data = await res.json(); message = data.error || message } catch {}
    const err = new Error(message)
    err.status = res.status
    throw err
  }

  const contentType = res.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return res.json()
  if (contentType.includes('text/event-stream')) return res
  return res
}

export const api = {
  get:    (path, options)       => request(path, { method: 'GET', ...options }),
  post:   (path, body, options) => request(path, { method: 'POST',  body: body != null ? JSON.stringify(body) : undefined, ...options }),
  patch:  (path, body, options) => request(path, { method: 'PATCH', body: body != null ? JSON.stringify(body) : undefined, ...options }),
  delete: (path, options)       => request(path, { method: 'DELETE', ...options }),
}

export async function readSSE(res, onEvent) {
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
      try { onEvent(JSON.parse(data)) } catch {}
    }
  }
}
