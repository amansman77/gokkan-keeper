CREATE TABLE gk_data_revisions (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 table_name TEXT NOT NULL,
 record_id TEXT NOT NULL,
 operation TEXT NOT NULL CHECK(operation IN ('UPDATE','DELETE')),
 previous_json TEXT NOT NULL CHECK(json_valid(previous_json)),
 recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX idx_gk_data_revisions_record ON gk_data_revisions(table_name, record_id, id DESC);
-- Revisions are private, and deliberately survive deletion of the parent record.

CREATE TRIGGER gk_granaries_revision_update AFTER UPDATE ON gk_granaries
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_granaries', OLD.id, 'UPDATE', json_object('id', OLD.id, 'name', OLD.name, 'purpose', OLD.purpose, 'currency', OLD.currency, 'owner', OLD.owner, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'is_public', OLD.is_public, 'public_thesis', OLD.public_thesis, 'public_order', OLD.public_order, 'last_public_update', OLD.last_public_update)); END;

CREATE TRIGGER gk_granaries_revision_delete AFTER DELETE ON gk_granaries
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_granaries', OLD.id, 'DELETE', json_object('id', OLD.id, 'name', OLD.name, 'purpose', OLD.purpose, 'currency', OLD.currency, 'owner', OLD.owner, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'is_public', OLD.is_public, 'public_thesis', OLD.public_thesis, 'public_order', OLD.public_order, 'last_public_update', OLD.last_public_update)); END;

CREATE TRIGGER gk_snapshots_revision_update AFTER UPDATE ON gk_snapshots
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_snapshots', OLD.id, 'UPDATE', json_object('id', OLD.id, 'granary_id', OLD.granary_id, 'date', OLD.date, 'total_amount', OLD.total_amount, 'available_balance', OLD.available_balance, 'memo', OLD.memo, 'created_at', OLD.created_at, 'profit_loss', OLD.profit_loss)); END;

CREATE TRIGGER gk_snapshots_revision_delete AFTER DELETE ON gk_snapshots
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_snapshots', OLD.id, 'DELETE', json_object('id', OLD.id, 'granary_id', OLD.granary_id, 'date', OLD.date, 'total_amount', OLD.total_amount, 'available_balance', OLD.available_balance, 'memo', OLD.memo, 'created_at', OLD.created_at, 'profit_loss', OLD.profit_loss)); END;

CREATE TRIGGER gk_positions_revision_update AFTER UPDATE ON gk_positions
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_positions', OLD.id, 'UPDATE', json_object('id', OLD.id, 'granary_id', OLD.granary_id, 'name', OLD.name, 'symbol', OLD.symbol, 'market', OLD.market, 'asset_type', OLD.asset_type, 'quantity', OLD.quantity, 'avg_cost', OLD.avg_cost, 'current_value', OLD.current_value, 'weight_percent', OLD.weight_percent, 'profit_loss', OLD.profit_loss, 'profit_loss_percent', OLD.profit_loss_percent, 'note', OLD.note, 'is_public', OLD.is_public, 'public_thesis', OLD.public_thesis, 'public_order', OLD.public_order, 'last_public_update', OLD.last_public_update, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'target_weight_percent', OLD.target_weight_percent, 'price_currency', OLD.price_currency, 'source', OLD.source, 'source_record_id', OLD.source_record_id)); END;

CREATE TRIGGER gk_positions_revision_delete AFTER DELETE ON gk_positions
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_positions', OLD.id, 'DELETE', json_object('id', OLD.id, 'granary_id', OLD.granary_id, 'name', OLD.name, 'symbol', OLD.symbol, 'market', OLD.market, 'asset_type', OLD.asset_type, 'quantity', OLD.quantity, 'avg_cost', OLD.avg_cost, 'current_value', OLD.current_value, 'weight_percent', OLD.weight_percent, 'profit_loss', OLD.profit_loss, 'profit_loss_percent', OLD.profit_loss_percent, 'note', OLD.note, 'is_public', OLD.is_public, 'public_thesis', OLD.public_thesis, 'public_order', OLD.public_order, 'last_public_update', OLD.last_public_update, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'target_weight_percent', OLD.target_weight_percent, 'price_currency', OLD.price_currency, 'source', OLD.source, 'source_record_id', OLD.source_record_id)); END;

CREATE TRIGGER gk_cash_flows_revision_update AFTER UPDATE ON gk_cash_flows
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_cash_flows', OLD.id, 'UPDATE', json_object('id', OLD.id, 'granary_id', OLD.granary_id, 'date', OLD.date, 'type', OLD.type, 'amount', OLD.amount, 'memo', OLD.memo, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'money_currency', OLD.money_currency, 'amount_minor', OLD.amount_minor)); END;

CREATE TRIGGER gk_cash_flows_revision_delete AFTER DELETE ON gk_cash_flows
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_cash_flows', OLD.id, 'DELETE', json_object('id', OLD.id, 'granary_id', OLD.granary_id, 'date', OLD.date, 'type', OLD.type, 'amount', OLD.amount, 'memo', OLD.memo, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'money_currency', OLD.money_currency, 'amount_minor', OLD.amount_minor)); END;

CREATE TRIGGER gk_judgment_diary_entries_revision_update AFTER UPDATE ON gk_judgment_diary_entries
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_judgment_diary_entries', OLD.id, 'UPDATE', json_object('id', OLD.id, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'title', OLD.title, 'summary', OLD.summary, 'action', OLD.action, 'market_context', OLD.market_context, 'decision', OLD.decision, 'assets_json', OLD.assets_json, 'position_change_json', OLD.position_change_json, 'risk', OLD.risk, 'invalidate_conditions_json', OLD.invalidate_conditions_json, 'next_check', OLD.next_check, 'emotion_state', OLD.emotion_state, 'confidence', OLD.confidence, 'time_horizon', OLD.time_horizon, 'strategy_tags_json', OLD.strategy_tags_json, 'refs_json', OLD.refs_json, 'disclaimer_visible', OLD.disclaimer_visible, 'reviewed_at', OLD.reviewed_at, 'outcome', OLD.outcome, 'what_was_right', OLD.what_was_right, 'what_was_wrong', OLD.what_was_wrong, 'lesson', OLD.lesson, 'next_action', OLD.next_action, 'main_content', OLD.main_content)); END;

CREATE TRIGGER gk_judgment_diary_entries_revision_delete AFTER DELETE ON gk_judgment_diary_entries
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_judgment_diary_entries', OLD.id, 'DELETE', json_object('id', OLD.id, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at, 'title', OLD.title, 'summary', OLD.summary, 'action', OLD.action, 'market_context', OLD.market_context, 'decision', OLD.decision, 'assets_json', OLD.assets_json, 'position_change_json', OLD.position_change_json, 'risk', OLD.risk, 'invalidate_conditions_json', OLD.invalidate_conditions_json, 'next_check', OLD.next_check, 'emotion_state', OLD.emotion_state, 'confidence', OLD.confidence, 'time_horizon', OLD.time_horizon, 'strategy_tags_json', OLD.strategy_tags_json, 'refs_json', OLD.refs_json, 'disclaimer_visible', OLD.disclaimer_visible, 'reviewed_at', OLD.reviewed_at, 'outcome', OLD.outcome, 'what_was_right', OLD.what_was_right, 'what_was_wrong', OLD.what_was_wrong, 'lesson', OLD.lesson, 'next_action', OLD.next_action, 'main_content', OLD.main_content)); END;

CREATE TRIGGER gk_settings_revision_update AFTER UPDATE ON gk_settings
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_settings', OLD.key, 'UPDATE', json_object('key', OLD.key, 'value', OLD.value, 'updated_at', OLD.updated_at)); END;

CREATE TRIGGER gk_settings_revision_delete AFTER DELETE ON gk_settings
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_settings', OLD.key, 'DELETE', json_object('key', OLD.key, 'value', OLD.value, 'updated_at', OLD.updated_at)); END;

CREATE TRIGGER gk_alert_thresholds_revision_update AFTER UPDATE ON gk_alert_thresholds
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_alert_thresholds', OLD.id, 'UPDATE', json_object('id', OLD.id, 'symbol', OLD.symbol, 'label', OLD.label, 'direction', OLD.direction, 'threshold', OLD.threshold, 'enabled', OLD.enabled, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at)); END;

CREATE TRIGGER gk_alert_thresholds_revision_delete AFTER DELETE ON gk_alert_thresholds
BEGIN INSERT INTO gk_data_revisions (table_name, record_id, operation, previous_json)
VALUES ('gk_alert_thresholds', OLD.id, 'DELETE', json_object('id', OLD.id, 'symbol', OLD.symbol, 'label', OLD.label, 'direction', OLD.direction, 'threshold', OLD.threshold, 'enabled', OLD.enabled, 'created_at', OLD.created_at, 'updated_at', OLD.updated_at)); END;

CREATE TRIGGER gk_settings_rsi_insert BEFORE INSERT ON gk_settings
WHEN NEW.key IN ('weekly_report_rsi_overbought','weekly_report_rsi_oversold') AND (
 CASE WHEN json_valid(NEW.value) THEN json_type(NEW.value) NOT IN ('integer','real') ELSE 1 END OR
 CAST(NEW.value AS REAL) <= 0 OR CAST(NEW.value AS REAL) >= 100 OR
 (NEW.key = 'weekly_report_rsi_overbought' AND CAST(NEW.value AS REAL) <= coalesce((SELECT CAST(value AS REAL) FROM gk_settings WHERE key = 'weekly_report_rsi_oversold'), 30)) OR
 (NEW.key = 'weekly_report_rsi_oversold' AND CAST(NEW.value AS REAL) >= coalesce((SELECT CAST(value AS REAL) FROM gk_settings WHERE key = 'weekly_report_rsi_overbought'), 70)))
BEGIN SELECT RAISE(ABORT, 'rsi_threshold_invalid'); END;

CREATE TRIGGER gk_settings_rsi_update BEFORE UPDATE ON gk_settings
WHEN NEW.key IN ('weekly_report_rsi_overbought','weekly_report_rsi_oversold') AND (
 CASE WHEN json_valid(NEW.value) THEN json_type(NEW.value) NOT IN ('integer','real') ELSE 1 END OR
 CAST(NEW.value AS REAL) <= 0 OR CAST(NEW.value AS REAL) >= 100 OR
 (NEW.key = 'weekly_report_rsi_overbought' AND CAST(NEW.value AS REAL) <= coalesce((SELECT CAST(value AS REAL) FROM gk_settings WHERE key = 'weekly_report_rsi_oversold'), 30)) OR
 (NEW.key = 'weekly_report_rsi_oversold' AND CAST(NEW.value AS REAL) >= coalesce((SELECT CAST(value AS REAL) FROM gk_settings WHERE key = 'weekly_report_rsi_overbought'), 70)))
BEGIN SELECT RAISE(ABORT, 'rsi_threshold_invalid'); END;

DROP INDEX idx_gk_snapshots_granary_date;
CREATE INDEX idx_gk_snapshots_date ON gk_snapshots(date DESC, id DESC);
CREATE INDEX idx_gk_cash_flows_granary_date ON gk_cash_flows(granary_id, date DESC, id DESC);
CREATE INDEX idx_gk_positions_granary_updated ON gk_positions(granary_id, updated_at DESC, id DESC);
CREATE INDEX idx_gk_positions_updated ON gk_positions(updated_at DESC, id DESC);
CREATE INDEX idx_gk_positions_public_sorted ON gk_positions(is_public, public_order, updated_at DESC, id DESC);
CREATE INDEX idx_gk_alert_log_sent ON gk_alert_log(sent_at DESC, id DESC);
CREATE INDEX idx_gk_alert_sent_time ON gk_alert_sent(sent_at);
CREATE INDEX idx_gk_alert_outbox_delivered ON gk_alert_outbox(delivered_at) WHERE delivered_at IS NOT NULL;
CREATE INDEX idx_gk_diary_created ON gk_judgment_diary_entries(created_at DESC, id DESC);
CREATE INDEX idx_gk_diary_action_created ON gk_judgment_diary_entries(action, created_at DESC, id DESC);

-- Composite indexes cover these old single-column prefixes.
DROP INDEX idx_positions_granary_id;
DROP INDEX idx_positions_is_public;
DROP INDEX idx_cash_flows_granary_id;
DROP INDEX idx_gk_judgment_diary_created_at;
DROP INDEX idx_gk_judgment_diary_action;
