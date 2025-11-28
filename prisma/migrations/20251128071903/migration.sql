-- AlterTable
ALTER TABLE `email_verifications` ALTER COLUMN `expires_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `igpm_index` ALTER COLUMN `created_at` DROP DEFAULT;

-- AlterTable
ALTER TABLE `notifications` ALTER COLUMN `creation_date` DROP DEFAULT;

-- AlterTable
ALTER TABLE `payments` ALTER COLUMN `data_pagamento` DROP DEFAULT;

-- AlterTable
ALTER TABLE `refresh_tokens` ALTER COLUMN `expires_at` DROP DEFAULT;
