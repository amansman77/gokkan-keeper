-- Existing monetary values remain untouched. Exact ledger values are additive.
ALTER TABLE gk_cash_flows ADD COLUMN money_currency TEXT CHECK(money_currency IN ('KRW','USD','EUR','JPY','CNY'));
ALTER TABLE gk_cash_flows ADD COLUMN amount_minor INTEGER CHECK(amount_minor IS NULL OR (typeof(amount_minor) = 'integer' AND amount_minor > 0 AND amount_minor <= 9007199254740991));
ALTER TABLE gk_positions ADD COLUMN price_currency TEXT CHECK(price_currency IN ('KRW','USD','EUR','JPY','CNY'));
ALTER TABLE gk_positions ADD COLUMN source TEXT;
ALTER TABLE gk_positions ADD COLUMN source_record_id TEXT;
-- NULL source identities preserve independent lots and manually entered holdings.
CREATE UNIQUE INDEX idx_gk_positions_source ON gk_positions(source, source_record_id) WHERE source IS NOT NULL AND source_record_id IS NOT NULL;
CREATE TRIGGER gk_positions_source_insert BEFORE INSERT ON gk_positions
WHEN (NEW.source IS NULL) != (NEW.source_record_id IS NULL) OR NEW.source = '' OR NEW.source_record_id = ''
BEGIN SELECT RAISE(ABORT, 'position_source_pair_required'); END;
CREATE TRIGGER gk_positions_source_update BEFORE UPDATE ON gk_positions
WHEN NEW.source IS NOT OLD.source OR NEW.source_record_id IS NOT OLD.source_record_id
BEGIN SELECT RAISE(ABORT, 'position_source_immutable'); END;
CREATE TRIGGER gk_cash_flows_money_insert BEFORE INSERT ON gk_cash_flows
WHEN (NEW.amount_minor IS NULL) != (NEW.money_currency IS NULL) OR
 (NEW.amount_minor IS NOT NULL AND (NEW.money_currency IS NOT (SELECT currency FROM gk_granaries WHERE id = NEW.granary_id) OR
  abs(NEW.amount * CASE WHEN NEW.money_currency IN ('KRW','JPY') THEN 1 ELSE 100 END - NEW.amount_minor) > 0.000001))
BEGIN SELECT RAISE(ABORT, 'cash_flow_money_mismatch'); END;
CREATE TRIGGER gk_cash_flows_money_update BEFORE UPDATE ON gk_cash_flows
WHEN (NEW.amount_minor IS NULL) != (NEW.money_currency IS NULL) OR
 (OLD.amount_minor IS NOT NULL AND NEW.amount_minor IS NULL) OR
 (NEW.amount_minor IS NOT NULL AND (NEW.money_currency IS NOT (SELECT currency FROM gk_granaries WHERE id = NEW.granary_id) OR
  abs(NEW.amount * CASE WHEN NEW.money_currency IN ('KRW','JPY') THEN 1 ELSE 100 END - NEW.amount_minor) > 0.000001))
BEGIN SELECT RAISE(ABORT, 'cash_flow_money_mismatch'); END;
