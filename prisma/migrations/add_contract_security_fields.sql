-- Add security and template fields to contracts table
ALTER TABLE contracts 
ADD COLUMN creci VARCHAR(50) NULL COMMENT 'CRECI number (e.g., 123456/SP-F or 123456/SP-J)',
ADD COLUMN contract_token VARCHAR(100) NULL UNIQUE COMMENT 'MR3X-CTR-2025-XXXXX format',
ADD COLUMN contract_hash VARCHAR(255) NULL COMMENT 'SHA-256 hash for verification',
ADD COLUMN template_id VARCHAR(100) NULL COMMENT 'Template identifier',
ADD COLUMN template_type VARCHAR(10) NULL COMMENT 'CTR, ACD, VST';

-- Add index for faster lookups
CREATE INDEX idx_contract_token ON contracts(contract_token);
CREATE INDEX idx_contract_hash ON contracts(contract_hash);
CREATE INDEX idx_template_id ON contracts(template_id);


