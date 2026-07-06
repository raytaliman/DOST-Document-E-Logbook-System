-- ============================================================
-- Migration: processedby (text) -> processedbyid (FK to tbladmin)
-- Run this once against the live database.
-- ============================================================

-- Step 1: Add the new FK column
ALTER TABLE tbldocuments
  ADD COLUMN processedbyid INTEGER REFERENCES tbladmin(adminid);

-- Step 2: Backfill where name matches exactly (case-insensitive)
UPDATE tbldocuments d
SET processedbyid = a.adminid
FROM tbladmin a
WHERE TRIM(LOWER(d.processedby)) = TRIM(LOWER(a.adminname));

-- Step 3: Any remaining unmatched records -> adminid = 1 (Sheriel Mae Gapasin)
UPDATE tbldocuments
SET processedbyid = 1
WHERE processedby IS NOT NULL
  AND processedby <> ''
  AND processedbyid IS NULL;

-- Step 4: Rename old column to legacy (safe fallback - do NOT drop yet)
ALTER TABLE tbldocuments RENAME COLUMN processedby TO processedby_legacy;
