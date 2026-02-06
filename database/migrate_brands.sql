-- Migration script to create brands table and insert default brands
-- Run this script if brands table doesn't exist in your database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default brands
INSERT INTO brands (name) VALUES 
    ('SCHNEIDER ELECTRIC'),
    ('ABB'),
    ('SIEMENS'),
    ('LEGRAND'),
    ('EATON')
ON CONFLICT (name) DO NOTHING;

-- Verify brands were inserted
SELECT * FROM brands ORDER BY name;
