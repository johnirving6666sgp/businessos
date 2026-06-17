/**
 * Auth helpers — 使用 Web Crypto API（CF Worker 兼容）
 * 密码：PBKDF2-SHA256
 * Session：随机 token 存 D1
 */

export function uid(prefix = '') {
  const bytes = crypto.getRandomValues(new Uint8Array(12))
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return prefix ? `${prefix}_${hex}` : hex
}

// ── 密码 ──────────────────────────────────────────────────────

export async function hashPassword(password) {
  const enc = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${saltHex}:${hashHex}`
}

export async function verifyPassword(password, stored) {
  const [saltHex, hashHex] = stored.split(':')
  if (!saltHex || !hashHex) return false
  const salt = new Uint8Array(saltHex.match(/.{2}/g).map(h => parseInt(h, 16)))
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const computed = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === hashHex
}

// ── Session token ─────────────────────────────────────────────

const SESSION_TTL_DAYS = 30

export async function createSession(db, userId) {
  const id = uid('sess')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86400000).toISOString()
  await db.prepare(
    'INSERT INTO sessions (id, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(id, userId, expiresAt).run()
  return id
}

export async function getSessionUser(db, token) {
  if (!token) return null
  const row = await db.prepare(
    `SELECT u.*, s.expires_at
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.expires_at > datetime('now') AND u.is_active = 1`
  ).bind(token).first()
  return row || null
}

export async function deleteSession(db, token) {
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(token).run()
}

// ── Middleware ────────────────────────────────────────────────

export function requireAuth(permKey) {
  return async (c, next) => {
    const token = getCookieToken(c) || getBearerToken(c)
    const user = await getSessionUser(c.env.DB, token)
    if (!user) return c.json({ error: 'Unauthorized' }, 401)

    const perms = safeJSON(user.permissions, {})
    if (permKey && !perms[permKey]) {
      return c.json({ error: 'Forbidden' }, 403)
    }

    c.set('user', user)
    c.set('perms', perms)
    await next()
  }
}

export function getCookieToken(c) {
  const cookie = c.req.header('cookie') || ''
  const match = cookie.match(/bos_token=([^;]+)/)
  return match ? match[1] : null
}

export function getBearerToken(c) {
  const auth = c.req.header('authorization') || ''
  return auth.startsWith('Bearer ') ? auth.slice(7) : null
}

export function safeJSON(str, fallback = {}) {
  try { return JSON.parse(str) } catch { return fallback }
}

function isHttps(c) {
  try { return new URL(c.req.url).protocol === 'https:' } catch { return false }
}

export function setSessionCookie(c, token) {
  const secure = isHttps(c) ? '; Secure' : ''
  c.header('Set-Cookie', `bos_token=${token}; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=${SESSION_TTL_DAYS * 86400}`)
}

export function clearSessionCookie(c) {
  const secure = isHttps(c) ? '; Secure' : ''
  c.header('Set-Cookie', `bos_token=; Path=/; HttpOnly; SameSite=Lax${secure}; Max-Age=0`)
}
