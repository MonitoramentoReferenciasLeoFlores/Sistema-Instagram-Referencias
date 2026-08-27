const express = require('express');
const db = require('./db');
const { getSettings, setSettings } = require('./db');
const { runFetchJob } = require('./fetchJob');

const router = express.Router();

/* ---------- Configuracoes (filtros de coleta) ---------- */

router.get('/settings', (req, res) => {
  res.json(getSettings());
});

router.post('/settings', (req, res) => {
  const { min_engagement, exclude_sponsored } = req.body || {};
  try {
    setSettings({
      min_engagement: Number(min_engagement) || 0,
      exclude_sponsored: Boolean(exclude_sponsored),
    });
    res.json(getSettings());
  } catch (err) {
    console.error('[POST /settings] erro:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------- Feed de triagem ---------- */

router.get('/feed', (req, res) => {
  const posts = db
    .prepare(`SELECT * FROM posts WHERE status = 'pending' ORDER BY fetched_at ASC`)
    .all();
  res.json(posts);
});

router.post('/posts/:id/save', (req, res) => {
  try {
    const { category = null, note = null } = req.body || {};
    const result = db
      .prepare(
        `UPDATE posts SET status = 'saved', category = ?, note = ?, reviewed_at = datetime('now')
         WHERE id = ? AND status = 'pending'`
      )
      .run(category, note, req.params.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Post nao encontrado ou ja revisado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /posts/:id/save] erro:', err);
    res.status(500).json({ error: err.message });
  }
});

router.post('/posts/:id/discard', (req, res) => {
  try {
    const result = db
      .prepare(
        `UPDATE posts SET status = 'discarded', reviewed_at = datetime('now')
         WHERE id = ? AND status = 'pending'`
      )
      .run(req.params.id);

    if (result.changes === 0) return res.status(404).json({ error: 'Post nao encontrado ou ja revisado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /posts/:id/discard] erro:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------- Banco de referencias salvas ---------- */

router.get('/categories', (req, res) => {
  const rows = db
    .prepare(`SELECT DISTINCT category FROM posts WHERE category IS NOT NULL AND category != '' ORDER BY category`)
    .all();
  res.json(rows.map((r) => r.category));
});

router.get('/references', (req, res) => {
  const { q, category, profile } = req.query;

  let sql = `SELECT * FROM posts WHERE status = 'saved'`;
  const params = [];

  if (category) {
    sql += ' AND category = ?';
    params.push(category);
  }
  if (profile) {
    sql += ' AND profile_username = ?';
    params.push(profile);
  }
  if (q) {
    sql += ' AND (caption LIKE ? OR note LIKE ?)';
    params.push(`%${q}%`, `%${q}%`);
  }

  sql += ' ORDER BY reviewed_at DESC';

  const references = db.prepare(sql).all(...params);
  res.json(references);
});

/* ---------- Perfis acompanhados ---------- */

router.get('/profiles', (req, res) => {
  res.json(db.prepare('SELECT * FROM profiles ORDER BY username').all());
});

router.post('/profiles', (req, res) => {
  const { username, display_name = null } = req.body || {};
  if (!username) return res.status(400).json({ error: 'username e obrigatorio' });

  try {
    db.prepare('INSERT INTO profiles (username, display_name) VALUES (?, ?)').run(
      username.replace('@', '').trim(),
      display_name
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    res.status(409).json({ error: 'Perfil ja cadastrado' });
  }
});

router.delete('/profiles/:id', (req, res) => {
  db.prepare('UPDATE profiles SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

/* ---------- Disparo manual da coleta ---------- */

router.post('/fetch-now', async (req, res) => {
  try {
    const result = await runFetchJob();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ---------- Excluir um post/referencia permanentemente ---------- */

router.delete('/posts/:id', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Post nao encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[DELETE /posts/:id] erro:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;