-- Screenshot import (docs/SCREENSHOT_IMPORT.md). Images are transient: the API
-- deletes them as soon as the OCR result arrives, and expired jobs are purged.
CREATE TABLE gk_import_jobs (
 id TEXT NOT NULL PRIMARY KEY,
 granary_id TEXT NOT NULL REFERENCES gk_granaries(id) ON DELETE CASCADE,
 status TEXT NOT NULL CHECK(status IN ('draft','queued','processing','parsed','failed','applied','discarded')),
 result_json TEXT CHECK(result_json IS NULL OR json_valid(result_json)),
 error TEXT,
 lease_until INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX idx_gk_import_jobs_queue ON gk_import_jobs(status, created_at);
CREATE INDEX idx_gk_import_jobs_expiry ON gk_import_jobs(expires_at);

CREATE TABLE gk_import_images (
 job_id TEXT NOT NULL REFERENCES gk_import_jobs(id) ON DELETE CASCADE,
 seq INTEGER NOT NULL CHECK(seq BETWEEN 1 AND 12),
 mime TEXT NOT NULL CHECK(mime IN ('image/png','image/jpeg','image/webp')),
 bytes BLOB NOT NULL CHECK(length(bytes) BETWEEN 1 AND 1572864),
 PRIMARY KEY (job_id, seq)
);

-- The broker account a granary imports from, learned on the first applied
-- import, so a screenshot of another account is refused.
CREATE TABLE gk_import_accounts (
 granary_id TEXT NOT NULL PRIMARY KEY REFERENCES gk_granaries(id) ON DELETE CASCADE,
 broker TEXT NOT NULL,
 account_suffix TEXT NOT NULL CHECK(length(account_suffix) = 4 AND account_suffix GLOB '[0-9][0-9][0-9][0-9]'),
 created_at TEXT NOT NULL
);
