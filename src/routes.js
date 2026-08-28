const express = require('express');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const db = require('./db');
const { getSettings, setSettings } = require('./db');
const { runFetchJob } = require('./fetchJob');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'data', 'uploads');
const upload = multer({
  storage: multer.diskStorage({
    destination: UPLOADS_DIR,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
    },
  }),
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

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

/* ---------- Cadastro manual de referencias ---------- */

router.post('/manual-reference', upload.single('image'), (req, res) => {
  try {
    const { profile_username, post_url, caption, category, note, used_in } = req.body || {};

    if (!req.file && !post_url) {
      return res.status(400).json({ error: 'Envie uma imagem ou um link do post' });
    }

    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;
    const mediaJson = imageUrl ? JSON.stringify([{ type: 'image', url: imageUrl }]) : null;

    const finalPostUrl = post_url && post_url.trim() ? post_url.trim() : `manual-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    const result = db
      .prepare(
        `INSERT INTO posts (profile_username, post_url, image_url, media_json, caption, status, category, note, used_in_json, reviewed_at, fetched_at)
         VALUES (?, ?, ?, ?, ?, 'saved', ?, ?, ?, datetime('now'), datetime('now'))`
      )
      .run(
        (profile_username || '').replace('@', '').trim() || 'manual',
        finalPostUrl,
        imageUrl,
        mediaJson,
        caption || '',
        category || null,
        note || null,
        used_in || null
      );

    res.status(201).json({ ok: true, id: result.lastInsertRowid });
  } catch (err) {
    console.error('[POST /manual-reference] erro:', err);
    res.status(500).json({ error: err.message });
  }
});

/* ---------- Marcar onde uma referencia ja foi usada ---------- */

router.post('/posts/:id/used-in', (req, res) => {
  try {
    const { used_in } = req.body || {};
    const used_in_json = JSON.stringify(Array.isArray(used_in) ? used_in : []);

    const result = db.prepare('UPDATE posts SET used_in_json = ? WHERE id = ?').run(used_in_json, req.params.id);
    if (result.changes === 0) return res.status(404).json({ error: 'Post nao encontrado' });
    res.json({ ok: true });
  } catch (err) {
    console.error('[POST /posts/:id/used-in] erro:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;