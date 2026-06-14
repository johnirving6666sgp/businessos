/**
 * Mode A: 聚合平台爬取
 *
 * 这些平台是专门对外开放的公共服务，不封境外 IP：
 *   1. 中国政府采购网 (ccgp.gov.cn) — 官方强制公开，必须境外可访问
 *   2. 全国公共资源交易平台 (ggzy.gov.cn) — 国家级
 *   3. 中国采购与招标网 (chinabidding.com.cn) — 商业聚合
 *   4. 必联网 (bilian.com) — 招标聚合
 *   5. 政采云 (zcygov.cn) — 浙江省，数据质量高
 *
 * 特点：无需机构 IP 白名单，搜索关键词驱动，HTML 静态渲染
 */

export const AGGREGATOR_TARGETS = [

  // ── 国家政府采购网（最权威，必须对外开放）──────────────
  {
    id: 'ccgp-vim',
    name: '中国政府采购网 — 真空熔炼',
    url: 'https://search.ccgp.gov.cn/bxsearch?searchtype=1&bidType=0&kw=%E7%9C%9F%E7%A9%BA%E7%86%94%E7%82%BC&page=1&pageSize=20',
    type: 'aggregator',
    priority: 'high',
    keywords: ['真空熔炼', '感应炉'],
    linkPattern: /cggg|zbgg|notice|detail/i,
    minContentSize: 3000,
  },
  {
    id: 'ccgp-vim-furnace',
    name: '中国政府采购网 — 真空感应炉',
    url: 'https://search.ccgp.gov.cn/bxsearch?searchtype=1&bidType=0&kw=%E7%9C%9F%E7%A9%BA%E6%84%9F%E5%BA%94%E7%82%89&page=1&pageSize=20',
    type: 'aggregator',
    priority: 'high',
    keywords: ['真空感应炉', '熔炼设备'],
    linkPattern: /cggg|zbgg|notice|detail/i,
    minContentSize: 3000,
  },
  {
    id: 'ccgp-high-temp',
    name: '中国政府采购网 — 高温合金',
    url: 'https://search.ccgp.gov.cn/bxsearch?searchtype=1&bidType=0&kw=%E9%AB%98%E6%B8%A9%E5%90%88%E9%87%91+%E7%86%94%E7%82%BC&page=1&pageSize=20',
    type: 'aggregator',
    priority: 'high',
    keywords: ['高温合金', '真空冶金'],
    linkPattern: /cggg|zbgg|notice|detail/i,
    minContentSize: 3000,
  },
  {
    id: 'ccgp-vacuum-coating',
    name: '中国政府采购网 — 真空镀膜',
    url: 'https://search.ccgp.gov.cn/bxsearch?searchtype=1&bidType=0&kw=%E7%9C%9F%E7%A9%BA%E9%95%80%E8%86%9C&page=1&pageSize=20',
    type: 'aggregator',
    priority: 'medium',
    keywords: ['真空镀膜', '物理气相沉积', 'PVD'],
    linkPattern: /cggg|zbgg|notice|detail/i,
    minContentSize: 3000,
  },

  // ── 全国公共资源交易平台 ──────────────────────────────
  {
    id: 'ggzy-national',
    name: '全国公共资源交易平台 — 真空设备',
    url: 'https://deal.ggzy.gov.cn/ds/deal/dealList_find.jsp?DEAL_TIME=9999&DEAL_TYPE=01&DEAL_CLASSIFY=&DEAL_STAGE=&DEAL_PROVINCE=00&DEAL_CITY=0000&DEAL_PLATFORM=0&DEAL_CONTENT=真空熔炼&PAGESIZE=20&PAGENUMBER=1',
    type: 'aggregator',
    priority: 'medium',
    keywords: ['真空熔炼', '采购'],
    linkPattern: /detail|notice|info/i,
    minContentSize: 2000,
  },

  // ── 政采云（浙江省，数据质量高，系统现代）────────────
  {
    id: 'zcygov-vim',
    name: '政采云 — 真空熔炼',
    url: 'https://www.zcygov.cn/api/mall-purchaseact-query/purchaseList/getList?keyword=真空熔炼&pageNo=1&pageSize=20',
    type: 'aggregator',
    priority: 'medium',
    keywords: ['真空熔炼'],
    linkPattern: /detail|notice/i,
    minContentSize: 500,
    isJson: true,  // API 接口返回 JSON
  },

  // ── 中国招标投标公共服务平台（国家发改委主管）────────
  {
    id: 'cebpubservice',
    name: '中国招标投标公共服务平台',
    url: 'https://www.cebpubservice.com/ctpsp/cGongGaoController/selectCGGList.do?searchContentType=1&searchContent=真空熔炼&pageNum=1&pageSize=20',
    type: 'aggregator',
    priority: 'medium',
    keywords: ['真空熔炼', '高温合金', '真空设备'],
    linkPattern: /detail|gg|notice/i,
    minContentSize: 1000,
  },

  // ── 必联网（商业聚合，覆盖面广）──────────────────────
  {
    id: 'bilian-vim',
    name: '必联网 — 真空熔炼',
    url: 'https://www.bilian.com/search?keywords=真空熔炼&type=1',
    type: 'aggregator',
    priority: 'low',
    keywords: ['真空熔炼', '采购'],
    linkPattern: /info|detail|notice/i,
    minContentSize: 2000,
  },
]

/** 从聚合平台页面中提取公告链接 */
export function extractAggregatorLinks(html, target) {
  const links = []
  const regex = /<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
  let match

  while ((match = regex.exec(html)) !== null) {
    const href = match[1].trim()
    const text = match[2].replace(/<[^>]+>/g, '').trim()

    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue
    if (text.length < 6 || text.length > 120) continue

    // 筛选可能是公告详情的链接
    const isRelevant =
      (target.linkPattern && target.linkPattern.test(href)) ||
      target.keywords.some(kw => text.includes(kw)) ||
      /招标|采购|公告|中标|通知/.test(text)

    if (isRelevant) {
      try {
        const fullUrl = new URL(href, target.url).toString()
        links.push({ href: fullUrl, text })
      } catch {}
    }
  }

  // 去重
  const seen = new Set()
  return links.filter(l => {
    if (seen.has(l.href)) return false
    seen.add(l.href)
    return true
  }).slice(0, 30)
}
