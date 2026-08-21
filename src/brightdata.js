/**
 * Camada de integracao com o Bright Data para buscar posts de perfis publicos
 * do Instagram.
 *
 * IMPORTANTE - leia antes de implementar:
 * A API oficial do Instagram (Graph API) NAO permite puxar posts de perfis
 * de terceiros, entao esse projeto depende de um provedor de extracao como o
 * Bright Data. Isso e diferente do conector MCP do Bright Data que voce usa
 * dentro do Claude: aqui, rodando como um servico Node standalone, e preciso
 * uma API Key da sua conta Bright Data (painel -> API Key) e o ID do
 * dataset/scraper de Instagram configurado la.
 *
 * Documentacao de referencia (confirme o endpoint exato no painel Bright
 * Data, pois varia por tipo de dataset):
 *   https://docs.brightdata.com/scraping-automation/web-scraper-api/overview
 *
 * ENQUANTO voce nao configura a chave (.env vazio), este modulo roda em
 * MODO DEMO: gera posts fake para voce testar o feed, a triagem e o banco
 * de referencias sem depender de credenciais reais.
 */

const DEMO_MODE = !process.env.BRIGHTDATA_API_KEY;

const DEMO_CAPTIONS = [
  'Bastidores da producao de conteudo institucional',
  'Case de campanha com storytelling humanizado',
  'Peca grafica para ativacao de marca em evento',
  'Video vertical com identidade visual consistente',
  'Post carrossel explicando um processo em etapas',
];

function buildDemoPost(username, index) {
  const seed = `${username}-${index}-${Date.now()}`;
  return {
    post_url: `https://instagram.com/p/demo-${seed}`,
    image_url: `https://picsum.photos/seed/${encodeURIComponent(seed)}/600/600`,
    caption: DEMO_CAPTIONS[index % DEMO_CAPTIONS.length],
    posted_at: new Date(Date.now() - index * 3600 * 1000).toISOString(),
  };
}

/**
 * Busca os posts mais recentes de um perfil publico do Instagram.
 * @param {string} username - handle do perfil, sem o "@"
 * @returns {Promise<Array<{post_url, image_url, caption, posted_at}>>}
 */
async function fetchLatestPosts(username) {
  if (DEMO_MODE) {
    // Retorna 3 posts fake por perfil, so para popular o feed em modo teste.
    return [0, 1, 2].map((i) => buildDemoPost(username, i));
  }

  // TODO: Implementar a chamada real ao Bright Data aqui.
  // Esboco do fluxo tipico do Web Scraper API do Bright Data:
  //
  //   1. Disparar a coleta para o dataset de Instagram, passando o `username`
  //      (ou URL do perfil) como parametro de input.
  //   2. Fazer polling do endpoint de status ate a coleta terminar (ou usar
  //      webhook, se o seu plano suportar).
  //   3. Buscar o resultado (JSON) com os posts do perfil.
  //   4. Mapear cada post do formato do Bright Data para o formato usado
  //      neste projeto: { post_url, image_url, caption, posted_at }.
  //
  // Exemplo (ajuste endpoint, payload e parsing conforme a doc do seu dataset):
  //
  //   const res = await fetch(
  //     `https://api.brightdata.com/datasets/v3/trigger?dataset_id=${process.env.BRIGHTDATA_DATASET_ID}`,
  //     {
  //       method: 'POST',
  //       headers: {
  //         Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
  //         'Content-Type': 'application/json',
  //       },
  //       body: JSON.stringify([{ url: `https://instagram.com/${username}/` }]),
  //     }
  //   );
  //   const { snapshot_id } = await res.json();
  //   // ... poll + fetch do snapshot_id, depois mapear os campos ...

  throw new Error(
    `BRIGHTDATA_API_KEY configurada, mas a integracao real ainda nao foi ` +
      `implementada em src/brightdata.js (veja o TODO). Peça para o Claude ` +
      `Code completar essa funcao com o endpoint certo do seu dataset.`
  );
}

module.exports = { fetchLatestPosts, DEMO_MODE };
