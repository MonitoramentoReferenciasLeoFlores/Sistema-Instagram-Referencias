const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const DB_PATH = path.join(__dirname, '..', 'data', 'referencias.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Aplica o schema (idempotente: so cria o que nao existe)
const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
db.exec(schema);

// Migracao leve: adiciona colunas novas em bancos que ja existiam antes
// desta versao, sem apagar nenhum dado que ja estava la.
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('posts', 'media_json', 'TEXT');
ensureColumn('posts', 'likes', 'INTEGER');
ensureColumn('posts', 'num_comments', 'INTEGER');
ensureColumn('posts', "is_sponsored", 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('posts', 'used_in_json', 'TEXT');

/**
 * Le as configuracoes de filtro de coleta (engajamento minimo e se deve
 * ignorar publicacoes patrocinadas). Valores padrao: sem minimo, e
 * patrocinadas ficam ocultas por padrao.
 */
function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return {
    min_engagement: Number(map.min_engagement || 0),
    exclude_sponsored: map.exclude_sponsored === undefined ? true : map.exclude_sponsored === '1',
  };
}

function setSettings({ min_engagement, exclude_sponsored }) {
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  );
  upsert.run('min_engagement', String(min_engagement ?? 0));
  upsert.run('exclude_sponsored', exclude_sponsored ? '1' : '0');
}

module.exports = db;
module.exports.getSettings = getSettings;
module.exports.setSettings = setSettings;