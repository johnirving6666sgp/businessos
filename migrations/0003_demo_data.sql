-- BusinessOS v2.0 - 演示数据（真空熔炼设备行业）
-- 用法（远程）：wrangler d1 execute business-os-db --remote --file=migrations/0002_demo_data.sql
-- 用法（本地）：wrangler d1 execute business-os-db --local  --file=migrations/0002_demo_data.sql

-- ── 客户 ──────────────────────────────────────────────────────
INSERT OR REPLACE INTO customers (id, name, stage, owner_id, industry, contact_name, contact_phone, contact_email, notes, source_opportunity_id) VALUES
  ('cust_001', '北京航空材料研究院',       'quoting',   'user_larry',    '航空航天',     '王志远',    '13901234567', 'wzy@biam.ac.cn',         '评估VIM-200型真空感应熔炼炉，有自动化控制需求', null),
  ('cust_002', '西北有色金属研究院',       'interested', 'user_xiaodong', '稀有金属',     '李建国',    '18992345678', 'ljg@nwmti.cn',           '对冷坩埚悬浮熔炼系统强烈兴趣，预算300-500万', null),
  ('cust_003', '江苏龙腾特种合金有限公司',  'closing',   'user_larry',    '特种合金制造', '陈龙',      '13712345678', 'chenlong@ltalloy.com',   '旧炉超期服役需立即更换，正在比价，竞品介入', null),
  ('cust_004', '中国科学院金属研究所',      'contacted', 'user_gu',       '科研院所',     '张敏',      '024-83978888','zhangmin@imr.ac.cn',     '高熵合金研究项目，需定制化方案，采购流程长', null),
  ('cust_005', '新加坡材料研究与工程研究院', 'interested', 'user_jamie',   '国际科研机构', 'Dr. Chen Wei', '+65-6793-8200', 'chen_wei@imre.a-star.edu.sg', '东南亚重要科研机构，对真空悬浮熔炼技术有强烈兴趣', null);

-- ── 客户互动记录 ──────────────────────────────────────────────
INSERT OR IGNORE INTO customer_interactions (id, customer_id, user_id, type, summary, next_action, next_action_due) VALUES
  ('ci_001', 'cust_001', 'user_larry',    'meeting', '赴京拜访，确认VIM-200需求，对方要求PLC自动化控制系统',   '出具含PLC自动化控制方案的技术报价单', '2026-06-20'),
  ('ci_002', 'cust_002', 'user_xiaodong', 'call',    '电话确认冷坩埚悬浮熔炼系统容量要求为50kg级别',          '安排实验室参观和技术演示',           '2026-06-18'),
  ('ci_003', 'cust_003', 'user_larry',    'visit',   '工厂考察，旧炉已超期服役，对方急需更换，竞品已在谈',     '报价后3天内跟进',                    '2026-06-15');

