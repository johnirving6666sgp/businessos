-- BusinessOS v2.0 - 用户数据（从本地导出，含哈希密码）
-- 用法：npx wrangler d1 execute business-os-db --remote --file=migrations/0002_users.sql

-- 用户
INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, model_tier, permissions, is_active) VALUES ('user_jamie', 'jamie', 'Jamie', '944263c71392b8152a7f364dd18ec516:4c8d3b7b2263fffa1e45903aa030d030ca3f23b03f99e1fef55b84ad6d1a21fd', 'super_admin', 'opus', '{"agents":true,"customers":true,"tasks":true,"quote":true,"quoteTraining":true,"insight":true}', 1);
INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, model_tier, permissions, is_active) VALUES ('user_larry', 'larry', 'Larry', 'ca55a333d5d39629123a55f4a40f297b:f11580348c9f2b5e5a447ebe93a38b4fc5bbec4575c26956597377812f98307a', 'member', 'opus', '{"agents":true,"customers":true,"tasks":true,"quote":true,"quoteTraining":false,"insight":true}', 1);
INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, model_tier, permissions, is_active) VALUES ('user_gu', 'gu', 'Gu', '9960c352df1316bc0a3970cce076f857:d924819d81f135739035bdaed4ab1bdf327243881273e48b7574c36b47ee51dc', 'member', 'opus', '{"agents":true,"customers":false,"tasks":true,"quote":true,"quoteTraining":false,"insight":false}', 1);
INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, model_tier, permissions, is_active) VALUES ('user_xiaodong', 'xiaodong', 'Xiaodong', '1cd7391e24fb75e02c5a9e1001ee4590:9b82884df9390e474893031d01028fa8fd9260eab067f1ce4fb33389bd391285', 'member', 'opus', '{"agents":true,"customers":true,"tasks":true,"quote":false,"quoteTraining":false,"insight":false}', 1);
INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, model_tier, permissions, is_active) VALUES ('user_heli', 'heli', 'Heli', 'c697f3f6324e5a1ac9aa57f98f4b0327:2e569a0c58670d84ad1a8567afb5b8048523a8ebe6c18d4fc341825338182e1b', 'member', 'haiku', '{"agents":true,"customers":false,"tasks":true,"quote":false,"quoteTraining":false,"insight":false}', 1);
INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, model_tier, permissions, is_active) VALUES ('user_guihua', 'guihua', 'Guihua', 'd9e3104dbe3c80ea60fb5555f9ccd498:d3ff7deb235271fc4a3e80a7944644b88e858ec46468cd9f0dfe56ffea16a6c2', 'member', 'haiku', '{"agents":true,"customers":false,"tasks":true,"quote":false,"quoteTraining":false,"insight":false}', 1);
INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, model_tier, permissions, is_active) VALUES ('user_zhiping', 'zhiping', 'Zhiping', '3cb0e1f2cc02614f08ac04043803fc1b:7d7778ebb84768f9ed785e5b7db8af7eda2ffa38b1cc60b9aae7925b6a189ec6', 'member', 'sonnet', '{"agents":true,"customers":false,"tasks":true,"quote":true,"quoteTraining":false,"insight":false}', 1);
INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, model_tier, permissions, is_active) VALUES ('user_luyang', 'luyang', 'Luyang', 'd09b01c55f066b9202d8befaf040c363:21139ecc0dbddb9e8a2a538440bcef011aa0227e5b8c5ea1d50119b7873c7556', 'member', 'sonnet', '{"agents":true,"customers":true,"tasks":true,"quote":false,"quoteTraining":false,"insight":false}', 1);
INSERT OR IGNORE INTO users (id, username, display_name, password_hash, role, model_tier, permissions, is_active) VALUES ('user_kingsong', 'kingsong', 'Kingsong', 'e7aeff39f96667fb25248241efe4127d:75227ef63cffb66f802d06ee1a4028402058b91ed910f08fcf39d094f53323e6', 'member', 'sonnet', '{"agents":true,"customers":false,"tasks":true,"quote":true,"quoteTraining":false,"insight":false}', 1);

-- Agent 配置
INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type) VALUES ('ac_user_jamie', 'user_jamie', 'personal');
INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type) VALUES ('ac_user_larry', 'user_larry', 'personal');
INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type) VALUES ('ac_user_gu', 'user_gu', 'personal');
INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type) VALUES ('ac_user_xiaodong', 'user_xiaodong', 'personal');
INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type) VALUES ('ac_user_heli', 'user_heli', 'personal');
INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type) VALUES ('ac_user_guihua', 'user_guihua', 'personal');
INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type) VALUES ('ac_user_zhiping', 'user_zhiping', 'personal');
INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type) VALUES ('ac_user_luyang', 'user_luyang', 'personal');
INSERT OR IGNORE INTO agent_configs (id, user_id, agent_type) VALUES ('ac_user_kingsong', 'user_kingsong', 'personal');
