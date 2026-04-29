/**
 * Migration runner — idempotent schema migrations for all packs.
 * Safe for concurrent cold starts (INSERT OR IGNORE + PRAGMA checks).
 */

/**
 * Add a column to a table if it doesn't already exist.
 * D1/SQLite doesn't support IF NOT EXISTS on ALTER TABLE ADD COLUMN.
 */
export async function addColumnIfNotExists(db, table, column, type, defaultVal) {
  const info = await db.prepare('PRAGMA table_info(' + table + ')').all();
  const exists = info.results?.some(c => c.name === column);
  if (exists) return;
  const def = defaultVal !== undefined ? ' DEFAULT ' + defaultVal : '';
  await db.prepare('ALTER TABLE ' + table + ' ADD COLUMN ' + column + ' ' + type + def).run();
}

/**
 * Ensure all migrations for a pack are applied.
 * @param {object} db — D1 database binding
 * @param {{ pack: string, migrations: Array<{ version: number, description: string, sql: string }> }} config
 */
export async function ensureMigrations(db, config) {
  // Bootstrap _migrations table
  await db.prepare(`CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    pack TEXT NOT NULL,
    version INTEGER NOT NULL,
    description TEXT NOT NULL,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pack, version)
  )`).run();

  // Get current version for this pack
  const row = await db.prepare(
    'SELECT COALESCE(MAX(version), 0) as v FROM _migrations WHERE pack = ?'
  ).bind(config.pack).first();
  const currentVersion = row?.v || 0;

  for (const m of config.migrations) {
    if (m.version <= currentVersion) continue;
    try {
      // Run the migration SQL (must be idempotent)
      const statements = m.sql.split(';').map(s => s.trim()).filter(Boolean);
      for (const stmt of statements) {
        await db.prepare(stmt).run();
      }
      // Record the migration (INSERT OR IGNORE handles race conditions)
      await db.prepare(
        'INSERT OR IGNORE INTO _migrations (pack, version, description) VALUES (?, ?, ?)'
      ).bind(config.pack, m.version, m.description).run();
    } catch (error) {
      console.error('[Migrate] Failed migration ' + config.pack + ' v' + m.version + ':', error);
      throw error;
    }
  }
}
