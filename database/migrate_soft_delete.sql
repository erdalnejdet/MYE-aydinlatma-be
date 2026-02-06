-- Migration script to add is_deleted columns for soft delete functionality
-- Run this script if you have an existing database

-- Add is_deleted to brands table
ALTER TABLE brands ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Update existing brands to have is_deleted = FALSE
UPDATE brands SET is_deleted = FALSE WHERE is_deleted IS NULL;

-- Add is_deleted to products table
ALTER TABLE products ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE;

-- Update existing products to have is_deleted = FALSE
UPDATE products SET is_deleted = FALSE WHERE is_deleted IS NULL;

-- Verify migration
SELECT 
    'brands' as table_name,
    COUNT(*) FILTER (WHERE is_deleted = FALSE) as active_count,
    COUNT(*) FILTER (WHERE is_deleted = TRUE) as deleted_count
FROM brands
UNION ALL
SELECT 
    'products' as table_name,
    COUNT(*) FILTER (WHERE is_deleted = FALSE) as active_count,
    COUNT(*) FILTER (WHERE is_deleted = TRUE) as deleted_count
FROM products;
