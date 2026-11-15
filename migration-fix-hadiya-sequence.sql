-- ============================================================================
-- Fix the Hadiya sequence: each week's Hadiya goes to that week's Juz 30 reader
-- ============================================================================
--
-- Rule:
--   hadiya_details.nominated_member_id for start_date = W
--   should be the member whose weekly_status.juz_number = 30 in week_start = W.
--
-- This script does two things:
--   1. Updates Hadiya rows from THIS WEEK's Friday onward (Completed rows are
--      left untouched).
--   2. Deletes every Hadiya dated AFTER this week's Friday ("future dated").
--      Future entries will then be added one at a time from the website:
--      Hadiya Menu -> "Add Next Hadiya".
--
-- The cutoff is calculated as the Friday of the current week, using the same
-- logic as the app's normalizeToFriday(). When run around 2026-11-15 this is
-- 2026-11-13. If you need a different cutoff, replace the expression in all
-- three `params` CTEs with a fixed date, e.g. DATE '2026-11-13'.
--
-- Safe to re-run: the UPDATE only corrects rows, and the DELETE only removes
-- future-dated rows.
-- ============================================================================


-- ---------------------------------------------------------------------------
-- 1. Preview - what will change (read-only)
-- ---------------------------------------------------------------------------
WITH params AS (
    SELECT (date_trunc('week', current_date)::date + 4) AS this_friday
)
SELECT h.start_date::date     AS week,
       h.status,
       h.nominated_member_id AS current_nominee,
       w.member_id           AS juz30_reader,
       m.name_en             AS expected_name
FROM public.hadiya_details h
CROSS JOIN params p
LEFT JOIN public.weekly_status w
       ON w.week_start = h.start_date::date
      AND w.juz_number = 30
LEFT JOIN LATERAL (
    SELECT mm.name_en
    FROM public.members mm
    WHERE mm.custom_id = w.member_id
      AND (mm.effective_date IS NULL OR mm.effective_date::date <= w.week_start)
    ORDER BY mm.effective_date DESC NULLS LAST
    LIMIT 1
) m ON TRUE
WHERE h.start_date::date >= p.this_friday
ORDER BY h.start_date;


-- ---------------------------------------------------------------------------
-- 2. Update nominees from this week onward
--    (leaves rows already marked Completed alone)
-- ---------------------------------------------------------------------------
WITH params AS (
    SELECT (date_trunc('week', current_date)::date + 4) AS this_friday
), expected AS (
    SELECT w.week_start,
           w.member_id,
           m.name_en,
           m.name_ta
    FROM public.weekly_status w
    JOIN LATERAL (
        SELECT mm.name_en, mm.name_ta
        FROM public.members mm
        WHERE mm.custom_id = w.member_id
          AND (mm.effective_date IS NULL OR mm.effective_date::date <= w.week_start)
        ORDER BY mm.effective_date DESC NULLS LAST
        LIMIT 1
    ) m ON TRUE
    WHERE w.juz_number = 30
)
UPDATE public.hadiya_details h
SET nominated_member_id = e.member_id,
    nominated_to        = e.name_en,
    nominated_to_ta     = e.name_ta,
    updated_at          = now()
FROM params p, expected e
WHERE h.start_date::date = e.week_start
  AND h.start_date::date >= p.this_friday
  AND h.status IS DISTINCT FROM 'Completed';


-- ---------------------------------------------------------------------------
-- 3. Delete all future-dated Hadiya rows (after this week's Friday)
--    Comment this section out if you would rather KEEP the corrected future
--    rows instead of adding them manually from the website.
-- ---------------------------------------------------------------------------
WITH params AS (
    SELECT (date_trunc('week', current_date)::date + 4) AS this_friday
)
DELETE FROM public.hadiya_details h
USING params p
WHERE h.start_date::date > p.this_friday;


-- ---------------------------------------------------------------------------
-- 4. Verify - the remaining upcoming rows
-- ---------------------------------------------------------------------------
SELECT start_date::date AS week,
       nominated_member_id,
       nominated_to,
       status
FROM public.hadiya_details
ORDER BY start_date DESC
LIMIT 5;
