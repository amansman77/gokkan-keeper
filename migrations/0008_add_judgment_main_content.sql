ALTER TABLE gk_judgment_diary_entries ADD COLUMN main_content TEXT;

UPDATE gk_judgment_diary_entries
SET main_content = summary
WHERE main_content IS NULL OR trim(main_content) = '';
