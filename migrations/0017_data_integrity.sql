-- Add write guards without rebuilding parent tables or cascading existing data.
-- Existing rows are preserved. INSERT/UPDATE are both guarded, including direct SQL.
CREATE TRIGGER gk_granary_currency_lock BEFORE UPDATE OF currency ON gk_granaries
WHEN NEW.currency IS NOT OLD.currency AND (
 EXISTS (SELECT 1 FROM gk_snapshots WHERE granary_id = OLD.id) OR
 EXISTS (SELECT 1 FROM gk_cash_flows WHERE granary_id = OLD.id) OR
 EXISTS (SELECT 1 FROM gk_positions WHERE granary_id = OLD.id))
BEGIN SELECT RAISE(ABORT, 'granary_currency_locked'); END;

CREATE TRIGGER gk_granaries_guard_insert BEFORE INSERT ON gk_granaries
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND NEW.currency IN ('KRW','USD','EUR','JPY','CNY') AND NEW.purpose IN ('비상금','가계','코인','아이들','기타') AND NEW.is_public IN (0,1) AND (NEW.public_order IS NULL OR (typeof(NEW.public_order) = 'integer' AND NEW.public_order >= 0))), 0)
BEGIN SELECT RAISE(ABORT, 'gk_granaries_invalid_record'); END;

CREATE TRIGGER gk_granaries_guard_update BEFORE UPDATE ON gk_granaries
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND NEW.currency IN ('KRW','USD','EUR','JPY','CNY') AND NEW.purpose IN ('비상금','가계','코인','아이들','기타') AND NEW.is_public IN (0,1) AND (NEW.public_order IS NULL OR (typeof(NEW.public_order) = 'integer' AND NEW.public_order >= 0))), 0)
BEGIN SELECT RAISE(ABORT, 'gk_granaries_invalid_record'); END;

CREATE TRIGGER gk_snapshots_guard_insert BEFORE INSERT ON gk_snapshots
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND (length(NEW.date) = 10 AND NEW.date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(NEW.date, '+0 days') = NEW.date) AND typeof(NEW.total_amount) IN ('real','integer') AND NEW.total_amount >= 0 AND NEW.total_amount < 1e308 AND (NEW.available_balance IS NULL OR (typeof(NEW.available_balance) IN ('real','integer') AND NEW.available_balance >= 0 AND NEW.available_balance < 1e308)) AND (NEW.profit_loss IS NULL OR (typeof(NEW.profit_loss) IN ('real','integer') AND abs(NEW.profit_loss) < 1e308))), 0)
BEGIN SELECT RAISE(ABORT, 'gk_snapshots_invalid_record'); END;

CREATE TRIGGER gk_snapshots_guard_update BEFORE UPDATE ON gk_snapshots
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND (length(NEW.date) = 10 AND NEW.date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(NEW.date, '+0 days') = NEW.date) AND typeof(NEW.total_amount) IN ('real','integer') AND NEW.total_amount >= 0 AND NEW.total_amount < 1e308 AND (NEW.available_balance IS NULL OR (typeof(NEW.available_balance) IN ('real','integer') AND NEW.available_balance >= 0 AND NEW.available_balance < 1e308)) AND (NEW.profit_loss IS NULL OR (typeof(NEW.profit_loss) IN ('real','integer') AND abs(NEW.profit_loss) < 1e308))), 0)
BEGIN SELECT RAISE(ABORT, 'gk_snapshots_invalid_record'); END;

CREATE TRIGGER gk_cash_flows_guard_insert BEFORE INSERT ON gk_cash_flows
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND (length(NEW.date) = 10 AND NEW.date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(NEW.date, '+0 days') = NEW.date) AND NEW.type IN ('DEPOSIT','WITHDRAWAL') AND typeof(NEW.amount) IN ('real','integer') AND NEW.amount > 0 AND NEW.amount < 1e308), 0)
BEGIN SELECT RAISE(ABORT, 'gk_cash_flows_invalid_record'); END;

