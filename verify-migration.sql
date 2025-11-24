-- Verification Script for Contract PDF Migration
-- Run this to verify the migration was successful

USE mr3x_db_v2;

-- Check if pdf_path column exists and pdf column is gone
SELECT 
    COLUMN_NAME,
    DATA_TYPE,
    CHARACTER_MAXIMUM_LENGTH,
    IS_NULLABLE
FROM 
    INFORMATION_SCHEMA.COLUMNS
WHERE 
    TABLE_SCHEMA = 'mr3x_db_v2' 
    AND TABLE_NAME = 'contracts'
    AND COLUMN_NAME IN ('pdf', 'pdf_path')
ORDER BY 
    ORDINAL_POSITION;

-- Expected result:
-- pdf_path | varchar | 255 | YES
-- (pdf should NOT appear - it should be deleted)

-- Show all contracts table columns
DESCRIBE contracts;

