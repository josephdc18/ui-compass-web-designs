-- ============================================================================
-- Database Schema - Form Submissions
-- ============================================================================
--
-- Run this against your D1 database:
--   wrangler d1 execute YOUR_DB_NAME --local --file=./database/schema.sql
--   wrangler d1 execute YOUR_DB_NAME --file=./database/schema.sql  (production)
--
-- ============================================================================

CREATE TABLE IF NOT EXISTS form_submissions (
    id TEXT PRIMARY KEY,
    form_name TEXT NOT NULL,
    data TEXT NOT NULL,
    ip_address TEXT,
    user_agent TEXT,
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now'))
);

-- Index for querying by form name and date
CREATE INDEX IF NOT EXISTS idx_form_submissions_name ON form_submissions(form_name);
CREATE INDEX IF NOT EXISTS idx_form_submissions_created ON form_submissions(created_at);


-- ============================================================================
-- Push Notification Tables
-- ============================================================================

-- Push Subscriptions - stores web push subscription data
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    user_agent TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT,
    last_used_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);

-- Notifications - stores notification history
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    title TEXT,
    body TEXT,
    url TEXT,
    icon TEXT,
    tag TEXT,
    data TEXT,
    read INTEGER DEFAULT 0,
    push_sent INTEGER DEFAULT 0,
    push_sent_at TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);


-- ============================================================================
-- SCHEDULER TABLES
-- ============================================================================

-- Scheduled Jobs - stores job configurations and schedules
CREATE TABLE IF NOT EXISTS scheduled_jobs (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    cron_expression TEXT NOT NULL,
    enabled INTEGER DEFAULT 1,
    last_run_at TEXT,
    next_run_at TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Job Runs - stores execution history for each job
CREATE TABLE IF NOT EXISTS job_runs (
    id TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    started_at TEXT DEFAULT (datetime('now')),
    completed_at TEXT,
    result_summary TEXT,
    error_message TEXT,
    FOREIGN KEY (job_id) REFERENCES scheduled_jobs(id)
);

CREATE INDEX IF NOT EXISTS idx_job_runs_job_id ON job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_job_runs_started_at ON job_runs(started_at);
CREATE INDEX IF NOT EXISTS idx_job_runs_status ON job_runs(status);

-- Job Queue - stores async/deferred jobs (emails, push notifications, webhooks)
CREATE TABLE IF NOT EXISTS job_queue (
    id TEXT PRIMARY KEY,
    job_type TEXT NOT NULL,
    payload TEXT,
    entity_type TEXT,
    entity_id TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    priority INTEGER DEFAULT 0,
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    run_at TEXT DEFAULT (datetime('now')),
    started_at TEXT,
    completed_at TEXT,
    last_error TEXT,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_job_queue_status_run_at ON job_queue(status, run_at);
CREATE INDEX IF NOT EXISTS idx_job_queue_entity ON job_queue(entity_type, entity_id);

-- =============================================================================
-- E-Commerce Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT DEFAULT '',
    price_cents INTEGER NOT NULL,
    compare_at_price_cents INTEGER,
    category TEXT DEFAULT '',
    image_url TEXT DEFAULT '',
    inventory_count INTEGER DEFAULT 0,
    active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS product_variants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price_cents INTEGER NOT NULL,
    sku TEXT DEFAULT '',
    inventory_count INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    stripe_session_id TEXT UNIQUE,
    stripe_payment_intent TEXT,
    customer_email TEXT,
    customer_name TEXT,
    status TEXT DEFAULT 'pending',
    total_cents INTEGER NOT NULL,
    currency TEXT DEFAULT 'usd',
    shipping_address TEXT DEFAULT '',
    items_json TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(active);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_stripe_session ON orders(stripe_session_id);

-- Seed sample products (match the placeholder data in _data/products.js)
INSERT OR IGNORE INTO products (id, name, slug, description, price_cents, compare_at_price_cents, category, image_url, inventory_count, active, sort_order)
VALUES (1, 'Sample Product', 'sample-product', 'This is a placeholder product. Add real products to your D1 database.', 2999, NULL, '', 'https://csimg.nyc3.cdn.digitaloceanspaces.com/Images/People/business2.jpg', 100, 1, 0);

INSERT OR IGNORE INTO products (id, name, slug, description, price_cents, compare_at_price_cents, category, image_url, inventory_count, active, sort_order)
VALUES (2, 'Another Product', 'another-product', 'Another placeholder. Replace with your actual products.', 4999, 5999, '', 'https://csimg.nyc3.cdn.digitaloceanspaces.com/Images/People/business3.jpg', 100, 1, 1);


-- =============================================================================
-- Client Portal Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT UNIQUE,
  notes TEXT,
  password_hash TEXT DEFAULT NULL,
  portal_enabled INTEGER DEFAULT 0,
  last_portal_login DATETIME DEFAULT NULL,
  avatar_base64 TEXT,
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_email ON clients(email) WHERE email IS NOT NULL;

CREATE TABLE IF NOT EXISTS portal_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL DEFAULT 'magic_link' CHECK (type IN ('magic_link', 'password_recovery')),
  ip_address TEXT,
  user_agent TEXT,
  is_used INTEGER DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_token ON portal_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_portal_sessions_client ON portal_sessions(client_id);

CREATE TABLE IF NOT EXISTS portal_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('admin', 'client')),
  recipient_id INTEGER,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  action_url TEXT,
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  read_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_portal_notifications_inbox
  ON portal_notifications(recipient_type, recipient_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER DEFAULT 1,
  window_start DATETIME DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

CREATE TABLE IF NOT EXISTS _migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pack TEXT NOT NULL,
  version INTEGER NOT NULL,
  description TEXT NOT NULL,
  applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(pack, version)
);


-- =============================================================================
-- Messaging Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id INTEGER NOT NULL UNIQUE,
  last_message_at TEXT,
  admin_last_read_at TEXT,
  admin_last_read_id TEXT,
  client_last_read_at TEXT,
  client_last_read_id TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE INDEX IF NOT EXISTS idx_conversations_client ON conversations(client_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON conversations(last_message_at DESC);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  conversation_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'client')),
  sender_id TEXT NOT NULL,
  body TEXT,
  reply_to_id TEXT,
  is_edited INTEGER DEFAULT 0,
  edited_at TEXT,
  is_deleted INTEGER DEFAULT 0,
  deleted_at TEXT,
  client_dedup_id TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'text' CHECK (message_type IN ('text', 'gif')),
  gif_url TEXT,
  gif_preview_url TEXT,
  gif_title TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(sender_type, sender_id, client_dedup_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id),
  FOREIGN KEY (reply_to_id) REFERENCES messages(id)
);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at, id);
CREATE INDEX IF NOT EXISTS idx_messages_poll ON messages(conversation_id, created_at DESC, id DESC);

