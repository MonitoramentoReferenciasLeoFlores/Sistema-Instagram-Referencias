require('dotenv').config();
const db = require('./db');
const { fetchLatestPosts, DEMO_MODE } = require('./brightdata');

const insertPost = db.prepare(`
  INSERT OR IGNORE INTO posts (profile_username, post_url, image_url, caption, posted_at)
  VALUES (@profile_username, @post_url, @image_url, @caption, @posted_at)
`);

/**
 * Busca posts novos para todos os perfis ativos e insere no banco
 * (ignorando posts cuja post_url ja existe, via UNIQUE + INSERT OR IGNORE).
 */
async function runFetchJob() {
  const profiles = db.prepare('SELECT username FROM profiles WHERE active = 1').all();

  if (profiles.length === 0) {
    console.log('[fetchJob] Nenhum perfil ativo cadastrado. Adicione perfis via POST /api/profiles.');
    return { profilesChecked: 0, postsInserted: 0 };
  }

  let postsInserted = 0;

  for (const { username } of profiles) {
    try {
      const posts = await fetchLatestPosts(username);
      for (const post of posts) {
        const result = insertPost.run({ profile_username: username, ...post });
        if (result.changes > 0) postsInserted += 1;
      }
    } catch (err) {
      console.error(`[fetchJob] Erro ao buscar posts de @${username}:`, err.message);
    }
  }

  console.log(
    `[fetchJob] Perfis checados: ${profiles.length} | Posts novos: ${postsInserted}` +
      (DEMO_MODE ? ' (modo demo)' : '')
  );
  return { profilesChecked: profiles.length, postsInserted };
}

// Permite rodar manualmente: node src/fetchJob.js --once
if (require.main === module) {
  runFetchJob().then(() => process.exit(0));
}

module.exports = { runFetchJob };
