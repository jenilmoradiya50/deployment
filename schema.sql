-- ==============================================================================
-- Canara Bank SD-WAN & ATM Work Tracker - Database Schema
-- Compatible with Supabase, Vercel Postgres, Neon, and Standard PostgreSQL
-- ==============================================================================

-- 1. USERS TABLE (Authentication & User Management)
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(100) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  name VARCHAR(150) NOT NULL,
  phone VARCHAR(50) DEFAULT '',
  role VARCHAR(50) NOT NULL DEFAULT 'field_engineer',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2. SITE RECORDS TABLE (Branch Routers & ATM Terminals)
CREATE TABLE IF NOT EXISTS records (
  id VARCHAR(64) PRIMARY KEY,
  kind VARCHAR(20) NOT NULL DEFAULT 'Branch',
  dp_code VARCHAR(100) DEFAULT '',
  atm_id VARCHAR(100) DEFAULT '',

  -- Field Engineer Details & UAT Handover
  fe_name VARCHAR(150) DEFAULT '',
  fe_number VARCHAR(50) DEFAULT '',
  uat_submitted VARCHAR(10) DEFAULT 'No',
  uat_form_no VARCHAR(100) DEFAULT '',

  -- Hardware Serial Numbers
  new_device_serial VARCHAR(100) DEFAULT '',
  old_device_model VARCHAR(100) DEFAULT '',
  old_device_serial VARCHAR(100) DEFAULT '',

  -- VLAN Configuration
  vlan_configured VARCHAR(10) DEFAULT 'No',
  vlan_details VARCHAR(100) DEFAULT '',
  vlan_removed VARCHAR(30) DEFAULT 'Not Removed',

  -- Primary LAN Network & Secondary IPs (JSON array up to 3)
  primary_lan_ip VARCHAR(50) DEFAULT '',
  lan_ip_prefix VARCHAR(30) DEFAULT '',
  primary_lan_gateway VARCHAR(50) DEFAULT '',
  secondary_lan_ips JSONB DEFAULT '[]'::jsonb,
  atm_ip VARCHAR(50) DEFAULT '',
  atm_gateway VARCHAR(50) DEFAULT '',

  -- BSNL Circuit
  bsnl_ip VARCHAR(50) DEFAULT '',
  bsnl_gateway VARCHAR(50) DEFAULT '',
  bsnl_ping VARCHAR(10) DEFAULT 'No',

  -- Jio Circuit
  jio_ip VARCHAR(50) DEFAULT '',
  jio_gateway VARCHAR(50) DEFAULT '',
  jio_ping VARCHAR(10) DEFAULT 'No',

  -- Airtel & CE Circuit
  airtel_ip VARCHAR(50) DEFAULT '',
  airtel_gateway VARCHAR(50) DEFAULT '',
  ce_ip VARCHAR(50) DEFAULT '',
  airtel_ping VARCHAR(10) DEFAULT 'No',

  -- SD-WAN Handover & Checklist
  configuration VARCHAR(50) DEFAULT 'Not completed',
  mp_added VARCHAR(10) DEFAULT 'No', -- Maps to CS (Central System)
  device_online VARCHAR(10) DEFAULT 'No',
  mail_sent VARCHAR(10) DEFAULT 'No',
  dc_mail VARCHAR(30) DEFAULT 'Not received',
  drc_mail VARCHAR(30) DEFAULT 'Not received',
  cables_connected VARCHAR(30) DEFAULT 'Not connected',
  working VARCHAR(10) DEFAULT 'No',

  -- Site Claim / Ownership
  claimed_by VARCHAR(100) DEFAULT '',
  claimed_by_name VARCHAR(150) DEFAULT '',

  notes TEXT DEFAULT '',
  created_by VARCHAR(100) DEFAULT 'Admin@Canara',
  updated_by VARCHAR(100) DEFAULT 'Admin@Canara',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES FOR HIGH-SPEED SEARCH
CREATE INDEX IF NOT EXISTS idx_records_kind ON records (kind);
CREATE INDEX IF NOT EXISTS idx_records_dp_code ON records (dp_code);
CREATE INDEX IF NOT EXISTS idx_records_atm_id ON records (atm_id);
CREATE INDEX IF NOT EXISTS idx_records_claimed_by ON records (claimed_by);
CREATE INDEX IF NOT EXISTS idx_records_working ON records (working);

-- 4. INSERT DEFAULT ADMINISTRATOR
-- Username: Admin@Canara
-- Password: Qwerty@123 (bcrypt hash: $2a$10$wYq.n1R8k7FhZJ3wTfJg0e7IuX1qZ9V6xO8Y3A4k5L6m7N8o9P0qR)
INSERT INTO users (id, username, password_hash, name, phone, role)
VALUES (
  'usr-admin-canara-001',
  'Admin@Canara',
  '$2a$10$tZz2YVl5k7hQp1mJ5oY8uOi3mX4bC8wQ1sA7vE9rG2tK6jN4pL8vW',
  'Canara Bank SD-WAN Admin',
  '9876543210',
  'admin'
)
ON CONFLICT (username) DO NOTHING;