CREATE TABLE IF NOT EXISTS message_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT NOT NULL,
  reactor_type TEXT NOT NULL CHECK (reactor_type IN ('admin', 'client')),
  reactor_id TEXT NOT NULL,
  emoji TEXT NOT NULL,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(message_id, reactor_type, reactor_id, emoji),
  FOREIGN KEY (message_id) REFERENCES messages(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_reactions_message ON message_reactions(message_id);

CREATE TABLE IF NOT EXISTS typing_indicators (
  conversation_id TEXT NOT NULL,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('admin', 'client')),
  sender_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (conversation_id, sender_type, sender_id),
  FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);


-- =============================================================================
-- E-Sign / Contract Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS contract_instances (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id INTEGER NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'service_agreement',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','viewed','signed','expired','voided')),
  contract_html TEXT NOT NULL,
  contract_hash TEXT NOT NULL,
  template_key TEXT DEFAULT 'service_agreement',
  template_version TEXT DEFAULT 'v1',
  signer_name TEXT,
  signer_email TEXT,
  signer_ip TEXT,
  signer_user_agent TEXT,
  countersign_required INTEGER NOT NULL DEFAULT 1,
  provider_signed_at DATETIME,
  provider_signer_name TEXT,
  provider_signer_email TEXT,
  provider_signer_ip TEXT,
  provider_signer_user_agent TEXT,
  signature_data TEXT,
  signature_type TEXT,
  signed_at DATETIME,
  consent_accepted INTEGER DEFAULT 0,
  consent_accepted_at DATETIME,
  consent_text_hash TEXT,
  sent_at DATETIME,
  viewed_at DATETIME,
  expires_at DATETIME,
  voided_at DATETIME,
  voided_reason TEXT,
  thumbnail_base64 TEXT,
  auto_reminder_sent_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE INDEX IF NOT EXISTS idx_contracts_client ON contract_instances(client_id);
CREATE INDEX IF NOT EXISTS idx_contracts_status ON contract_instances(status);

CREATE TABLE IF NOT EXISTS signing_sessions (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  contract_id TEXT NOT NULL,
  client_id INTEGER NOT NULL,
  token_hash TEXT NOT NULL,
  token_used_at DATETIME,
  otp_hash TEXT,
  otp_sent_at DATETIME,
  otp_attempts INTEGER DEFAULT 0,
  otp_verified INTEGER DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  is_used INTEGER DEFAULT 0,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_id) REFERENCES contract_instances(id),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE INDEX IF NOT EXISTS idx_signing_sessions_token ON signing_sessions(token_hash);

CREATE TABLE IF NOT EXISTS signature_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id TEXT NOT NULL,
  seq INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT,
  event_hash TEXT NOT NULL,
  prev_hash TEXT,
  actor TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at DATETIME NOT NULL,
  UNIQUE(contract_id, seq),
  FOREIGN KEY (contract_id) REFERENCES contract_instances(id)
);


