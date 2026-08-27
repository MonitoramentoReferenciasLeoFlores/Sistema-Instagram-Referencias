/**
 * Camada de integracao com o Bright Data para buscar posts de perfis publicos
 * do Instagram.
 *
 * IMPORTANTE - leia antes de implementar:
 * A API oficial do Instagram (Graph API) NAO permite puxar posts de perfis
 * de terceiros, entao esse projeto depende de um provedor de extracao como o
 * Bright Data.
 *
 * Documentacao de referencia:
 *   https://docs.brightdata.com/api-reference/web-scraper-api/asynchronous-requests
 *
 * ENQUANTO voce nao configura a chave (.env vazio), este modulo roda em
 * MODO DEMO: gera posts fake (incluindo exemplos de carrossel e video)
 * para voce testar o feed sem depender de credenciais reais.
 */

const DEMO_MODE = !process.env.BRIGHTDATA_API_KEY;

const DEMO_CAPTIONS = [
  'Bastidores da producao de conteudo institucional',
  'Case de campanha com storytelling humanizado',
  'Peca grafica para ativacao de marca em evento',
  'Video vertical com identidade visual consistente',
  'Post carrossel explicando um processo em etapas',
];

const DEMO_VIDEO_URL = 'https://www.w3schools.com/html/mov_bbb.mp4';

function buildDemoPost(username, index) {
  const seed = `${username}-${index}-${Date.now()}`;
  const kind = index % 3;

  let media;
  let coverImage;
  if (kind === 0) {
    const url = `https://picsum.photos/seed/${encodeURIComponent(seed)}/1080/1080`;
    media = [{ type: 'image', url }];
    coverImage = url;
  } else if (kind === 1) {
    media = [0, 1, 2].map((i) => ({
      type: 'image',
      url: `https://picsum.photos/seed/${encodeURIComponent(seed + i)}/1080/1350`,
    }));
    coverImage = media[0].url;
  } else {
    media = [{ type: 'video', url: DEMO_VIDEO_URL }];
    coverImage = `https://picsum.photos/seed/${encodeURIComponent(seed)}/1080/1920`;
  }

  return {
    post_url: `https://instagram.com/p/demo-${seed}`,
    image_url: coverImage,
    media_json: JSON.stringify(media),
    caption: DEMO_CAPTIONS[index % DEMO_CAPTIONS.length],
    posted_at: new Date(Date.now() - index * 3600 * 1000).toISOString(),
    likes: Math.floor(Math.random() * 5000),
    num_comments: Math.floor(Math.random() * 200),
    is_sponsored: index === 2 ? 1 : 0,
  };
}

async function fetchLatestPosts(username) {
  if (DEMO_MODE) {
    return [0, 1, 2].map((i) => buildDemoPost(username, i));
  }

  const profileUrl = `https://www.instagram.com/${username}/`;
  const snapshotId = await triggerCollection(profileUrl);
  await waitUntilReady(snapshotId);
  const rawPosts = await downloadSnapshot(snapshotId);
  return rawPosts.map(mapBrightDataPost).filter(Boolean);
}

const BASE_URL = 'https://api.brightdata.com/datasets/v3';
const authHeaders = () => ({
  Authorization: `Bearer ${process.env.BRIGHTDATA_API_KEY}`,
  'Content-Type': 'application/json',
});

async function triggerCollection(profileUrl) {
  const url =
    `${BASE_URL}/trigger?dataset_id=${process.env.BRIGHTDATA_DATASET_ID}` +
    `&include_errors=true&type=discover_new&discover_by=url&limit_per_input=10`;

  const res = await fetch(url, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify([{ url: profileUrl }]),
  });

  if (!res.ok) {
    throw new Error(`Bright Data recusou o pedido (status ${res.status}): ${await res.text()}`);
  }

  const data = await res.json();
  if (Array.isArray(data)) return { immediate: data };
  if (!data.snapshot_id) throw new Error(`Resposta inesperada do Bright Data: ${JSON.stringify(data)}`);
  return data.snapshot_id;
}

async function waitUntilReady(snapshotId, { maxTries = 60, delayMs = 5000 } = {}) {
  if (typeof snapshotId === 'object') return;

  for (let i = 0; i < maxTries; i += 1) {
    const res = await fetch(`${BASE_URL}/progress/${snapshotId}`, { headers: authHeaders() });
    const data = await res.json();

    if (data.status === 'ready') return;
    if (data.status === 'failed') throw new Error(`Coleta falhou no Bright Data: ${JSON.stringify(data)}`);

    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const minutos = Math.round((maxTries * delayMs) / 60000);
  throw new Error(`Tempo esgotado esperando o Bright Data terminar a coleta (mais de ${minutos} minutos).`);
}

async function downloadSnapshot(snapshotId) {
  if (typeof snapshotId === 'object') return snapshotId.immediate;

  const res = await fetch(`${BASE_URL}/snapshot/${snapshotId}?format=json`, { headers: authHeaders() });
  if (!res.ok) throw new Error(`Falha ao baixar resultado do Bright Data (status ${res.status})`);
  return res.json();
}

function mapBrightDataPost(item) {
  if (!item || (item.url && item.error)) return null;

  const postUrl = item.url || item.post_url || item.link;
  if (!postUrl) return null;

  const media = buildMediaList(item);

  const firstImageMedia = media.find((m) => m.type === 'image');
  let coverImage = item.thumbnail || item.display_url || firstImageMedia?.url || null;
  if (coverImage && /\.mp4(\?|$)/i.test(coverImage)) coverImage = null;

  return {
    post_url: postUrl,
    image_url: coverImage,
    media_json: JSON.stringify(media),
    caption: item.caption || item.description || item.title || '',
    posted_at: item.date_posted || item.timestamp || item.posted_at || null,
    likes: typeof item.likes === 'number' ? item.likes : null,
    num_comments: typeof item.num_comments === 'number' ? item.num_comments : null,
    is_sponsored: item.is_paid_partnership ? 1 : 0,
  };
}

function buildMediaList(item) {
  if (Array.isArray(item.post_content) && item.post_content.length > 0) {
    const media = [...item.post_content]
      .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
      .map((entry) => ({
        type: entry.type === 'Video' ? 'video' : 'image',
        url: entry.url,
      }))
      .filter((m) => m.url);

    if (media.length > 0) return media;
  }

  const photos = firstNonEmptyArray(item, ['photos', 'images']);
  const videos = firstNonEmptyArray(item, ['videos']);

  const media = [
    ...photos.map((url) => ({ type: 'image', url: typeof url === 'string' ? url : url?.url })),
    ...videos.map((url) => ({ type: 'video', url: typeof url === 'string' ? url : url?.url })),
  ].filter((m) => m.url);

  if (media.length === 0 && item.thumbnail) {
    media.push({ type: 'image', url: item.thumbnail });
  }

  return media;
}

function firstNonEmptyArray(item, keys) {
  for (const key of keys) {
    const value = item[key];
    if (Array.isArray(value) && value.length > 0) return value.filter(Boolean);
    if (typeof value === 'string' && value) return [value];
  }
  return [];
}

module.exports = { fetchLatestPosts, DEMO_MODE };