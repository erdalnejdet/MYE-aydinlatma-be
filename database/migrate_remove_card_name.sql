-- Migration: Remove card_name column from payment_info table
-- Date: 2026-02-06
-- Security: Remove card_name for complete PCI-DSS compliance

-- Drop card_name column from payment_info table
ALTER TABLE payment_info 
  DROP COLUMN IF EXISTS card_name;
