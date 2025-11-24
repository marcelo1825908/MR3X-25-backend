-- Migration: Change pdf (BLOB) to pdfPath (VARCHAR)
-- Date: 2025-10-23
-- WARNING: This will drop the existing pdf column and lose any stored PDF data

USE mr3x_db_v2;

-- Step 1: Add the new pdfPath column
ALTER TABLE contracts 
ADD COLUMN pdf_path VARCHAR(255) NULL AFTER tenant;

-- Step 2: Drop the old pdf column (WARNING: Data loss!)
ALTER TABLE contracts 
DROP COLUMN pdf;

-- Verify the change
DESCRIBE contracts;

