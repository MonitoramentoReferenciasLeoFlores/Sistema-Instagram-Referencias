-- Perfis do Instagram que estao sendo acompanhados
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Posts coletados. O campo "status" controla se um post ainda esta
-- aguardando triagem, foi guardado como referencia, ou foi descartado.
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  profile_username TEXT NOT NULL,
  post_url TEXT NOT NULL UNIQUE,
  image_url TEXT,
  media_json TEXT,
  caption TEXT,
  posted_at TEXT,
  fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'saved', 'discarded')),
  category TEXT,
  note TEXT,
  reviewed_at TEXT,
  likes INTEGER,
  num_comments INTEGER,
  is_sponsored INTEGER NOT NULL DEFAULT 0,
  used_in_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status);
CREATE INDEX IF NOT EXISTS idx_posts_profile ON posts(profile_username);

-- Configuracoes gerais do sistema (chave/valor), ex.: filtro de engajamento
-- minimo e se publicacoes patrocinadas devem ser ignoradas na coleta.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);