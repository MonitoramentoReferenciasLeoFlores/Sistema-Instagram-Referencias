const state = {
  queue: [],
  index: 0,
  total: 0,
  mediaIndex: 0,
};

/* ---------- Utilitario: monta a lista de midia de um post ---------- */

function parseMedia(post) {
  try {
    const parsed = post.media_json ? JSON.parse(post.media_json) : null;
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch (err) {
    // ignora e cai no fallback abaixo
  }
  return post.image_url ? [{ type: 'image', url: post.image_url }] : [];
}

function renderMediaViewer({ frameEl, prevEl, nextEl, dotsEl, media, index, onChange }) {
  const item = media[index];
  frameEl.innerHTML = '';

  if (!item) return;

  if (item.type === 'video') {
    const video = document.createElement('video');
    video.src = item.url;
    video.controls = true;
    video.playsInline = true;
    frameEl.appendChild(video);
  } else {
    const img = document.createElement('img');
    img.src = item.url;
    img.alt = '';
    frameEl.appendChild(img);
  }

  const hasMultiple = media.length > 1;
  prevEl.hidden = !hasMultiple;
  nextEl.hidden = !hasMultiple;

  dotsEl.innerHTML = '';
  if (hasMultiple) {
    media.forEach((_, i) => {
      const dot = document.createElement('span');
      dot.className = 'dot' + (i === index ? ' active' : '');
      dotsEl.appendChild(dot);
    });
  }

  prevEl.onclick = () => onChange(index > 0 ? index - 1 : media.length - 1);
  nextEl.onclick = () => onChange(index < media.length - 1 ? index + 1 : 0);
}

/* ---------- Navegacao entre abas ---------- */

document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`view-${tab.dataset.view}`).classList.add('active');

    if (tab.dataset.view === 'arquivo') loadArquivo();
    if (tab.dataset.view === 'perfis') loadProfiles();
  });
});

/* ---------- Triagem ---------- */

async function loadFeed() {
  const res = await fetch('/api/feed');
  state.queue = await res.json();
  state.index = 0;
  state.mediaIndex = 0;
  state.total = state.queue.length;
  renderCurrentPost();
}

function renderCurrentPost() {
  const empty = document.getElementById('empty-state');
  const viewer = document.getElementById('media-viewer');
  const stamp = document.getElementById('post-stamp');
  const caption = document.getElementById('post-caption');
  const controls = document.getElementById('decision-controls');
  const counter = document.getElementById('frame-counter');

  const post = state.queue[state.index];

  if (!post) {
    empty.hidden = false;
    viewer.hidden = true;
    stamp.hidden = true;
    caption.hidden = true;
    controls.hidden = true;
    counter.textContent = 'QUADRO — / —';
    return;
  }

  empty.hidden = true;
  viewer.hidden = false;
  stamp.hidden = false;
  caption.hidden = false;
  controls.hidden = false;

  state.mediaIndex = 0;
  renderPostMedia();

  document.getElementById('post-user').textContent = `@${post.profile_username}`;
  document.getElementById('post-date').textContent = post.posted_at
    ? new Date(post.posted_at).toLocaleDateString('pt-BR')
    : '';
  caption.textContent = post.caption || '(sem legenda)';

  counter.textContent = `QUADRO ${state.index + 1} / ${state.total}`;
}

function renderPostMedia() {
  const post = state.queue[state.index];
  if (!post) return;
  const media = parseMedia(post);

  renderMediaViewer({
    frameEl: document.getElementById('media-frame'),
    prevEl: document.getElementById('media-prev'),
    nextEl: document.getElementById('media-next'),
    dotsEl: document.getElementById('media-dots'),
    media,
    index: state.mediaIndex,
    onChange: (newIndex) => {
      state.mediaIndex = newIndex;
      renderPostMedia();
    },
  });
}

async function decide(status, extra = {}) {
  const post = state.queue[state.index];
  if (!post) return;

  try {
    const res = await fetch(`/api/posts/${post.id}/${status}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(extra),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Não consegui salvar/descartar: ${body.error || res.status}`);
      return;
    }
  } catch (err) {
    alert(`Erro de conexão ao tentar salvar: ${err.message}`);
    return;
  }

  state.index += 1;
  renderCurrentPost();
}

document.getElementById('btn-discard').addEventListener('click', () => decide('discard'));

document.getElementById('btn-save').addEventListener('click', () => {
  document.getElementById('save-drawer').hidden = false;
  document.getElementById('save-category').value = '';
  document.getElementById('save-note').value = '';
  document.getElementById('save-category').focus();
});

document.getElementById('btn-cancel-save').addEventListener('click', () => {
  document.getElementById('save-drawer').hidden = true;
});

document.getElementById('btn-confirm-save').addEventListener('click', async () => {
  const category = document.getElementById('save-category').value.trim();
  const note = document.getElementById('save-note').value.trim();
  document.getElementById('save-drawer').hidden = true;
  await decide('save', { category: category || null, note: note || null });
});

