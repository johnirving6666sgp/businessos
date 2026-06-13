/**
 * Agent 上下文协议 v2
 *
 * 四级上下文：
 *   Level 0 — 纯净：基础身份 + 行业知识（新对话第一条消息）
 *   Level 1 — 轻量：+ 当前任务 + 跟进客户列表
 *   Level 2 — 精准：+ 自动识别的客户/商机完整信息
 *   Level 3 — 完整：+ 方案历史 + 团队知识库
 */

// ── 标签映射 ───────────────────────────────────────────────────

const STAGE_LABELS = {
  untouched: '未接触',
  contacted: '已接触',
  interested: '有意向',
  quoting: '待报价',
  closing: '待成交',
  won: '已成交',
  lost: '已流失',
}

const TASK_STATUS_LABELS = {
  todo: '待办',
  in_progress: '进行中',
  waiting: '等待反馈',
  done: '已完成',
  closed: '已关闭',
}

// ── 角色配置 ───────────────────────────────────────────────────

const ROLE_PROFILES = {
  user_jamie: {
    focus: '战略与管理',
    style: '全局视角，关注业务增长、团队效率、市场机会。回答要有战略高度，兼顾短期执行和长期布局。',
    can_see: ['客户', '商机', '报价', '团队', '市场分析', '竞争对手'],
  },
  user_larry: {
    focus: '大客户销售',
    style: '销售导向，关注成单进度、客户关系、竞品动态。回答要实战，帮助推进销售漏斗，不说废话。',
    can_see: ['客户跟进', '报价', '竞争分析', '商机评估'],
  },
  user_gu: {
    focus: '技术支持与应标',
    style: '技术导向，关注设备参数匹配、应标方案、技术可行性。回答要精准，有数据支撑。',
    can_see: ['技术方案', '设备参数', '招标分析', '客户技术需求'],
  },
  user_xiaodong: {
    focus: '科研院所客户',
    style: '学术客户导向，理解科研需求语言，注重技术深度和服务质量的表达。',
    can_see: ['客户跟进', '技术演示', '商机'],
  },
  user_zhiping: {
    focus: '报价与方案',
    style: '报价工程师视角，关注成本核算、方案完整性、交期承诺。回答严谨，数字准确。',
    can_see: ['报价', '设备参数', '成本', '方案'],
  },
  user_luyang: {
    focus: '市场与国际客户',
    style: '国际化视角，熟悉英语沟通场景，关注市场推广、品牌表达、出口合规。',
    can_see: ['市场分析', '国际客户', '品牌材料'],
  },
  user_kingsong: {
    focus: '技术报价',
    style: '技术+商务结合，能出有说服力的技术报价，理解客户痛点并在方案中体现差异化。',
    can_see: ['报价', '技术方案', '竞争分析'],
  },
}

// ── 意图检测 ───────────────────────────────────────────────────

const INTENT_PATTERNS = {
  customer:    /客户|甲方|业主|合同|拜访|跟进|联系|谈判|合作|回款|签单|成交|关系|下单/,
  task:        /任务|截止|完成|负责|分配|进度|交付|安排|计划|准备|跟进|到期/,
  opportunity: /招标|商机|线索|投标|项目|标书|采购|中标|报名|资格|评标|开标/,
  proposal:    /方案|报价|设备参数|成本|配置|型号|规格|技术要求|清单|配套|售后|交期/,
  knowledge:   /经验|复盘|上次|之前|历史|案例|同类|对比|教训|总结|做过/,
  strategy:    /市场|竞争|战略|布局|机会|趋势|行业|分析|定位|方向/,
}

/**
 * 检测上下文级别
 * 改进：第一条消息也能检测到意图（不再默认 Level 0）
 */
export function detectContextLevel(messages) {
  if (!messages || messages.length === 0) return 0

  // 用最近 4 条（含第一条）做检测
  const recentText = messages.slice(-4).map(m => m.content).join(' ')
  const hits = Object.values(INTENT_PATTERNS).filter(p => p.test(recentText)).length

  if (hits === 0) return 0
  if (hits <= 1) return 1
  if (hits <= 2) return 2
  return 3
}

export function detectIntentSignals(text) {
  const signals = {}
  for (const [key, pattern] of Object.entries(INTENT_PATTERNS)) {
    signals[key] = pattern.test(text)
  }
  return signals
}

/**
 * 从消息文本中自动识别提到的客户或商机
 * 支持全名、前缀、4字以上连续子串的模糊匹配
 */
