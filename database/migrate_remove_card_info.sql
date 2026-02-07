-- Migration: Remove sensitive card information from payment_info table
-- Date: 2026-02-06
-- Security: Remove card_number, cvv, expiry_date columns for PCI-DSS compliance

-- Drop columns from payment_info table
ALTER TABLE payment_info 
  DROP COLUMN IF EXISTS card_number,
  DROP COLUMN IF EXISTS cvv,
  DROP COLUMN IF EXISTS expiry_date;

-- Keep only payment_status and order_id for tracking payment status
-- card_name can be kept for display purposes (optional)
