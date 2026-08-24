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

module.exports = db;