async function autoResolveEntity(db, text, userId) {
  if (!text || text.length < 2) return null

  const { results: customers } = await db.prepare(
    `SELECT id, name FROM customers WHERE stage NOT IN ('won','lost') LIMIT 30`
  ).all()

  for (const c of customers) {
    if (
      text.includes(c.name) ||
      (c.name.length > 4 && text.includes(c.name.slice(0, 4))) ||
      (c.name.length > 5 && text.includes(c.name.slice(0, 5))) ||
      fuzzySubstrMatch(c.name, text, 4)
    ) {
      return { type: 'customer', id: c.id, name: c.name }
    }
  }

  const { results: opps } = await db.prepare(
    `SELECT id, title, org_name FROM opportunities
     WHERE status NOT IN ('dismissed','merged') AND merged_into IS NULL LIMIT 20`
  ).all()

  for (const o of opps) {
    const keywords = [o.org_name, ...(o.title || '').split(/[，,、\s]+/)].filter(k => k && k.length >= 3)
    for (const kw of keywords) {
      if (text.includes(kw)) {
        return { type: 'opportunity', id: o.id, name: o.title }
      }
    }
  }

  return null
}

/**
 * 检查 name 中是否存在长度 >= minLen 的连续子串出现在 text 中
 * 例如："西北有色金属研究院" 的子串 "西北有色" 匹配文本中的 "西北有研" 失败，
 * 但 "有色金属" 会匹配"有色金属研究院"类文本
 */
function fuzzySubstrMatch(name, text, minLen = 4) {
  for (let start = 0; start <= name.length - minLen; start++) {
    const sub = name.slice(start, start + minLen)
    if (text.includes(sub)) return true
  }
  return false
}

// ── 主构建函数 ─────────────────────────────────────────────────

