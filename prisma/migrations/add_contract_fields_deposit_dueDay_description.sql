-- Migration: Add deposit, dueDay, and description fields to Contract model
-- Date: 2025-01-XX

USE mr3x_db_v2;

-- Add deposit field (nullable Decimal)
ALTER TABLE contracts 
ADD COLUMN deposit DECIMAL(12, 2) NULL AFTER monthly_rent;

-- Add dueDay field (nullable Int)
ALTER TABLE contracts 
ADD COLUMN due_day INT NULL AFTER deposit;

-- Add description field (nullable Text)
ALTER TABLE contracts 
ADD COLUMN description TEXT NULL AFTER due_day;

-- Verify the changes
DESCRIBE contracts;

