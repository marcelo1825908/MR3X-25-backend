-- =====================================================
-- MR3X Pricing Model & Microtransactions Migration
-- Generated: 2025-12-09
-- =====================================================
-- This migration adds:
-- 1. Agency plan limits and usage tracking
-- 2. Subscription billing fields
-- 3. Microtransaction table for pay-per-use features
-- =====================================================

-- =====================================================
-- STEP 1: Update Agency table with pricing model fields
-- =====================================================

-- Add plan limit fields
ALTER TABLE `agencies`
  MODIFY COLUMN `max_users` INT DEFAULT 2 COMMENT 'FREE: 2, BASIC: 5, PROFESSIONAL: 10, ENTERPRISE: unlimited';

ALTER TABLE `agencies`
  ADD COLUMN `max_contracts` INT DEFAULT 1 AFTER `max_users` COMMENT 'Active contract limit based on plan';

-- Add usage tracking fields
ALTER TABLE `agencies`
  ADD COLUMN `active_contracts_count` INT DEFAULT 0 NOT NULL AFTER `frozen_users_count`,
  ADD COLUMN `active_properties_count` INT DEFAULT 0 NOT NULL AFTER `active_contracts_count`,
  ADD COLUMN `active_users_count` INT DEFAULT 0 NOT NULL AFTER `active_properties_count`;

-- Add subscription billing fields
ALTER TABLE `agencies`
  ADD COLUMN `subscription_id` VARCHAR(100) AFTER `active_users_count` COMMENT 'Asaas subscription ID',
  ADD COLUMN `subscription_status` VARCHAR(30) DEFAULT 'ACTIVE' AFTER `subscription_id` COMMENT 'ACTIVE, SUSPENDED, CANCELED',
  ADD COLUMN `current_period_start` DATE AFTER `subscription_status`,
  ADD COLUMN `current_period_end` DATE AFTER `current_period_start`,
  ADD COLUMN `next_billing_date` DATE AFTER `current_period_end`,
  ADD COLUMN `trial_ends_at` TIMESTAMP AFTER `next_billing_date`,
  ADD COLUMN `canceled_at` TIMESTAMP AFTER `trial_ends_at`;

-- Add payment tracking fields
ALTER TABLE `agencies`
  ADD COLUMN `last_payment_at` TIMESTAMP AFTER `canceled_at`,
  ADD COLUMN `last_payment_amount` DECIMAL(10,2) AFTER `last_payment_at`,
  ADD COLUMN `total_spent` DECIMAL(12,2) DEFAULT 0 NOT NULL AFTER `last_payment_amount` COMMENT 'Lifetime value';

-- =====================================================
-- STEP 2: Create Microtransaction enum types (virtual - stored in table as VARCHAR)
-- =====================================================
-- MySQL doesn't have native ENUMs, so we use VARCHAR with CHECK constraints or application-level validation
-- MicrotransactionType values: EXTRA_CONTRACT, INSPECTION, SETTLEMENT, SCREENING, EXTRA_USER, EXTRA_PROPERTY, API_CALL
-- MicrotransactionStatus values: PENDING, PROCESSING, PAID, FAILED, REFUNDED, CANCELED

-- =====================================================
-- STEP 3: Create Microtransactions table
-- =====================================================

CREATE TABLE `microtransactions` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `agency_id` BIGINT UNSIGNED,
  `user_id` BIGINT UNSIGNED,

  -- Transaction details
  `type` VARCHAR(30) NOT NULL COMMENT 'EXTRA_CONTRACT, INSPECTION, SETTLEMENT, SCREENING, EXTRA_USER, EXTRA_PROPERTY, API_CALL',
  `amount` DECIMAL(10,2) NOT NULL,
  `description` VARCHAR(255),
  `status` VARCHAR(30) NOT NULL DEFAULT 'PENDING' COMMENT 'PENDING, PROCESSING, PAID, FAILED, REFUNDED, CANCELED',

  -- Related entity references
  `contract_id` BIGINT UNSIGNED,
  `inspection_id` BIGINT UNSIGNED,
  `agreement_id` BIGINT UNSIGNED,
  `analysis_id` BIGINT UNSIGNED,

  -- Payment integration
  `asaas_payment_id` VARCHAR(100),
  `asaas_invoice_url` VARCHAR(500),
  `payment_method` VARCHAR(50) COMMENT 'PIX, BOLETO, CREDIT_CARD',
  `pix_qr_code` TEXT,
  `boleto_url` VARCHAR(500),

  -- Payment tracking
  `paid_at` TIMESTAMP NULL,
  `refunded_at` TIMESTAMP NULL,
  `refund_amount` DECIMAL(10,2),
  `refund_reason` VARCHAR(255),

  -- Metadata
  `notes` TEXT,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  PRIMARY KEY (`id`),

  -- Indexes
  INDEX `idx_agency_id` (`agency_id`),
  INDEX `idx_user_id` (`user_id`),
  INDEX `idx_type` (`type`),
  INDEX `idx_status` (`status`),
  INDEX `idx_created_at` (`created_at`),

  -- Foreign keys
  CONSTRAINT `fk_microtransaction_agency` FOREIGN KEY (`agency_id`) REFERENCES `agencies`(`id`) ON DELETE SET NULL,
  CONSTRAINT `fk_microtransaction_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- =====================================================
-- STEP 4: Update existing agencies to have correct default values
-- =====================================================

-- Update existing FREE plan agencies with correct limits
UPDATE `agencies`
SET
  `max_contracts` = 1,
  `max_users` = 2,
  `max_properties` = 1,
  `active_contracts_count` = 0,
  `active_properties_count` = 0,
  `active_users_count` = 0,
  `subscription_status` = 'ACTIVE',
  `total_spent` = 0
WHERE `plan` = 'FREE';

-- Update existing BASIC plan agencies (if any exist)
UPDATE `agencies`
SET
  `max_contracts` = 20,
  `max_users` = 5,
  `max_properties` = 20,
  `subscription_status` = 'ACTIVE'
WHERE `plan` = 'BASIC';

-- Update existing PROFESSIONAL plan agencies (if any exist)
UPDATE `agencies`
SET
  `max_contracts` = 60,
  `max_users` = 10,
  `max_properties` = 60,
  `subscription_status` = 'ACTIVE'
WHERE `plan` = 'PROFESSIONAL';

-- Update existing ENTERPRISE plan agencies (if any exist)
UPDATE `agencies`
SET
  `max_contracts` = 200,
  `max_users` = 999999, -- Unlimited (represented as very large number)
  `max_properties` = 200,
  `subscription_status` = 'ACTIVE'
WHERE `plan` = 'ENTERPRISE';

-- =====================================================
-- STEP 5: Verify migration
-- =====================================================

-- Check that all agencies have proper plan limits
SELECT
  `id`,
  `name`,
  `plan`,
  `max_contracts`,
  `max_users`,
  `max_properties`,
  `subscription_status`
FROM `agencies`
LIMIT 10;

-- Check microtransactions table structure
DESCRIBE `microtransactions`;

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Next steps:
-- 1. Run: npx prisma generate
-- 2. Implement PlanEnforcementService
-- 3. Implement MicrotransactionsService
-- 4. Integrate enforcement into services
-- =====================================================
