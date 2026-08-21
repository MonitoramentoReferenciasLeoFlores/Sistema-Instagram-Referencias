const state = {
  queue: [],
  index: 0,
  total: 0,
};

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
  state.total = state.queue.length;
  renderCurrentPost();
}

function renderCurrentPost() {
  const card = document.getElementById('print-card');
  const empty = document.getElementById('empty-state');
  const img = document.getElementById('post-image');
  const stamp = document.getElementById('post-stamp');
  const caption = document.getElementById('post-caption');
  const controls = document.getElementById('decision-controls');
  const counter = document.getElementById('frame-counter');

  const post = state.queue[state.index];

  if (!post) {
    empty.hidden = false;
    img.hidden = true;
    stamp.hidden = true;
    caption.hidden = true;
    controls.hidden = true;
    counter.textContent = 'QUADRO — / —';
    return;
  }

  empty.hidden = true;
  img.hidden = false;
  stamp.hidden = false;
  caption.hidden = false;
  controls.hidden = false;

  img.src = post.image_url || '';
  img.alt = post.caption || '';
  document.getElementById('post-user').textContent = `@${post.profile_username}`;
  document.getElementById('post-date').textContent = post.posted_at
    ? new Date(post.posted_at).toLocaleDateString('pt-BR')
    : '';
  caption.textContent = post.caption || '(sem legenda)';

  counter.textContent = `QUADRO ${state.index + 1} / ${state.total}`;
}

async function decide(status, extra = {}) {
  const post = state.queue[state.index];
  if (!post) return;

  await fetch(`/api/posts/${post.id}/${status}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(extra),
  });

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
  await fetch('/api/fetch-now', { method: 'POST' });
  await loadFeed();
  e.target.textContent = 'Buscar posts agora';
});

/* ---------- Arquivo (referencias salvas) ---------- */

async function loadArquivo() {
  const q = document.getElementById('filter-q').value;
  const category = document.getElementById('filter-category').value;
  const profile = document.getElementById('filter-profile').value;

  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (profile) params.set('profile', profile);

  const res = await fetch(`/api/references?${params.toString()}`);
  const refs = await res.json();

  const sheet = document.getElementById('contact-sheet');
  const emptyNote = document.getElementById('arquivo-empty');
  sheet.innerHTML = '';

  if (refs.length === 0) {
    emptyNote.hidden = false;
  } else {
    emptyNote.hidden = true;
    for (const ref of refs) {
      const el = document.createElement('div');
      el.className = 'ref-card';
      el.innerHTML = `
        <img src="${ref.image_url || ''}" alt="${(ref.caption || '').replace(/"/g, '&quot;')}" />
        <div class="ref-meta">
          <span class="ref-user">@${ref.profile_username}</span>
          ${ref.category ? `<span class="ref-category">${ref.category}</span>` : ''}
        </div>
      `;
      el.title = ref.note || ref.caption || '';
      sheet.appendChild(el);
    }
  }

  // popula os filtros de categoria/perfil com valores unicos ja existentes
  populateFilterOptions(refs);
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
