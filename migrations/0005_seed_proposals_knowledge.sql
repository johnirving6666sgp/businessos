-- ============================================================
-- 演示数据：方案 & 知识库
-- 运行方式：npx wrangler d1 execute business-os-db --remote --file=migrations/0005_seed_proposals_knowledge.sql
-- ============================================================

-- ── 方案数据 ──────────────────────────────────────────────────

-- 方案 1：北京科研院 VIM-100 真空感应熔炼炉
INSERT OR IGNORE INTO proposals (
  id, title, customer_id, creator_id, status,
  price_range_min, price_range_max,
  scope,
  tech_params,
  cost_breakdown,
  risk_points,
  negotiation_space,
  open_questions
) VALUES (
  'prop_001',
  'VIM-100 真空感应熔炼炉整套解决方案',
  (SELECT id FROM customers WHERE name LIKE '%北京%' LIMIT 1),
  (SELECT id FROM users WHERE username = 'zhiping' LIMIT 1),
  'review',
  1200000, 1500000,
  '提供 VIM-100 型真空感应熔炼炉一套，含主机、控制系统、真空系统、水冷系统，以及安装调试、操作培训和一年质保服务。',
  '[
    "熔炼容量：100kg",
    "最高工作温度：1750°C",
    "极限真空度：6.7×10⁻³ Pa",
    "感应功率：250 kW",
    "坩埚寿命：≥80炉次",
    "控制系统：西门子 S7-1500 PLC"
  ]',
  '{
    "主机设备": 850000,
    "真空系统": 180000,
    "控制系统": 120000,
    "水冷系统": 80000,
    "安装调试": 50000,
    "培训与文档": 20000,
    "运输与保险": 30000
  }',
  '1. 客户要求的极限真空度接近我司当前设备上限，需确认技术可行性
2. 现场电力容量是否满足 250kW 感应功率要求（需提前确认）
3. 交货周期：客户希望 4 个月内到货，标准周期为 5-6 个月',
  '总价可在 130 万基础上下浮 5-8%，但须附带延长质保至 18 个月作为条件交换。安装调试费用可适当减免以促成签单。',
  '1. 是否需要配备进样锁（isolock）功能？
2. 坩埚材质需求：氧化铝还是碳化硅？
3. 数据采集接口是否需要对接客户 MES 系统？'
);

-- 方案 2：上海材料研究所 VAR 真空自耗电弧炉
INSERT OR IGNORE INTO proposals (
  id, title, customer_id, creator_id, status,
  price_range_min, price_range_max,
  scope,
  tech_params,
  cost_breakdown,
  risk_points
) VALUES (
  'prop_002',
  'VAR-200 真空自耗电弧炉配套方案',
  (SELECT id FROM customers WHERE name LIKE '%上海%' LIMIT 1),
  (SELECT id FROM users WHERE username = 'kingsong' LIMIT 1),
  'draft',
  1800000, 2200000,
  '供应 VAR-200 型真空自耗电弧炉，主要用于钛合金和高温合金二次熔炼，提升铸锭均匀性和纯净度。含主机、电源系统、真空系统及全套控制软件。',
  '[
    "铸锭最大直径：φ300mm",
    "最大熔炼质量：200kg",
    "熔炼电流：5~20 kA连续可调",
    "极限真空度：1×10⁻² Pa",
    "电弧稳定控制：磁场搅拌系统"
  ]',
  '{
    "主机及电源": 1400000,
    "真空及气氛系统": 250000,
    "自动化控制": 180000,
    "安装调试": 80000,
    "技术培训": 30000
  }',
  '1. VAR 设备对厂房净高要求较高（≥6m），需现场确认
2. 钛合金熔炼对进料纯度要求严格，需配套原料规范培训
3. 竞争对手北京某厂报价 175 万，需差异化说明我司优势'
);