CREATE TRIGGER gk_cash_flows_guard_update BEFORE UPDATE ON gk_cash_flows
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND (length(NEW.date) = 10 AND NEW.date GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]' AND date(NEW.date, '+0 days') = NEW.date) AND NEW.type IN ('DEPOSIT','WITHDRAWAL') AND typeof(NEW.amount) IN ('real','integer') AND NEW.amount > 0 AND NEW.amount < 1e308), 0)
BEGIN SELECT RAISE(ABORT, 'gk_cash_flows_invalid_record'); END;

CREATE TRIGGER gk_positions_guard_insert BEFORE INSERT ON gk_positions
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND NEW.is_public IN (0,1) AND typeof(NEW.public_order) = 'integer' AND NEW.public_order >= 0 AND (NEW.target_weight_percent IS NULL OR NEW.target_weight_percent BETWEEN 0 AND 100) AND (NEW.weight_percent IS NULL OR NEW.weight_percent BETWEEN 0 AND 100) AND (NEW.quantity IS NULL OR (typeof(NEW.quantity) IN ('real','integer') AND abs(NEW.quantity) < 1e308)) AND (NEW.avg_cost IS NULL OR (typeof(NEW.avg_cost) IN ('real','integer') AND abs(NEW.avg_cost) < 1e308)) AND (NEW.current_value IS NULL OR (typeof(NEW.current_value) IN ('real','integer') AND abs(NEW.current_value) < 1e308)) AND (NEW.profit_loss IS NULL OR (typeof(NEW.profit_loss) IN ('real','integer') AND abs(NEW.profit_loss) < 1e308)) AND (NEW.profit_loss_percent IS NULL OR (typeof(NEW.profit_loss_percent) IN ('real','integer') AND abs(NEW.profit_loss_percent) < 1e308))), 0)
BEGIN SELECT RAISE(ABORT, 'gk_positions_invalid_record'); END;

CREATE TRIGGER gk_positions_guard_update BEFORE UPDATE ON gk_positions
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND NEW.is_public IN (0,1) AND typeof(NEW.public_order) = 'integer' AND NEW.public_order >= 0 AND (NEW.target_weight_percent IS NULL OR NEW.target_weight_percent BETWEEN 0 AND 100) AND (NEW.weight_percent IS NULL OR NEW.weight_percent BETWEEN 0 AND 100) AND (NEW.quantity IS NULL OR (typeof(NEW.quantity) IN ('real','integer') AND abs(NEW.quantity) < 1e308)) AND (NEW.avg_cost IS NULL OR (typeof(NEW.avg_cost) IN ('real','integer') AND abs(NEW.avg_cost) < 1e308)) AND (NEW.current_value IS NULL OR (typeof(NEW.current_value) IN ('real','integer') AND abs(NEW.current_value) < 1e308)) AND (NEW.profit_loss IS NULL OR (typeof(NEW.profit_loss) IN ('real','integer') AND abs(NEW.profit_loss) < 1e308)) AND (NEW.profit_loss_percent IS NULL OR (typeof(NEW.profit_loss_percent) IN ('real','integer') AND abs(NEW.profit_loss_percent) < 1e308))), 0)
BEGIN SELECT RAISE(ABORT, 'gk_positions_invalid_record'); END;

CREATE TRIGGER gk_judgment_diary_entries_guard_insert BEFORE INSERT ON gk_judgment_diary_entries
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND NEW.action IN ('BUY','SELL','HOLD','REBALANCE','WATCH') AND NEW.disclaimer_visible IN (0,1) AND (NEW.confidence IS NULL OR (typeof(NEW.confidence) = 'integer' AND NEW.confidence BETWEEN 1 AND 5)) AND (json_valid(NEW.assets_json) AND json_type(NEW.assets_json) = 'array') AND (json_valid(NEW.position_change_json) AND json_type(NEW.position_change_json) = 'array') AND (json_valid(NEW.invalidate_conditions_json) AND json_type(NEW.invalidate_conditions_json) = 'array') AND (NEW.refs_json IS NULL OR (json_valid(NEW.refs_json) AND json_type(NEW.refs_json) = 'array')) AND (NEW.strategy_tags_json IS NULL OR (json_valid(NEW.strategy_tags_json) AND json_type(NEW.strategy_tags_json) = 'array'))), 0)
BEGIN SELECT RAISE(ABORT, 'gk_judgment_diary_entries_invalid_record'); END;