-- ── 商机（线索池）────────────────────────────────────────────
INSERT OR REPLACE INTO opportunities (id, title, source_platform, source_url, org_name, budget, deadline, status, fetch_quality, raw_content, keywords, crawled_at) VALUES
  ('opp_001', '某航空发动机研究院 镍基高温合金真空熔炼设备采购',   '中国政府采购网', 'https://www.ccgp.gov.cn/mock/001', '中国航发动力研究院',      '800万元',  '2026-07-15', 'active', 90, '采购真空感应熔炼炉1台，要求≥200kg，真空度≤0.01Pa，具备自动浇注功能，提供完整售后培训', '真空感应熔炼,高温合金,镍基,航空', datetime('now')),
  ('opp_002', '国家重点实验室 冷坩埚悬浮熔炼系统采购项目',        '科技部采购平台', 'https://service.most.gov.cn/mock/002', '中科院物理研究所',     '450万元',  '2026-06-30', 'active', 85, '冷坩埚感应悬浮熔炼系统一套，无坩埚污染，悬浮稳定，具备高速摄像接口',                  '冷坩埚,悬浮熔炼,高熵合金,难熔金属', datetime('now')),
  ('opp_003', '某省级稀贵金属产业园区 真空冶炼设备集采',          '省级政采云',     'https://zcy.gov.cn/mock/003',          '江西稀贵金属产业集团', '1200万元', '2026-08-01', 'active', 75, '采购真空冶炼设备5台套：真空感应炉×2、真空自耗炉×2、电子束炉×1',                       '真空冶炼,稀贵金属,真空自耗炉',       datetime('now')),
  ('opp_004', '高校实验室 小型真空电弧熔炼炉采购',                '教育部采购网',   'https://edu.ccgp.gov.cn/mock/004',     '哈尔滨工业大学',        '60万元',   '2026-06-25', 'active', 70, '小型真空电弧熔炼炉1台，容量≥50g，具备翻转熔炼功能，配吸铸模具',                        '真空电弧熔炼,高校,科研,小型',        datetime('now')),
  ('opp_005', '新能源汽车关键材料研究 真空熔炼设备',              '工信部采购',     'https://miit.gov.cn/mock/005',         '比亚迪研究院',          '300万元',  '2026-07-30', 'active', 80, '永磁材料和铜合金研究，50kg级真空感应熔炼炉，配套真空热处理功能，需提供工艺方案',          '新能源,永磁材料,铜合金,真空感应',    datetime('now'));

-- ── 商机评分 ──────────────────────────────────────────────────
INSERT OR IGNORE INTO opportunity_ratings (id, opportunity_id, user_id, score, note) VALUES
  ('r_001', 'opp_001', 'user_larry',    80, '完全匹配VIM-200，航空院采购规范，值得重点跟进'),
  ('r_002', 'opp_001', 'user_gu',       80, '技术要求我们都能满足'),
  ('r_003', 'opp_002', 'user_larry',    60, '冷坩埚是强项，但450万预算偏低'),
  ('r_004', 'opp_003', 'user_xiaodong', 30, '需要电子束炉，我们没有，需外协'),
  ('r_005', 'opp_005', 'user_larry',    60, '新能源赛道新客户，值得开拓');

-- ── 任务 ──────────────────────────────────────────────────────
INSERT OR IGNORE INTO tasks (id, title, assignee_id, creator_id, status, priority, due_date, customer_id, opportunity_id, source_type) VALUES
  ('task_001', '给北京航材院出具VIM-200含自动化控制的完整报价单', 'user_larry',    'user_jamie', 'in_progress', 'high',   '2026-06-20', 'cust_001', null,    'manual'),
  ('task_002', '安排西北有色金属研究院来厂参观和冷坩埚技术演示',  'user_xiaodong', 'user_jamie', 'todo',        'high',   '2026-06-18', 'cust_002', null,    'manual'),
  ('task_003', '跟进龙腾特种合金报价，防止竞品截单',             'user_larry',    'user_larry', 'todo',        'high',   '2026-06-15', 'cust_003', null,    'manual'),
  ('task_004', '准备哈工大小型真空电弧炉投标文件',               'user_zhiping',  'user_jamie', 'todo',        'normal', '2026-06-22', null,       'opp_004','manual'),
  ('task_005', '研究航发动力研究院采购需求，制定技术应标方案',    'user_gu',       'user_jamie', 'todo',        'high',   '2026-07-01', null,       'opp_001','manual'),
  ('task_006', '整理真空悬浮熔炼技术白皮书，用于新加坡客户推介', 'user_luyang',   'user_jamie', 'in_progress', 'normal', '2026-06-30', 'cust_005', null,    'manual');

-- ── 广播通知 ──────────────────────────────────────────────────
INSERT OR IGNORE INTO broadcasts (id, title, content, creator_id, target_user_ids) VALUES
  ('bc_001',
   '本周重点商机：航发院800万采购，请各自评分',
   '航发动力研究院发布真空熔炼设备招标，预算800万，截止7月15日。请在线索池评分，重点说明技术匹配度和竞争风险。Jamie将在本周五汇总后决定是否全力投标。',
   'user_jamie',
   '["user_larry","user_gu","user_xiaodong","user_zhiping"]');