-- 方案 3：中科院国家实验室 已中标项目
INSERT OR IGNORE INTO proposals (
  id, title, customer_id, creator_id, status,
  price_range_min, price_range_max,
  scope
) VALUES (
  'prop_003',
  '高熵合金研究专用多弧离子镀膜系统',
  (SELECT id FROM customers WHERE name LIKE '%科学院%' OR name LIKE '%中科%' LIMIT 1),
  (SELECT id FROM users WHERE username = 'gu' LIMIT 1),
  'won',
  680000, 780000,
  '为高熵合金薄膜研究提供专用多弧离子镀膜系统，支持四元及以上合金靶材同时沉积，含基片加热、偏压控制和全程真空在线监控。'
);

-- ── 知识库数据 ────────────────────────────────────────────────

INSERT OR IGNORE INTO knowledge_items (id, title, content, tags, author_id, visibility, source_type, is_published)
VALUES (
  'kn_001',
  '真空感应熔炼炉（VIM）常见故障与排查手册',
  '## 1. 真空度达不到要求

**现象**：系统运行后极限真空度停留在 10⁻¹ Pa 以上，无法进一步降低。

**原因排查**：
- 检查炉门密封圈是否老化或有划痕，用氦质谱检漏仪扫描炉门法兰
- 确认旋片泵油是否变色（乳白色说明含水）、油位是否正常
- 测量扩散泵加热功率，确认扩散泵油品未裂解
- 检查真空管路各法兰连接处的密封圈

**解决方案**：更换密封圈（推荐 Viton 氟橡胶材质），更换扩散泵油（推荐 Santovac 5）。

---

## 2. 感应线圈打火

**现象**：熔炼过程中控制台报"线圈过流"或"绝缘故障"，伴随异常电流波动。

**原因排查**：
- 线圈与坩埚间距过小（正常间隙 5-8mm）
- 线圈水冷通道堵塞导致局部过热
- 料液飞溅污染线圈表面

**解决方案**：冷却后检查线圈表面，用无水酒精清洁；疏通水冷管路；必要时重新浇铸线圈绝缘层。

---

## 3. 坩埚寿命过短

**行业参考**：氧化铝坩埚正常使用寿命 60-120 炉次，碳化硅坩埚约 40-80 炉次。

**提升寿命的关键点**：
- 首次使用前 850°C 预烧 2h 去除水分
- 避免热冲击：升温速率控制在 ≤200°C/h
- 每次熔炼后彻底清除残留金属',
  '["真空熔炼", "VIM", "故障排查", "设备维护"]',
  (SELECT id FROM users WHERE username = 'gu' LIMIT 1),
  'team', 'manual', 1
);

INSERT OR IGNORE INTO knowledge_items (id, title, content, tags, author_id, visibility, source_type, is_published)
VALUES (
  'kn_002',
  '真空冶金设备招标评分要素与竞标策略',
  '## 常见评分维度（政府/科研院所采购）

1. **技术评分（通常占 60-70%）**
   - 技术参数符合性（满足全部技术要求得满分）
   - 设备稳定性证明（已投运案例≥3个加分）
   - 售后服务方案（本地化服务团队是关键加分项）

2. **商务评分（通常占 30-40%）**
   - 报价合理性（最低价或接近评标基准价）
   - 企业资质（ISO 9001、行业资质证书）
   - 交货期承诺

---

## 竞标实战技巧

**技术壁垒建立**：
- 在技术规范中嵌入我司独有参数（如极限真空度、控制精度），引导采购方制定对我司有利的规格
- 提前与设计院建立关系，参与初步技术规范起草

**价格策略**：
- 一般项目：报评标基准价的 93-97%
- 重大示范项目：可接受较低利润率换取案例资质

**常见失标原因**：
- 未响应技术规格某条款（一票否决风险）
- 保函/资质材料缺失
- 交货期不满足',
  '["招标", "竞标策略", "销售", "评分"]',
  (SELECT id FROM users WHERE username = 'larry' LIMIT 1),
  'team', 'manual', 1
);