document.getElementById('btn-fetch-now').addEventListener('click', async (e) => {
  e.target.textContent = 'Buscando...';
  try {
    const res = await fetch('/api/fetch-now', { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Erro ao buscar posts: ${body.error || res.status}`);
    }
  } catch (err) {
    alert(`Erro de conexão: ${err.message}`);
  }
  await loadFeed();
  e.target.textContent = 'Buscar posts agora';
});

/* ---------- Arquivo (referencias salvas) ---------- */

let arquivoRefs = [];

async function loadArquivo() {
  const q = document.getElementById('filter-q').value;
  const category = document.getElementById('filter-category').value;
  const profile = document.getElementById('filter-profile').value;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (profile) params.set('profile', profile);

  const res = await fetch(`/api/references?${params.toString()}`);
  arquivoRefs = await res.json();

  const sheet = document.getElementById('contact-sheet');
  const emptyNote = document.getElementById('arquivo-empty');
  sheet.innerHTML = '';

  if (arquivoRefs.length === 0) {
    emptyNote.hidden = false;
  } else {
    emptyNote.hidden = true;
    arquivoRefs.forEach((ref, i) => {
      const el = document.createElement('div');
      el.className = 'ref-card';
      el.innerHTML = `
        <img src="${ref.image_url || ''}" alt="${(ref.caption || '').replace(/"/g, '&quot;')}" />
        <div class="ref-meta">
          <span class="ref-user">@${ref.profile_username}</span>
          ${ref.category ? `<span class="ref-category">${ref.category}</span>` : ''}
        </div>
      `;
      el.addEventListener('click', () => openRefModal(i));
      sheet.appendChild(el);
    });
  }

  populateFilterOptions(arquivoRefs);
}

function populateFilterOptions(refs) {
  const catSelect = document.getElementById('filter-category');
  const profSelect = document.getElementById('filter-profile');
  const currentCat = catSelect.value;
  const currentProf = profSelect.value;

  const cats = [...new Set(refs.map((r) => r.category).filter(Boolean))].sort();
  const profs = [...new Set(refs.map((r) => r.profile_username).filter(Boolean))].sort();

  catSelect.innerHTML =
    '<option value="">todas as categorias</option>' +
    cats.map((c) => `<option value="${c}">${c}</option>`).join('');
  profSelect.innerHTML =
    '<option value="">todos os perfis</option>' +
    profs.map((p) => `<option value="${p}">@${p}</option>`).join('');

  catSelect.value = currentCat;
  profSelect.value = currentProf;
}

document.getElementById('filter-q').addEventListener('input', debounce(loadArquivo, 300));
document.getElementById('filter-category').addEventListener('change', loadArquivo);
document.getElementById('filter-profile').addEventListener('change', loadArquivo);

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/* ---------- Modal de visualizacao grande (Arquivo) ---------- */

let modalMediaIndex = 0;
let currentModalRefId = null;

function openRefModal(refIndex) {
  const ref = arquivoRefs[refIndex];
  if (!ref) return;

  modalMediaIndex = 0;
  currentModalRefId = ref.id;
  document.getElementById('modal-user').textContent = `@${ref.profile_username}`;
  document.getElementById('modal-link').href = ref.post_url;
  document.getElementById('modal-caption').textContent = ref.caption || '(sem legenda)';

  const noteBox = document.getElementById('modal-note-box');
  const note = [ref.category, ref.note].filter(Boolean).join(' — ');
  if (note) {
    noteBox.hidden = false;
    document.getElementById('modal-note').textContent = note;
  } else {
    noteBox.hidden = true;
  }

  renderModalMedia(ref);
  document.getElementById('ref-modal').hidden = false;
}

document.getElementById('modal-delete').addEventListener('click', async () => {
  if (!currentModalRefId) return;
  if (!confirm('Excluir esta referência guardada? Essa ação não pode ser desfeita.')) return;

  try {
    const res = await fetch(`/api/posts/${currentModalRefId}`, { method: 'DELETE' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      alert(`Não consegui excluir: ${body.error || res.status}`);
      return;
    }
  } catch (err) {
    alert(`Erro de conexão ao excluir: ${err.message}`);
    return;
  }

  document.getElementById('ref-modal').hidden = true;
  document.getElementById('modal-media-frame').innerHTML = '';
  loadArquivo();
});

function renderModalMedia(ref) {
  const media = parseMedia(ref);
  renderMediaViewer({
    frameEl: document.getElementById('modal-media-frame'),
    prevEl: document.getElementById('modal-media-prev'),
    nextEl: document.getElementById('modal-media-next'),
    dotsEl: document.getElementById('modal-media-dots'),
    media,
    index: modalMediaIndex,
    onChange: (newIndex) => {
      modalMediaIndex = newIndex;
      renderModalMedia(ref);
    },
  });
}

document.getElementById('modal-close').addEventListener('click', () => {
  document.getElementById('ref-modal').hidden = true;
  document.getElementById('modal-media-frame').innerHTML = '';
});

document.getElementById('ref-modal').addEventListener('click', (e) => {
  if (e.target.id === 'ref-modal') {
    document.getElementById('ref-modal').hidden = true;
    document.getElementById('modal-media-frame').innerHTML = '';
  }
});

/* ---------- Perfis ---------- */

async function loadProfiles() {
  const res = await fetch('/api/profiles');
  const profiles = await res.json();
  const list = document.getElementById('profile-list');
  list.innerHTML = '';

  for (const p of profiles) {
    const li = document.createElement('li');
    li.innerHTML = `<span>@${p.username}${p.active ? '' : ' (inativo)'}</span>`;
    if (p.active) {
      const btn = document.createElement('button');
      btn.textContent = 'Remover';
      btn.addEventListener('click', async () => {
        await fetch(`/api/profiles/${p.id}`, { method: 'DELETE' });
        loadProfiles();
      });
      li.appendChild(btn);
    }
    list.appendChild(li);
  }
}

document.getElementById('form-add-profile').addEventListener('submit', async (e) => {
  e.preventDefault();
  const input = document.getElementById('new-profile-username');
  const username = input.value.trim();
  if (!username) return;

  await fetch('/api/profiles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  });
  input.value = '';
  loadProfiles();
});

/* ---------- Boot ---------- */

loadFeed();