CREATE TRIGGER gk_judgment_diary_entries_guard_update BEFORE UPDATE ON gk_judgment_diary_entries
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND NEW.action IN ('BUY','SELL','HOLD','REBALANCE','WATCH') AND NEW.disclaimer_visible IN (0,1) AND (NEW.confidence IS NULL OR (typeof(NEW.confidence) = 'integer' AND NEW.confidence BETWEEN 1 AND 5)) AND (json_valid(NEW.assets_json) AND json_type(NEW.assets_json) = 'array') AND (json_valid(NEW.position_change_json) AND json_type(NEW.position_change_json) = 'array') AND (json_valid(NEW.invalidate_conditions_json) AND json_type(NEW.invalidate_conditions_json) = 'array') AND (NEW.refs_json IS NULL OR (json_valid(NEW.refs_json) AND json_type(NEW.refs_json) = 'array')) AND (NEW.strategy_tags_json IS NULL OR (json_valid(NEW.strategy_tags_json) AND json_type(NEW.strategy_tags_json) = 'array'))), 0)
BEGIN SELECT RAISE(ABORT, 'gk_judgment_diary_entries_invalid_record'); END;

CREATE TRIGGER gk_alert_rule_state_guard_insert BEFORE INSERT ON gk_alert_rule_state
WHEN NOT coalesce((NEW.symbol IS NOT NULL AND NEW.rule_id IS NOT NULL AND NEW.condition_met IN (0,1)), 0)
BEGIN SELECT RAISE(ABORT, 'gk_alert_rule_state_invalid_record'); END;

CREATE TRIGGER gk_alert_rule_state_guard_update BEFORE UPDATE ON gk_alert_rule_state
WHEN NOT coalesce((NEW.symbol IS NOT NULL AND NEW.rule_id IS NOT NULL AND NEW.condition_met IN (0,1)), 0)
BEGIN SELECT RAISE(ABORT, 'gk_alert_rule_state_invalid_record'); END;

CREATE TRIGGER gk_alert_thresholds_guard_insert BEFORE INSERT ON gk_alert_thresholds
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND NEW.enabled IN (0,1) AND NEW.direction IN ('above','below') AND typeof(NEW.threshold) IN ('real','integer') AND abs(NEW.threshold) < 1e308), 0)
BEGIN SELECT RAISE(ABORT, 'gk_alert_thresholds_invalid_record'); END;

CREATE TRIGGER gk_alert_thresholds_guard_update BEFORE UPDATE ON gk_alert_thresholds
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND NEW.enabled IN (0,1) AND NEW.direction IN ('above','below') AND typeof(NEW.threshold) IN ('real','integer') AND abs(NEW.threshold) < 1e308), 0)
BEGIN SELECT RAISE(ABORT, 'gk_alert_thresholds_invalid_record'); END;

CREATE TRIGGER gk_quote_cache_guard_insert BEFORE INSERT ON gk_quote_cache
WHEN NOT coalesce((NEW.cache_key IS NOT NULL AND length(NEW.cache_key) > 0 AND NEW.is_not_found IN (0,1) AND (NEW.quote_json IS NULL OR json_valid(NEW.quote_json))), 0)
BEGIN SELECT RAISE(ABORT, 'gk_quote_cache_invalid_record'); END;

CREATE TRIGGER gk_quote_cache_guard_update BEFORE UPDATE ON gk_quote_cache
WHEN NOT coalesce((NEW.cache_key IS NOT NULL AND length(NEW.cache_key) > 0 AND NEW.is_not_found IN (0,1) AND (NEW.quote_json IS NULL OR json_valid(NEW.quote_json))), 0)
BEGIN SELECT RAISE(ABORT, 'gk_quote_cache_invalid_record'); END;

