require('dotenv').config();
const db = require('./db');
const { getSettings } = require('./db');
const { fetchLatestPosts, DEMO_MODE } = require('./brightdata');

const insertPost = db.prepare(`
  INSERT INTO posts (profile_username, post_url, image_url, media_json, caption, posted_at, likes, num_comments, is_sponsored)
  VALUES (@profile_username, @post_url, @image_url, @media_json, @caption, @posted_at, @likes, @num_comments, @is_sponsored)
  ON CONFLICT(post_url) DO UPDATE SET
    image_url = excluded.image_url,
    media_json = excluded.media_json,
    caption = excluded.caption,
    likes = excluded.likes,
    num_comments = excluded.num_comments,
    is_sponsored = excluded.is_sponsored
`);

/**
 * Busca posts novos para todos os perfis ativos e insere no banco.
 * Se um post ja existir (pendente, guardado ou descartado), a imagem de
 * capa/midia/legenda/engajamento dele e atualizada com a versao mais
 * recente -- isso e o que permite que uma correcao no sistema (como a do
 * carrossel/video/thumbnail) tambem valha para posts que ja tinham sido
 * coletados antes, inclusive os que voce ja guardou. O status (pendente/
 * guardado/descartado), a categoria e a nota nunca sao alterados por essa
 * busca.
 *
 * Antes de inserir cada post, aplica os filtros configurados em
 * "Configuracoes" (Perfis): posts patrocinados e posts abaixo do
 * engajamento minimo simplesmente nao entram na fila de Triagem.
 *
 * Os perfis sao buscados todos ao mesmo tempo (nao um de cada vez), pra o
 * tempo total nao virar "numero de perfis x tempo de espera de cada um".
 */
async function runFetchJob() {
  const profiles = db.prepare('SELECT username FROM profiles WHERE active = 1').all();

  if (profiles.length === 0) {
    console.log('[fetchJob] Nenhum perfil ativo cadastrado. Adicione perfis via POST /api/profiles.');
    return { profilesChecked: 0, postsInserted: 0 };
  }

  const settings = getSettings();

  const results = await Promise.allSettled(
    profiles.map(async ({ username }) => {
      const posts = await fetchLatestPosts(username);
      let inserted = 0;
      let skipped = 0;

      for (const post of posts) {
        if (settings.exclude_sponsored && post.is_sponsored) {
          skipped += 1;
          continue;
        }
        const engagement = (post.likes || 0) + (post.num_comments || 0);
        if (engagement < settings.min_engagement) {
          skipped += 1;
          continue;
        }

        const result = insertPost.run({ profile_username: username, ...post });
        if (result.changes > 0) inserted += 1;
      }

      if (skipped > 0) {
        console.log(`[fetchJob] @${username}: ${skipped} post(s) ignorado(s) pelos filtros (patrocinado/engajamento).`);
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

// Permite rodar manualmente: node src/fetchJob.js --once
if (require.main === module) {
  runFetchJob().then(() => process.exit(0));
}

module.exports = { runFetchJob };