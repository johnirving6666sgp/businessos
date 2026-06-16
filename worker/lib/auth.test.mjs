import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword, uid, safeJSON } from './auth.mjs'

describe('密码哈希', () => {
  it('同一密码两次哈希结果不同（随机 salt）', async () => {
    const a = await hashPassword('s3cret!')
    const b = await hashPassword('s3cret!')
    expect(a).not.toBe(b)
    expect(a).toMatch(/^[0-9a-f]+:[0-9a-f]+$/)
  })

  it('正确密码校验通过，错误密码失败', async () => {
    const stored = await hashPassword('correct horse')
    expect(await verifyPassword('correct horse', stored)).toBe(true)
    expect(await verifyPassword('wrong', stored)).toBe(false)
  })

  it('损坏的哈希串不会抛错，返回 false', async () => {
    expect(await verifyPassword('x', 'not-a-valid-hash')).toBe(false)
    expect(await verifyPassword('x', '')).toBe(false)
  })
})

describe('uid', () => {
  it('带前缀且唯一', () => {
    const a = uid('conv')
    const b = uid('conv')
    expect(a.startsWith('conv_')).toBe(true)
    expect(a).not.toBe(b)
  })
  it('无前缀时为纯 hex', () => {
    expect(uid()).toMatch(/^[0-9a-f]+$/)
  })
})

describe('safeJSON', () => {
  it('解析合法 JSON', () => {
    expect(safeJSON('{"a":1}')).toEqual({ a: 1 })
  })
  it('非法 JSON 返回 fallback', () => {
    expect(safeJSON('nope', { x: 1 })).toEqual({ x: 1 })
    expect(safeJSON('[1,', [])).toEqual([])     // 截断的 JSON
    expect(safeJSON(undefined, {})).toEqual({}) // JSON.parse(undefined) 抛错
  })
})
