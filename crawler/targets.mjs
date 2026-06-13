/**
 * 目标机构采购公告监控列表
 * 覆盖真空冶金设备的主要买家群体：
 *   - 中科院系研究所（高温合金、金属材料、核材料）
 *   - 航空航天研究院（高温合金精密加工）
 *   - 核工业研究院（特种金属材料）
 *   - 985/211 高校材料与冶金学院
 *   - 重点央企研究院
 *
 * URL 维护说明：各机构采购/招标页面 URL 偶有变更，
 * 建议每季度人工核查一次，更新 url 和 altUrls 字段。
 */

export const TARGETS = [
  // ══════════════════════════════════════════════
  //  中科院系统
  // ══════════════════════════════════════════════
  {
    id: 'cas-imr',
    name: '中国科学院金属研究所',
    shortName: 'IMR-CAS',
    region: '沈阳',
    url: 'http://www.imr.cas.cn/tzgg/',
    altUrls: ['http://www.imr.cas.cn/ggtz/'],
    priority: 'high',
    keywords: ['真空熔炼', '感应炉', '高温合金', '金属材料'],
  },
  {
    id: 'cas-nimte',
    name: '中国科学院宁波材料技术与工程研究所',
    shortName: 'NIMTE-CAS',
    region: '宁波',
    url: 'https://www.nimte.ac.cn/cggg/',
    altUrls: ['https://www.nimte.ac.cn/tzgg/'],
    priority: 'high',
    keywords: ['真空镀膜', '表面处理', '新型合金'],
  },
  {
    id: 'cas-ipc',
    name: '中国科学院过程工程研究所',
    shortName: 'IPE-CAS',
    region: '北京',
    url: 'http://www.ipe.ac.cn/cggg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['真空设备', '冶金工艺', '粉末冶金'],
  },
  {
    id: 'cas-sic',
    name: '中国科学院上海硅酸盐研究所',
    shortName: 'SIC-CAS',
    region: '上海',
    url: 'https://www.sic.cas.cn/cggg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['高温材料', '特种陶瓷', '真空烧结'],
  },
  {
    id: 'cas-fjirsm',
    name: '中国科学院福建物质结构研究所',
    shortName: 'FJIRSM-CAS',
    region: '福州',
    url: 'https://www.fjirsm.ac.cn/cggg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['特种材料', '晶体生长'],
  },

  // ══════════════════════════════════════════════
  //  航空航天系统
  // ══════════════════════════════════════════════
  {
    id: 'biam',
    name: '北京航空材料研究院',
    shortName: 'BIAM',
    region: '北京',
    url: 'https://www.biam.ac.cn/xwzx/tzgg/',
    altUrls: ['https://www.biam.ac.cn/cggg/'],
    priority: 'high',
    keywords: ['高温合金', '钛合金', '真空熔炼', '定向凝固'],
  },
  {
    id: 'aecc-biam',
    name: '中国航发北京航空材料研究院',
    shortName: 'AECC-BIAM',
    region: '北京',
    url: 'https://www.aecc.cn/cggg/',
    altUrls: [],
    priority: 'high',
    keywords: ['航空发动机材料', '高温合金', '真空冶金'],
  },
  {
    id: 'casc-101',
    name: '中国航天科技集团一院101所',
    shortName: 'CASC-101',
    region: '北京',
    url: 'https://www.casc.com.cn/tzgg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['液体火箭发动机', '高温材料', '真空设备'],
  },

  // ══════════════════════════════════════════════
  //  核工业系统
  // ══════════════════════════════════════════════
  {
    id: 'cnnc-np',
    name: '中核北方核燃料元件有限公司',
    shortName: 'CNNC-NF',
    region: '包头',
    url: 'https://www.cnnc.com.cn/cggg/',
    altUrls: [],
    priority: 'high',
    keywords: ['核级锆合金', '真空熔炼', '特种金属'],
  },
  {
    id: 'swip',
    name: '核工业西南物理研究院',
    shortName: 'SWIP',
    region: '成都',
    url: 'https://www.swip.ac.cn/tzgg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['聚变材料', '真空设备', '特种合金'],
  },

  // ══════════════════════════════════════════════
  //  985/211 高校 — 材料/冶金学院
  // ══════════════════════════════════════════════
  {
    id: 'ustb',
    name: '北京科技大学材料科学与工程学院',
    shortName: 'USTB',
    region: '北京',
    url: 'https://zfcg.ustb.edu.cn/list.aspx?cateid=3',
    altUrls: ['https://zfcg.ustb.edu.cn/'],
    priority: 'high',
    keywords: ['真空熔炼', '粉末冶金', '金属材料'],
  },
  {
    id: 'csu',
    name: '中南大学材料科学与工程学院',
    shortName: 'CSU',
    region: '长沙',
    url: 'https://www.cgd.csu.edu.cn/info/1024/1001.htm',
    altUrls: ['https://www.csu.edu.cn/cggg/'],
    priority: 'high',
    keywords: ['有色金属', '粉末冶金', '真空冶金', '高温合金'],
  },
  {
    id: 'hit',
    name: '哈尔滨工业大学材料学院',
    shortName: 'HIT',
    region: '哈尔滨',
    url: 'https://finance.hit.edu.cn/cggg/',
    altUrls: [],
    priority: 'high',
    keywords: ['特种材料', '焊接', '真空钎焊', '高温合金'],
  },
  {
    id: 'sjtu-mat',
    name: '上海交通大学材料科学与工程学院',
    shortName: 'SJTU-MAT',
    region: '上海',
    url: 'https://www.sjtu.edu.cn/cggg/',
    altUrls: [],
    priority: 'high',
    keywords: ['高性能合金', '真空熔炼', '凝固技术'],
  },
  {
    id: 'nwpu',
    name: '西北工业大学材料学院',
    shortName: 'NWPU',
    region: '西安',
    url: 'https://gc.nwpu.edu.cn/cggg/',
    altUrls: [],
    priority: 'high',
    keywords: ['高温合金', '钛合金', '真空冶金', '航空材料'],
  },
  {
    id: 'zju-mat',
    name: '浙江大学材料科学与工程学院',
    shortName: 'ZJU-MAT',
    region: '杭州',
    url: 'https://www.zju.edu.cn/cggg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['功能材料', '真空设备', '薄膜材料'],
  },
  {
    id: 'tongji-mat',
    name: '同济大学材料科学与工程学院',
    shortName: 'Tongji',
    region: '上海',
    url: 'https://www.tongji.edu.cn/cggg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['结构材料', '真空处理'],
  },
  {
    id: 'xjtu-mat',
    name: '西安交通大学材料科学与工程学院',
    shortName: 'XJTU',
    region: '西安',
    url: 'https://www.xjtu.edu.cn/cggg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['先进材料', '真空熔炼', '快速凝固'],
  },
  {
    id: 'seu',
    name: '东南大学材料科学与工程学院',
    shortName: 'SEU',
    region: '南京',
    url: 'https://www.seu.edu.cn/cggg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['电子材料', '真空镀膜'],
  },
  {
    id: 'tju-mat',
    name: '天津大学材料科学与工程学院',
    shortName: 'TJU',
    region: '天津',
    url: 'https://www.tju.edu.cn/cggg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['材料加工', '真空处理', '特种合金'],
  },

  // ══════════════════════════════════════════════
  //  重点央企研究院
  // ══════════════════════════════════════════════
  {
    id: 'grinm',
    name: '有研科技集团（北京有色金属研究总院）',
    shortName: 'GRINM',
    region: '北京',
    url: 'https://www.grinm.com/cggg/',
    altUrls: [],
    priority: 'high',
    keywords: ['稀土材料', '有色金属', '真空熔炼', '粉末冶金'],
  },
  {
    id: 'cisri',
    name: '钢铁研究总院',
    shortName: 'CISRI',
    region: '北京',
    url: 'https://www.cisri.com/tzgg/',
    altUrls: [],
    priority: 'high',
    keywords: ['高温合金', '特殊钢', '真空冶金', '定向凝固'],
  },
  {
    id: 'baosteel-research',
    name: '宝钢研究院',
    shortName: 'BRI',
    region: '上海',
    url: 'https://www.baosteel.com/group_cn/03tech/05cg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['高级钢材', '真空处理', '特殊冶金'],
  },
  {
    id: 'general-iron-steel',
    name: '冶金工业规划研究院',
    shortName: 'MPI',
    region: '北京',
    url: 'https://www.mpi.net.cn/cggg/',
    altUrls: [],
    priority: 'low',
    keywords: ['冶金设备', '真空冶金'],
  },

  // ══════════════════════════════════════════════
  //  新能源 / 半导体材料（扩展市场）
  // ══════════════════════════════════════════════
  {
    id: 'sinovation-semi',
    name: '中芯国际集成电路制造',
    shortName: 'SMIC',
    region: '上海',
    url: 'https://www.smics.com/cn/site/page_purchase',
    altUrls: [],
    priority: 'medium',
    keywords: ['溅射靶材', '真空镀膜', '半导体材料'],
  },
  {
    id: 'catl-research',
    name: '宁德时代研究院',
    shortName: 'CATL',
    region: '宁德',
    url: 'https://www.catl.com/cggg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['电池材料', '真空处理', '锂电材料熔炼'],
  },
  {
    id: 'ganfeng',
    name: '赣锋锂业研究院',
    shortName: 'GFL',
    region: '新余',
    url: 'https://www.ganfenglithium.com/cggg/',
    altUrls: [],
    priority: 'medium',
    keywords: ['锂金属', '真空熔炼', '电池级金属'],
  },

  // ══════════════════════════════════════════════
  //  政府采购平台（覆盖面广，更新频繁）
  // ══════════════════════════════════════════════
  {
    id: 'ccgp-national',
    name: '中国政府采购网-科研设备',
    shortName: 'CCGP',
    region: '全国',
    url: 'https://www.ccgp.gov.cn/cggg/zygg/zbgg/?searchtype=2&kw=%E7%9C%9F%E7%A9%BA%E7%86%94%E7%82%BC',
    altUrls: [
      'https://www.ccgp.gov.cn/cggg/zygg/zbgg/?searchtype=2&kw=%E7%9C%9F%E7%A9%BA%E8%A7%86%E7%82%89',
      'https://www.ccgp.gov.cn/cggg/zygg/zbgg/?searchtype=2&kw=%E5%86%B6%E7%82%BC%E8%AE%BE%E5%A4%87',
    ],
    priority: 'high',
    keywords: ['真空熔炼', '真空感应', '熔炼设备'],
    notes: '国家政府采购网，覆盖所有央企/事业单位采购，关键词搜索结果页',
  },
  {
    id: 'zcygov',
    name: '政采云（浙江省政府采购）',
    shortName: 'ZCY',
    region: '浙江',
    url: 'https://www.zcygov.cn/purchase-result?keyword=%E7%9C%9F%E7%A9%BA%E7%86%94%E7%82%BC',
    altUrls: [],
    priority: 'medium',
    keywords: ['真空熔炼', '感应炉', '真空设备'],
    notes: '浙江省全域政府采购平台，公开透明',
  },

  // ══════════════════════════════════════════════
  //  专业军工/国防研究院（信息有限但采购量大）
  // ══════════════════════════════════════════════
  {
    id: 'aecc-siem',
    name: '中国航发沈阳发动机研究所',
    shortName: 'AECC-SIEM',
    region: '沈阳',
    url: 'https://www.aecc.cn/tzgg/',
    altUrls: [],
    priority: 'high',
    keywords: ['航空发动机', '高温合金', '涡轮叶片', '真空熔炼'],
  },
  {
    id: 'avic-625',
    name: '中国航空制造技术研究院（625所）',
    shortName: 'AVIC-625',
    region: '北京',
    url: 'https://www.avic.com/cggg/',
    altUrls: [],
    priority: 'high',
    keywords: ['特种合金', '真空熔炼', '航空材料', '增材制造'],
  },
]

/** 按优先级排序，高优先级先爬 */
export const SORTED_TARGETS = TARGETS.sort((a, b) => {
  const order = { high: 0, medium: 1, low: 2 }
  return (order[a.priority] ?? 2) - (order[b.priority] ?? 2)
})
