-- 群組功能資料庫遷移腳本
-- 執行方式：在 Cloudflare D1 控制台執行此 SQL

-- 1. 建立群組表
CREATE TABLE IF NOT EXISTS groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    color TEXT DEFAULT '#3B82F6',
    icon TEXT DEFAULT '📁',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_groups_user ON groups(user_id);
CREATE INDEX IF NOT EXISTS idx_groups_name ON groups(user_id, name);

-- 2. 建立交易-群組關聯表（多對多）
CREATE TABLE IF NOT EXISTS record_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    record_id INTEGER NOT NULL,
    group_id INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE,
    FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
    UNIQUE(record_id, group_id)
);

CREATE INDEX IF NOT EXISTS idx_record_groups_record ON record_groups(record_id);
CREATE INDEX IF NOT EXISTS idx_record_groups_group ON record_groups(group_id);

-- 3. 擴充資產快照表（支援群組快照）
-- 檢查欄位是否存在，如果不存在才新增
-- SQLite 不支援 IF NOT EXISTS 語法用於 ALTER TABLE，需要手動檢查
-- 如果執行時提示 "duplicate column name"，表示欄位已存在，可忽略此錯誤

ALTER TABLE portfolio_snapshots ADD COLUMN group_id INTEGER DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_snapshots_group ON portfolio_snapshots(user_id, group_id);

-- 4. 建立預設群組（每個使用者首次登入時可選擇性執行）
-- 這部分由應用層處理，此處僅為示例
-- INSERT INTO groups (user_id, name, description, color, icon) VALUES 
-- ('user@example.com', '長線投資', '長期持有的價值股', '#10B981', '🌱'),
-- ('user@example.com', '短線交易', '波段操作的投機股', '#F59E0B', '⚡'),
-- ('user@example.com', '核心持倉', '核心配置的ETF與大型股', '#3B82F6', '🎯');

-- 遷移完成提示
SELECT 'Groups migration completed successfully!' AS status;