-- =============================================================================
-- Invoicing Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'draft' CHECK (status IN ('draft','sent','viewed','paid','overdue','cancelled')),
  due_date TEXT,
  sent_at TEXT,
  paid_at TEXT,
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('stripe','manual','cash','check','zelle')),
  stripe_checkout_session_id TEXT,
  stripe_payment_intent_id TEXT,
  subtotal INTEGER NOT NULL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  tax INTEGER DEFAULT 0,
  total INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  verification_token_hash TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON invoices(client_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);

CREATE TABLE IF NOT EXISTS invoice_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  invoice_id TEXT NOT NULL,
  description TEXT NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price INTEGER NOT NULL,
  line_total INTEGER NOT NULL,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_invoice_items ON invoice_items(invoice_id);


-- =============================================================================
-- Media Files & Delivery Packages Tables
-- =============================================================================

CREATE TABLE IF NOT EXISTS media_files (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id INTEGER NOT NULL,
  category TEXT NOT NULL DEFAULT 'document' CHECK (category IN ('photo','video','document')),
  collection_name TEXT,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  content_type TEXT,
  title TEXT,
  description TEXT,
  thumbnail_base64 TEXT,
  is_published INTEGER DEFAULT 0,
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE INDEX IF NOT EXISTS idx_media_client ON media_files(client_id);
CREATE INDEX IF NOT EXISTS idx_media_published ON media_files(client_id, is_published);

CREATE TABLE IF NOT EXISTS delivery_packages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  client_id INTEGER NOT NULL,
  r2_key TEXT NOT NULL,
  filename TEXT NOT NULL,
  file_size INTEGER,
  status TEXT DEFAULT 'ready' CHECK (status IN ('ready','failed','expired')),
  error_message TEXT,
  expires_at TEXT,
  download_count INTEGER DEFAULT 0,
  last_downloaded_at TEXT,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (client_id) REFERENCES clients(id)
);
CREATE INDEX IF NOT EXISTS idx_packages_client ON delivery_packages(client_id);


-- =============================================================================
-- PSI Audit Jobs
-- =============================================================================
-- Stores asynchronous PageSpeed Insights audit jobs spawned by /api/psi-audit.
-- The POST handler inserts a 'pending' row and kicks off `runAudit` via
-- ctx.waitUntil; the GET poll handler reads back status/result.
-- expires_at = retention TTL (default 30 days). Polling validity (10 min) and
-- stale-pending self-heal (75s) are enforced in the GET handler, not here.

CREATE TABLE IF NOT EXISTS psi_audit_jobs (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'pending',
  industry TEXT,
  email TEXT,
  url TEXT,
  ip_address TEXT,
  result_json TEXT,
  error_code TEXT,
  error_message TEXT,
  screenshot_r2_key TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  started_at TEXT,
  completed_at TEXT,
  expires_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_psi_audit_jobs_expires       ON psi_audit_jobs(expires_at);
CREATE INDEX IF NOT EXISTS idx_psi_audit_jobs_email_created ON psi_audit_jobs(email, created_at);


-- =============================================================================
-- Content Kit Usage
-- =============================================================================
-- Tracks which BACKLOG.md entries have been used by the weekly content-kit job.
-- Topic selector queries this to enforce a 12-week dedup window and a 4-week
-- section-diversity bonus. One row per pick; entry_hash is FNV-1a of the
-- normalized backlog entry text (computed in topic-selector.js).

CREATE TABLE IF NOT EXISTS content_kit_usage (
  entry_hash   TEXT PRIMARY KEY,
  used_at      TEXT NOT NULL,
  template     TEXT NOT NULL,
  section      TEXT,
  week         TEXT NOT NULL,
  source_refs  TEXT
);
CREATE INDEX IF NOT EXISTS idx_content_kit_usage_used_at  ON content_kit_usage(used_at);
CREATE INDEX IF NOT EXISTS idx_content_kit_usage_template ON content_kit_usage(template);
CREATE INDEX IF NOT EXISTS idx_content_kit_usage_week     ON content_kit_usage(week);