export async function buildSystemPrompt({ user, contextLevel, db, entityRef, lastUserMessage }) {
  const lines = []
  const profile = ROLE_PROFILES[user.id] || {
    focus: '业务支持',
    style: '专业、简洁、直接。',
    can_see: ['任务', '客户'],
  }

  // 解析权限（user.permissions 是 JSON 字符串）
  const perms = (() => {
    try { return JSON.parse(user.permissions || '{}') } catch { return {} }
  })()

  // ── 身份与公司背景（始终存在）─────────────────────────────
  lines.push(`你是 ${user.display_name} 的专属工作 AI，专注于【${profile.focus}】方向。`)
  lines.push(``)
  lines.push(`【公司背景】`)
  lines.push(`公司专注于真空冶金设备的研发与销售，核心产品线：`)
  lines.push(`- 真空感应熔炼炉（VIM）：主力产品，50kg~2000kg级，真空度可达 ≤0.01Pa，支持精确温控和自动浇注`)
  lines.push(`- 冷坩埚感应悬浮熔炼系统：无坩埚污染，适合高纯度难熔金属（钨、钼、钽、铌）和高熵合金制备`)
  lines.push(`- 真空电弧熔炼炉（VAR/VAM）：用于实验室小批量，50g~50kg级，标配翻转重熔和吸铸功能`)
  lines.push(`- 高熵合金制备系统：多主元合金定制，支持多元素精确配比`)
  lines.push(`- 真空热处理炉：配套设备，最高温度 1600°C`)
  lines.push(``)
  lines.push(`【核心竞争优势】`)
  lines.push(`- 自主研发电源控制系统，响应速度和稳定性优于进口替代方案`)
  lines.push(`- 冷坩埚悬浮技术：国内少数掌握该技术的厂家，尤其适合高纯度活性金属`)
  lines.push(`- 交货周期短：标准型号 12-16 周，定制 20-28 周`)
  lines.push(`- 本地化售后：驻厂工程师响应≤24h，备件库存充足`)
  lines.push(``)
  lines.push(`【主要客户群体】`)
  lines.push(`航空航天研究院所、国家级金属研究所、高校材料学院、特种合金制造企业、新能源材料研究机构`)
  lines.push(``)
  lines.push(`【常见竞争对手】`)
  lines.push(`- 国内：沈阳科航、湖南顶立（真空炉领域）`)
  lines.push(`- 进口：德国 ALD、英国 Consarc（价格高 3-5 倍，交期 6-12 月）`)
  lines.push(`我们的定位：性能接近进口，价格低 40-60%，交期快，售后本地化`)
  lines.push(``)
  lines.push(`【你的工作风格】`)
  lines.push(profile.style)
  lines.push(``)
  lines.push(`【回答原则】`)
  lines.push(`1. 直接给出答案，不废话，不重复问题`)
  lines.push(`2. 技术参数不确定时，说"需要确认"，不编造数字`)
  lines.push(`3. 销售场景下，帮用户找到推进成单的最短路径`)
  lines.push(`4. 如有明确的下一步行动，在回答末尾列出（最多3条）`)

  // ── Level 1：当前工作状态 ──────────────────────────────────
  if (contextLevel >= 1) {
    try {
      const { results: myTasks } = await db.prepare(
        `SELECT title, status, due_date, priority FROM tasks
         WHERE assignee_id = ? AND status NOT IN ('done','closed')
         ORDER BY CASE priority WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
                  CASE WHEN due_date IS NULL THEN 1 ELSE 0 END, due_date ASC
         LIMIT 5`
      ).bind(user.id).all()

      if (myTasks.length > 0) {
        lines.push(`\n【我当前的待办事项】`)
        for (const t of myTasks) {
          const due = t.due_date ? `截止 ${t.due_date}` : '无截止'
          const pri = t.priority === 'high' ? '🔴' : '🟡'
          lines.push(`${pri} ${t.title}（${TASK_STATUS_LABELS[t.status]}，${due}）`)
        }
      }
    } catch (e) {
      lines.push(`\n[任务数据加载失败]`)
    }

    // 仅当用户有 customers 权限时才加载客户列表
    if (perms.customers) {
      try {
        const { results: myCustomers } = await db.prepare(
          `SELECT name, stage, last_interaction_at,
                  CAST((julianday('now') - julianday(COALESCE(last_interaction_at, created_at))) AS INTEGER) as days_silent
           FROM customers
           WHERE owner_id = ? AND stage NOT IN ('won','lost')
           ORDER BY CASE stage
             WHEN 'closing' THEN 1 WHEN 'quoting' THEN 2 WHEN 'interested' THEN 3
             WHEN 'contacted' THEN 4 ELSE 5 END, last_interaction_at ASC
           LIMIT 5`
        ).bind(user.id).all()

        if (myCustomers.length > 0) {
          lines.push(`\n【我负责的客户（按进度排序）】`)
          for (const c of myCustomers) {
            const silent = c.days_silent > 7 ? ` ⚠️ ${c.days_silent}天未联系` : ''
            lines.push(`- ${c.name}（${STAGE_LABELS[c.stage]}）${silent}`)
          }
        }
      } catch (e) {
        lines.push(`\n[客户数据加载失败]`)
      }
    }
  }

  // ── Level 2：精准实体上下文（自动识别 + 手动传入）─────────

  let resolvedEntity = entityRef
  if (!resolvedEntity && lastUserMessage && contextLevel >= 2) {
    try {
      resolvedEntity = await autoResolveEntity(db, lastUserMessage, user.id)
    } catch (e) { /* 实体识别失败不影响主流程 */ }
  }

  if (contextLevel >= 2 && resolvedEntity) {
    // 客户详情：需要 customers 权限
    if (resolvedEntity.type === 'customer' && perms.customers) {
      try {
        const c = await db.prepare('SELECT * FROM customers WHERE id = ?').bind(resolvedEntity.id).first()
        if (c) {
          lines.push(`\n【📋 当前聚焦客户：${c.name}】`)
          lines.push(`- 跟进阶段：${STAGE_LABELS[c.stage] || c.stage}`)
          if (c.industry) lines.push(`- 所属行业：${c.industry}`)
          if (c.contact_name) lines.push(`- 核心联系人：${c.contact_name}${c.contact_phone ? '  📞 ' + c.contact_phone : ''}${c.contact_email ? '  ✉️ ' + c.contact_email : ''}`)
          if (c.website) lines.push(`- 官网：${c.website}`)
          if (c.notes) lines.push(`- 情况摘要：${c.notes}`)

          const { results: interactions } = await db.prepare(
            `SELECT type, summary, next_action, next_action_due, created_at
             FROM customer_interactions
             WHERE customer_id = ? ORDER BY created_at DESC LIMIT 5`
          ).bind(c.id).all()

          if (interactions.length > 0) {
            lines.push(`- 历史沟通记录：`)
            for (const i of interactions) {
              const typeLabel = { call: '📞电话', meeting: '🤝会面', email: '📧邮件', visit: '🏭拜访', demo: '🖥️演示', note: '📝备注', stage_change: '🔄阶段变更' }[i.type] || i.type
              lines.push(`  ${i.created_at.slice(0, 10)} [${typeLabel}] ${i.summary}`)
              if (i.next_action) lines.push(`  → 下一步：${i.next_action}${i.next_action_due ? '（' + i.next_action_due + '前）' : ''}`)
            }
          }

          const { results: relatedTasks } = await db.prepare(
            `SELECT title, status, due_date FROM tasks
             WHERE customer_id = ? AND status NOT IN ('done','closed') LIMIT 3`
          ).bind(c.id).all()
          if (relatedTasks.length > 0) {
            lines.push(`- 关联任务：`)
            for (const t of relatedTasks) {
              lines.push(`  · ${t.title}（${TASK_STATUS_LABELS[t.status]}${t.due_date ? '，截止 ' + t.due_date : ''}）`)
            }
          }
        }
      } catch (e) {
        lines.push(`\n[客户详情加载失败]`)
      }
    }

    if (resolvedEntity.type === 'opportunity') {
      try {
        const o = await db.prepare('SELECT * FROM opportunities WHERE id = ?').bind(resolvedEntity.id).first()
        if (o) {
          lines.push(`\n【🎯 当前聚焦商机：${o.title}】`)
          if (o.org_name) lines.push(`- 招标单位：${o.org_name}`)
          if (o.budget) lines.push(`- 预算金额：${o.budget}`)
          if (o.deadline) lines.push(`- 投标截止：${o.deadline}`)
          if (o.source_platform) lines.push(`- 信息来源：${o.source_platform}`)
          if (o.keywords) lines.push(`- 关键词：${o.keywords}`)
          if (o.raw_content) lines.push(`- 招标内容：\n${o.raw_content}`)

          const { results: ratings } = await db.prepare(
            `SELECT u.display_name, r.score, r.note FROM opportunity_ratings r
             JOIN users u ON u.id = r.user_id
             WHERE r.opportunity_id = ? ORDER BY r.score DESC`
          ).bind(o.id).all()
          if (ratings.length > 0) {
            lines.push(`- 团队评分：`)
            for (const r of ratings) {
              const scoreLabel = r.score >= 80 ? '强烈推荐' : r.score >= 60 ? '值得跟进' : r.score >= 30 ? '谨慎评估' : '暂不推荐'
              lines.push(`  · ${r.display_name}：${r.score}分（${scoreLabel}）${r.note ? ' — ' + r.note : ''}`)
            }
          }
        }
      } catch (e) {
        lines.push(`\n[商机详情加载失败]`)
      }
    }
  }

  // ── Level 3：完整上下文 ────────────────────────────────────
  if (contextLevel >= 3) {
    try {
      // 热门未跟进商机（status NOT IN dismissed/merged 覆盖所有活跃状态）
      const { results: hotOpps } = await db.prepare(
        `SELECT o.title, o.org_name, o.budget, o.deadline, MAX(r.score) as max_score
         FROM opportunities o
         JOIN opportunity_ratings r ON r.opportunity_id = o.id
         WHERE o.status NOT IN ('dismissed', 'merged')
           AND o.merged_into IS NULL
           AND o.id NOT IN (SELECT opportunity_id FROM opportunity_ratings WHERE user_id = ?)
         GROUP BY o.id HAVING MAX(r.score) >= 60
         ORDER BY MAX(r.score) DESC LIMIT 3`
      ).bind(user.id).all()

      if (hotOpps.length > 0) {
        lines.push(`\n【🔥 团队热推商机（你尚未评分）】`)
        for (const o of hotOpps) {
          lines.push(`- ${o.title}（${o.org_name}，${o.budget}，截止 ${o.deadline}，团队最高评 ${o.max_score} 分）`)
        }
      }
    } catch (e) { /* 热门商机加载失败不阻断 */ }

    if (resolvedEntity?.type === 'customer' && perms.customers) {
      try {
        const custId = resolvedEntity.id
        const { results: proposals } = await db.prepare(
          `SELECT title, status, price_range_min, price_range_max, updated_at FROM proposals
           WHERE customer_id = ? ORDER BY updated_at DESC LIMIT 3`
        ).bind(custId).all()
        if (proposals.length > 0) {
          lines.push(`\n【📄 历史方案/报价】`)
          for (const p of proposals) {
            const range = p.price_range_min
              ? `${p.price_range_min}~${p.price_range_max} 万元`
              : '价格待定'
            lines.push(`- ${p.title}（${p.status}，${range}，${p.updated_at?.slice(0, 10)}更新）`)
          }
        }
      } catch (e) { /* 方案历史加载失败不阻断 */ }
    }

    try {
      const { results: knowledge } = await db.prepare(
        `SELECT title, content FROM knowledge_items
         WHERE visibility IN ('team','public') AND is_published = 1
         ORDER BY updated_at DESC LIMIT 3`
      ).all()
      if (knowledge.length > 0) {
        lines.push(`\n【📚 团队经验参考】`)
        for (const k of knowledge) {
          lines.push(`- ${k.title}：${k.content.slice(0, 300)}`)
        }
      }
    } catch (e) { /* 知识库加载失败不阻断 */ }
  }

  return lines.join('\n')
}

/**
 * 从 AI 回复中提取结构化动作建议
 */
export function extractActions(content) {
  const actions = []
  const matches = content.matchAll(/\[\[ACTION:(\w+):([^\]]+)\]\]/g)
  for (const m of matches) {
    actions.push({ type: m[1], label: m[2] })
  }
  return actions
}