INSERT OR IGNORE INTO knowledge_items (id, title, content, tags, author_id, visibility, source_type, is_published)
VALUES (
  'kn_003',
  '高温合金真空熔炼核心工艺参数参考',
  '## 常用高温合金 VIM 工艺参数

| 合金牌号 | 熔炼温度 | 精炼时间 | 真空度要求 | 注意事项 |
|---------|---------|---------|----------|---------|
| GH4169 (IN718) | 1450-1480°C | ≥30min | <0.5 Pa | 控制 Nb 偏析 |
| GH4033 | 1420-1460°C | ≥20min | <1 Pa | 避免 Al 烧损 |
| K465 | 1490-1520°C | ≥25min | <0.1 Pa | 定向凝固前提 |
| DD6 单晶 | 1510-1540°C | ≥30min | <0.05 Pa | 严格控制 O、N |

## 关键控制要点

1. **精炼阶段**：真空度达到要求后保温，目的是去除 H、O、N、S 等有害气体
2. **浇注温度**：一般比精炼温度低 20-30°C，过高导致偏析，过低导致浇不足
3. **Al/Ti 收得率**：标准 VIM 工艺中 Al 收得率约 95%，Ti 约 92%，配料时需补偿
4. **感应功率曲线**：升温阶段 70% 功率，精炼阶段 30-40% 维温，浇注前快速升温',
  '["高温合金", "VIM工艺", "技术参数", "冶金"]',
  (SELECT id FROM users WHERE username = 'gu' LIMIT 1),
  'team', 'manual', 1
);

INSERT OR IGNORE INTO knowledge_items (id, title, content, tags, author_id, visibility, source_type, is_published)
VALUES (
  'kn_004',
  '国际市场开拓：东南亚真空冶金设备需求分析',
  '## 目标市场概况

**越南**（优先级：高）
- 制造业升级政策推动，FDI 涌入带来高端材料需求
- 越南钢铁集团、台资企业是主要潜在客户
- 进口关税：约 0-5%，中越自贸区协定下部分设备免税

**印度尼西亚**（优先级：中）
- 镍矿资源丰富，本地冶金产业链建设需求强
- 政府要求镍矿禁止原矿出口，需本地冶炼，设备需求旺盛
- 合规注意：需印尼 SNI 认证

**泰国**（优先级：中）
- 汽车零部件制造集群，对特种合金需求稳定
- 泰国工业园区（Eastern Economic Corridor）为重点切入口

---

## 推广策略建议

1. 优先参加 METALTECH（马来西亚）、PROPAK ASIA（泰国）展会
2. 与当地代理商合作是进入东南亚的最快路径（避免独自处理海关、语言问题）
3. 融资支持：中国进出口银行优惠贷款可作为差异化卖点，减轻客户资金压力',
  '["国际市场", "东南亚", "市场开拓", "出口"]',
  (SELECT id FROM users WHERE username = 'luyang' LIMIT 1),
  'team', 'manual', 1
);

INSERT OR IGNORE INTO knowledge_items (id, title, content, tags, author_id, visibility, source_type, is_published)
VALUES (
  'kn_005',
  '真空设备报价规范与成本核算指引',
  '## 成本结构参考（以 VIM-100 为例）

| 成本项 | 占比参考 | 备注 |
|-------|---------|-----|
| 原材料/外购件 | 45-55% | 主要：铜材、不锈钢、电气元器件 |
| 加工制造 | 15-20% | 机加工、焊接、装配 |
| 自制件人工 | 8-12% | 含车间管理费用 |
| 外协加工 | 5-8% | 特殊工艺外委 |
| 利润（目标） | 20-30% | 战略项目可压低至 12-15% |

## 报价原则

1. **底线报价**：综合成本 × 1.15（覆盖风险和资金占用）
2. **标准报价**：综合成本 × 1.35-1.45
3. **溢价报价**：科研院所、无竞争对手 → 综合成本 × 1.5+

## 常见报价误区

- 忘记计算运输保险（大型设备运输险约为货值的 0.8-1.2%）
- 安装调试费用估算不足（境外安装需加签证、差旅、海外补贴）
- 忽略质保期内可能产生的维修成本（建议预留货值的 2-3%）',
  '["报价", "成本核算", "定价策略"]',
  (SELECT id FROM users WHERE username = 'zhiping' LIMIT 1),
  'team', 'manual', 1
);
