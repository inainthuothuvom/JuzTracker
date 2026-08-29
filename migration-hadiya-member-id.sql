-- Migration: Sync hadiya_details with members table via nominated_member_id
-- Run this in Supabase SQL Editor in order

-- Step 1: Add new column (idempotent)
ALTER TABLE hadiya_details ADD COLUMN IF NOT EXISTS nominated_member_id TEXT;

-- Step 2: Backfill - exact match first
UPDATE hadiya_details hd
SET nominated_member_id = sub.custom_id::text
FROM (
    SELECT DISTINCT ON (hd2.start_date) hd2.start_date, m.custom_id
    FROM hadiya_details hd2
    JOIN members m ON m.name_en = hd2.nominated_to
    ORDER BY hd2.start_date, m.effective_date DESC NULLS LAST
) sub
WHERE hd.start_date = sub.start_date
  AND (hd.nominated_member_id IS NULL OR btrim(hd.nominated_member_id) = '');

-- Step 2b: Backfill remaining empties with case-insensitive + trimmed match
UPDATE hadiya_details hd
SET nominated_member_id = sub.custom_id::text
FROM (
    SELECT DISTINCT ON (hd2.start_date) hd2.start_date, m.custom_id
    FROM hadiya_details hd2
    JOIN members m ON btrim(lower(m.name_en)) = btrim(lower(hd2.nominated_to))
    ORDER BY hd2.start_date, m.effective_date DESC NULLS LAST
) sub
WHERE hd.start_date = sub.start_date
  AND (hd.nominated_member_id IS NULL OR btrim(hd.nominated_member_id) = '');

-- Step 2c: Diagnose still-empty rows (run this alone to see why)
-- SELECT start_date, nominated_to, nominated_to_ta, nominated_member_id
-- FROM hadiya_details WHERE nominated_member_id IS NULL OR btrim(nominated_member_id) = ''
-- ORDER BY start_date;

-- Step 2d: Show closest member candidates for still-empty rows (fuzzy help)
-- SELECT hd.start_date, hd.nominated_to, m.custom_id, m.name_en, m.name_ta
-- FROM hadiya_details hd
-- CROSS JOIN members m
-- WHERE (hd.nominated_member_id IS NULL OR btrim(hd.nominated_member_id) = '')
--   AND m.name_en ILIKE '%' || btrim(hd.nominated_to) || '%'
-- ORDER BY hd.start_date, m.custom_id;

-- Step 3: Manual fix template for any rows that still have no match
-- (member may have been deleted/renamed - set custom_id manually)
-- UPDATE hadiya_details SET nominated_member_id = 'REPLACE_WITH_CUSTOM_ID' WHERE start_date = 'YYYY-MM-DD';
-- Example:
-- UPDATE hadiya_details SET nominated_member_id = '5' WHERE start_date = '2026-08-21';

-- Step 4: Verify no empties remain (should return 0 rows)
-- SELECT count(*) FROM hadiya_details WHERE nominated_member_id IS NULL OR btrim(nominated_member_id) = '';

-- Step 5: Enforce NOT NULL once verified (optional)
-- ALTER TABLE hadiya_details ALTER COLUMN nominated_member_id SET NOT NULL;

-- Step 6: Drop old text columns ONLY after verifying app works with new column
-- ALTER TABLE hadiya_details DROP COLUMN nominated_to;
-- ALTER TABLE hadiya_details DROP COLUMN nominated_to_ta;

-- Rollback if needed:
-- ALTER TABLE hadiya_details DROP COLUMN nominated_member_id;
