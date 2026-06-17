import { describe, it, expect } from 'vitest'
import {
  detectContextLevel, detectIntentSignals, extractActions, buildSystemPrompt,
} from './agent.mjs'

describe('detectContextLevel', () => {
  it('空消息为 Level 0', () => {
    expect(detectContextLevel([])).toBe(0)
    expect(detectContextLevel(null)).toBe(0)
  })
  it('无业务意图为 Level 0', () => {
    expect(detectContextLevel([{ content: '你好，今天天气不错' }])).toBe(0)
  })
  it('单一意图为 Level 1', () => {
    expect(detectContextLevel([{ content: '这个客户怎么样' }])).toBe(1)
  })
  it('多意图升级到 Level 3', () => {
    // 命中 customer + opportunity + proposal
    expect(detectContextLevel([{ content: '这个客户的招标方案报价' }])).toBe(3)
  })
})

describe('detectIntentSignals', () => {
  it('标记命中的意图维度', () => {
    const s = detectIntentSignals('准备投标方案')
    expect(s.opportunity).toBe(true) // 投标
    expect(s.proposal).toBe(true)    // 方案
    expect(s.strategy).toBe(false)
  })
})

describe('extractActions', () => {
  it('提取 [[ACTION:type:label]] 结构', () => {
    const actions = extractActions('好的 [[ACTION:create_task:跟进北航]] 以及 [[ACTION:add_note:记录]]')
    expect(actions).toEqual([
      { type: 'create_task', label: '跟进北航' },
      { type: 'add_note', label: '记录' },
    ])
  })
  it('无动作时返回空数组', () => {
    expect(extractActions('普通回复')).toEqual([])
  })
})

describe('buildSystemPrompt', () => {
  // 最小 D1 stub：所有查询返回空集
  const emptyDb = {
    prepare: () => ({
      bind: () => ({ all: async () => ({ results: [] }), first: async () => null, run: async () => ({}) }),
      all: async () => ({ results: [] }),
      first: async () => null,
    }),
  }
  const user = { id: 'user_jamie', display_name: 'Jamie', permissions: '{"customers":true}', model_tier: 'opus' }

  it('返回 {static, dynamic} 且静态段包含公司背景', async () => {
    const sp = await buildSystemPrompt({ user, contextLevel: 0, db: emptyDb, entityRef: null, lastUserMessage: '你好' })
    expect(typeof sp.static).toBe('string')
    expect(typeof sp.dynamic).toBe('string')
    expect(sp.static).toContain('真空冶金设备')
    expect(sp.dynamic).toBe('') // Level 0 无动态上下文
  })

  it('静态段在不同 contextLevel 下字节一致（保证 prompt 缓存命中）', async () => {
    const l0 = await buildSystemPrompt({ user, contextLevel: 0, db: emptyDb, entityRef: null, lastUserMessage: 'x' })
    const l3 = await buildSystemPrompt({ user, contextLevel: 3, db: emptyDb, entityRef: null, lastUserMessage: 'x' })
    expect(l0.static).toBe(l3.static)
  })
})
