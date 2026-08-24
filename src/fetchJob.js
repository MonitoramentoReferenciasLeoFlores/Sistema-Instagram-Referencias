require('dotenv').config();
const db = require('./db');
const { fetchLatestPosts, DEMO_MODE } = require('./brightdata');

const insertPost = db.prepare(`
  INSERT OR IGNORE INTO posts (profile_username, post_url, image_url, caption, posted_at)
  VALUES (@profile_username, @post_url, @image_url, @caption, @posted_at)
`);

async function runFetchJob() {
  const profiles = db.prepare('SELECT username FROM profiles WHERE active = 1').all();

  if (profiles.length === 0) {
    console.log('[fetchJob] Nenhum perfil ativo cadastrado. Adicione perfis via POST /api/profiles.');
    return { profilesChecked: 0, postsInserted: 0 };
  }

  // Busca todos os perfis ao mesmo tempo, em vez de um de cada vez -- assim
  // o tempo total nao vira "numero de perfis x tempo de espera de cada um".
  const results = await Promise.allSettled(
    profiles.map(async ({ username }) => {
      const posts = await fetchLatestPosts(username);
      let inserted = 0;
      for (const post of posts) {
        const result = insertPost.run({ profile_username: username, ...post });
        if (result.changes > 0) inserted += 1;
      }
      return inserted;
    })
  );

  let postsInserted = 0;
  results.forEach((result, i) => {
    const username = profiles[i].username;
    if (result.status === 'fulfilled') {
      postsInserted += result.value;
    } else {
      console.error(`[fetchJob] Erro ao buscar posts de @${username}:`, result.reason.message);
    }
  });

  console.log(
    `[fetchJob] Perfis checados: ${profiles.length} | Posts novos: ${postsInserted}` +
      (DEMO_MODE ? ' (modo demo)' : '')
  );
  return { profilesChecked: profiles.length, postsInserted };
}

if (require.main === module) {
  runFetchJob().then(() => process.exit(0));
}

module.exports = { runFetchJob };