CREATE TRIGGER gk_alert_sent_guard_insert BEFORE INSERT ON gk_alert_sent
WHEN NOT coalesce((NEW.alert_key IS NOT NULL AND length(NEW.alert_key) > 0), 0)
BEGIN SELECT RAISE(ABORT, 'gk_alert_sent_invalid_record'); END;

CREATE TRIGGER gk_alert_sent_guard_update BEFORE UPDATE ON gk_alert_sent
WHEN NOT coalesce((NEW.alert_key IS NOT NULL AND length(NEW.alert_key) > 0), 0)
BEGIN SELECT RAISE(ABORT, 'gk_alert_sent_invalid_record'); END;

CREATE TRIGGER gk_settings_guard_insert BEFORE INSERT ON gk_settings
WHEN NOT coalesce((NEW.key IS NOT NULL AND length(NEW.key) > 0 AND length(trim(NEW.value)) > 0), 0)
BEGIN SELECT RAISE(ABORT, 'gk_settings_invalid_record'); END;

CREATE TRIGGER gk_settings_guard_update BEFORE UPDATE ON gk_settings
WHEN NOT coalesce((NEW.key IS NOT NULL AND length(NEW.key) > 0 AND length(trim(NEW.value)) > 0), 0)
BEGIN SELECT RAISE(ABORT, 'gk_settings_invalid_record'); END;

CREATE TRIGGER gk_sessions_guard_insert BEFORE INSERT ON gk_sessions
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND typeof(NEW.expires_at) = 'integer' AND NEW.expires_at > 0),0)
BEGIN SELECT RAISE(ABORT, 'gk_sessions_invalid_record'); END;

CREATE TRIGGER gk_sessions_guard_update BEFORE UPDATE ON gk_sessions
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND typeof(NEW.expires_at) = 'integer' AND NEW.expires_at > 0),0)
BEGIN SELECT RAISE(ABORT, 'gk_sessions_invalid_record'); END;

CREATE TRIGGER gk_security_rate_limits_guard_insert BEFORE INSERT ON gk_security_rate_limits
WHEN NOT coalesce((NEW.key IS NOT NULL AND length(NEW.key) > 0 AND typeof(NEW.attempts) = 'integer' AND NEW.attempts > 0 AND typeof(NEW.window_start) = 'integer' AND typeof(NEW.expires_at) = 'integer'),0)
BEGIN SELECT RAISE(ABORT, 'gk_security_rate_limits_invalid_record'); END;

CREATE TRIGGER gk_security_rate_limits_guard_update BEFORE UPDATE ON gk_security_rate_limits
WHEN NOT coalesce((NEW.key IS NOT NULL AND length(NEW.key) > 0 AND typeof(NEW.attempts) = 'integer' AND NEW.attempts > 0 AND typeof(NEW.window_start) = 'integer' AND typeof(NEW.expires_at) = 'integer'),0)
BEGIN SELECT RAISE(ABORT, 'gk_security_rate_limits_invalid_record'); END;

CREATE TRIGGER gk_security_audit_log_guard_insert BEFORE INSERT ON gk_security_audit_log
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND NEW.status BETWEEN 100 AND 599 AND typeof(NEW.created_at) = 'integer'),0)
BEGIN SELECT RAISE(ABORT, 'gk_security_audit_log_invalid_record'); END;

CREATE TRIGGER gk_security_audit_log_guard_update BEFORE UPDATE ON gk_security_audit_log
WHEN NOT coalesce((NEW.id IS NOT NULL AND length(NEW.id) > 0 AND NEW.status BETWEEN 100 AND 599 AND typeof(NEW.created_at) = 'integer'),0)
BEGIN SELECT RAISE(ABORT, 'gk_security_audit_log_invalid_record'); END;
