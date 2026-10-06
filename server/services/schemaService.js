const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');

async function ensureAnalyticsSchema() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS data_imports (
      id UUID PRIMARY KEY,
      dataset_type VARCHAR(30) NOT NULL,
      original_filename TEXT NOT NULL,
      period_label VARCHAR(100),
      period_start DATE,
      period_end DATE,
      territory VARCHAR(255),
      detected_columns JSONB NOT NULL DEFAULT '{}'::jsonb,
      warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
      row_count INTEGER NOT NULL DEFAULT 0,
      valid_rows INTEGER NOT NULL DEFAULT 0,
      invalid_rows INTEGER NOT NULL DEFAULT 0,
      status VARCHAR(30) NOT NULL DEFAULT 'processing',
      imported_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      completed_at TIMESTAMPTZ
    );
    CREATE INDEX IF NOT EXISTS idx_data_imports_created_at ON data_imports(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_data_imports_type ON data_imports(dataset_type);

    CREATE TABLE IF NOT EXISTS data_snapshots (
      id UUID PRIMARY KEY,
      import_id UUID NOT NULL REFERENCES data_imports(id) ON DELETE CASCADE,
      dataset_type VARCHAR(30) NOT NULL,
      period_label VARCHAR(100),
      territory VARCHAR(255),
      oked_code VARCHAR(30),
      activity TEXT,
      company_bin VARCHAR(30),
      company_name TEXT,
      employees NUMERIC(18,2),
      payroll NUMERIC(20,2),
      average_salary NUMERIC(20,2),
      taxes NUMERIC(20,2),
      share NUMERIC(12,4),
      raw_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_snapshots_import ON data_snapshots(import_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_oked ON data_snapshots(oked_code);
    CREATE INDEX IF NOT EXISTS idx_snapshots_company ON data_snapshots(company_bin);
    CREATE INDEX IF NOT EXISTS idx_snapshots_activity ON data_snapshots(activity);
    CREATE INDEX IF NOT EXISTS idx_snapshots_period ON data_snapshots(period_label);

    CREATE TABLE IF NOT EXISTS audit_logs (
      id UUID PRIMARY KEY,
      user_id UUID,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(100),
      entity_id VARCHAR(255),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      ip VARCHAR(100),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
  `);
}

async function logAudit({ userId, action, entityType, entityId, metadata, ip }) {
  try {
    await db.query(
      `INSERT INTO audit_logs (id,user_id,action,entity_type,entity_id,metadata,ip)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [uuidv4(), userId || null, action, entityType || null, entityId || null, JSON.stringify(metadata || {}), ip || null]
    );
  } catch (error) {
    console.error('[audit] failed:', error.message);
  }
}

module.exports = { ensureAnalyticsSchema, logAudit };
