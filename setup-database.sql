-- MR3X Database Setup Script
-- Run this script to create the database

-- Create database if it doesn't exist
CREATE DATABASE IF NOT EXISTS mr3x_db_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Show databases to confirm
SHOW DATABASES LIKE 'mr3x_db_v2';

-- Select the database
USE mr3x_db_v2;

-- Display success message
SELECT 'Database mr3x_db_v2 created successfully!' AS Status;

