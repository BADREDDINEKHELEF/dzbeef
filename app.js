// ─── SUPABASE CLIENT ───
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ─── STATE ───
let beefs = [];
let votes = {};         // { [beefId]: { dz: number, ma: number } }
let myVotes = {};       // stored in localStorage — which side user picked per beef
let totalDZ = 0;
let totalMA = 0;

// ─── VOTER ID (anonymous fingerprint) ───
function getVoterId() {
  let id = localStorage.getItem('dzma_voter_id');
  if (!id) {
    id = 'v_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    localStorage.setItem('dzma_voter_id', id);
  }
  return id;
}
const VOTER_ID = getVoterId();

// ─── LOAD MY VOTES FROM LOCALSTORAGE ───
function loadMyVotes() {
  try { myVotes = JSON.parse(localStorage.getItem('dzma_my_votes') || '{}'); } catch(e) { myVotes = {}; }
}
function saveMyVote(beefId, side) {
  myVotes[beefId] = side;
  localStorage.setItem('dzma_my_votes', JSON.stringify(myVotes));
}

// ─── FETCH BEEFS ───
async function fetchBeefs() {
  const { data, error } = await db
    .from('beefs')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('fetchBeefs:', error); return []; }
  return data || [];
}

// ─── FETCH VOTE TOTALS ───
async function fetchVotes() {
  const { data, error } = await db
    .from('votes')
    .select('beef_id, side');

  if (error) { console.error('fetchVotes:', error); return {}; }

  const tally = {};
  (data || []).forEach(row => {
    if (!tally[row.beef_id]) tally[row.beef_id] = { dz: 0, ma: 0 };
    tally[row.beef_id][row.side]++;
  });
  return tally;
}

// ─── CAST VOTE ───
async function castVote(beefId, side) {
  if (myVotes[beefId]) {
    showToast('Already voted on this beef', 'err');
    return;
  }

  // Optimistic update
  if (!votes[beefId]) votes[beefId] = { dz: 0, ma: 0 };
  votes[beefId][side]++;
  saveMyVote(beefId, side);
  updateCardVotes(beefId);
  updateScoreboard();
  updateVoteUI(beefId, side);
  showToast(side === 'dz' ? '🇩🇿 Voted DZ!' : '🇲🇦 Voted MA!', side);

  // Persist to Supabase
  const { error } = await db.from('votes').insert({
    beef_id: beefId,
    side: side,
    voter_id: VOTER_ID
  });

  if (error) {
    // If duplicate (already voted from another device), rollback
    if (error.code === '23505') {
      votes[beefId][side]--;
      updateCardVotes(beefId);
      updateScoreboard();
      showToast('Vote already registered', 'err');
    } else {
      console.error('castVote:', error);
    }
  }
}

// ─── REALTIME SUBSCRIPTION ───
function subscribeToVotes() {
  db
    .channel('votes-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'votes' }, payload => {
      const { beef_id, side, voter_id } = payload.new;
      if (voter_id === VOTER_ID) return; // Skip own votes (already applied optimistically)
      if (!votes[beef_id]) votes[beef_id] = { dz: 0, ma: 0 };
      votes[beef_id][side]++;
      updateCardVotes(beef_id);
      updateScoreboard();
      animateCounterBump(beef_id, side);
    })
    .subscribe();
}

// ─── UTILS ───
const pct = (a, b) => { const t = a + b; return t ? [Math.round(a/t*100), Math.round(b/t*100)] : [50, 50]; };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

// ─── UPDATE SCOREBOARD ───
function updateScoreboard() {
  let dz = 0, ma = 0;
  beefs.forEach(b => {
    const v = votes[b.id] || { dz: 0, ma: 0 };
    dz += v.dz; ma += v.ma;
  });
  totalDZ = dz; totalMA = ma;

  animateNumber('dz-total', dz);
  animateNumber('ma-total', ma);

  const [dp] = pct(dz, ma);
  const dzBar = $('war-fill-dz');
  if (dzBar) dzBar.style.width = dp + '%';
  const dpEl = $('war-pct-dz'), mpEl = $('war-pct-ma');
  if (dpEl) dpEl.textContent = dp + '%';
  if (mpEl) mpEl.textContent = (100 - dp) + '%';

  const total = dz + ma;
  const tEl = $('total-votes'), fEl = $('footer-votes');
  if (tEl) tEl.textContent = total.toLocaleString() + ' total votes cast';
  if (fEl) fEl.textContent = total.toLocaleString();

  const statusEl = $('score-status');
  if (statusEl) {
    if (dp > 52) statusEl.textContent = '🇩🇿 DZ leading';
    else if (dp < 48) statusEl.textContent = '🇲🇦 MA leading';
    else statusEl.textContent = 'Too close';
  }
}

function animateNumber(id, target) {
  const el = $(id);
  if (!el) return;
  const current = parseInt(el.textContent.replace(/,/g, '')) || 0;
  if (current === target) return;
  const diff = target - current;
  const steps = Math.min(30, Math.abs(diff));
  const step = diff / steps;
  let val = current;
  let i = 0;
  const tick = () => {
    i++;
    val += step;
    el.textContent = Math.round(val).toLocaleString();
    if (i < steps) requestAnimationFrame(tick);
    else el.textContent = target.toLocaleString();
  };
  requestAnimationFrame(tick);
}

function animateCounterBump(beefId, side) {
  const el = $(side === 'dz' ? `cd-${beefId}` : `cm-${beefId}`);
  if (el) { el.classList.remove('vote-burst'); void el.offsetWidth; el.classList.add('vote-burst'); }
}

// ─── UPDATE CARD VOTES ───
function updateCardVotes(beefId) {
  const v = votes[beefId] || { dz: 0, ma: 0 };
  const [dp, mp] = pct(v.dz, v.ma);
  const set = (id, val) => { const el = $(id); if (el) el.textContent = val; };
  set(`cd-${beefId}`, v.dz.toLocaleString());
  set(`cm-${beefId}`, v.ma.toLocaleString());
  set(`pd-${beefId}`, '🇩🇿 ' + dp + '%');
  set(`pm-${beefId}`, mp + '% 🇲🇦');
  set(`vt-${beefId}`, (v.dz + v.ma).toLocaleString() + ' votes');
  const bar = $(`mbar-${beefId}`);
  if (bar) bar.style.width = dp + '%';
}

function updateVoteUI(beefId, side) {
  const dzBtn = $(`vb-dz-${beefId}`), maBtn = $(`vb-ma-${beefId}`);
  const other = side === 'dz' ? 'ma' : 'dz';
  const myBtn = $(`vb-${side}-${beefId}`);
  const otherBtn = $(`vb-${other}-${beefId}`);
  if (myBtn) { myBtn.classList.add('voted'); myBtn.classList.add('vote-burst'); }
  if (otherBtn) { otherBtn.disabled = true; }
  const lbl = $(`vlbl-${beefId}`);
  if (lbl) {
    lbl.textContent = '✓ voted';
    lbl.style.color = side === 'dz' ? 'var(--dz-light)' : 'var(--ma-light)';
  }
}

// ─── RENDER BEEFS ───
function mkTracks(tracks) {
  if (!tracks || !tracks.length) return '';
  return tracks.map(t => {
    const yt = t.url ? `<a href="${esc(t.url)}" class="track-yt" target="_blank" rel="noopener">▶ YT</a>` : '';
    const name = t.url
      ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.name)}</a>`
      : esc(t.name);
    return `<div class="track"><span>${name}</span>${yt}</div>`;
  }).join('');
}

function renderBeefs() {
  const list = $('beef-list');
  if (!list) return;

  if (!beefs.length) {
    list.innerHTML = '<div class="loading-state"><p style="color:var(--muted)">No beefs yet. Check back soon.</p></div>';
    return;
  }

  list.innerHTML = beefs.map((b, i) => {
    const v = votes[b.id] || { dz: 0, ma: 0 };
    const [dp, mp] = pct(v.dz, v.ma);
    const my = myVotes[b.id];
    const dzV = my === 'dz', maV = my === 'ma';

    const statusMap = { hot: 'badge-hot', ongoing: 'badge-on', settled: 'badge-done' };
    const labelMap = { hot: '🔥 LIVE', ongoing: '⚡ ONGOING', settled: '✅ SETTLED' };
    const statusCls = statusMap[b.status] || 'badge-done';
    const statusLbl = labelMap[b.status] || 'SETTLED';

    const win = v.dz > v.ma ? 'dz' : v.ma > v.dz ? 'ma' : null;
    const dzBadge = (b.status === 'settled' && win === 'dz') ? '<span class="winner-badge">WINNER</span>' : '';
    const maBadge = (b.status === 'settled' && win === 'ma') ? '<span class="winner-badge">WINNER</span>' : '';

    const dz_tracks = Array.isArray(b.dz_tracks) ? b.dz_tracks : (b.dz_tracks ? JSON.parse(b.dz_tracks) : []);
    const ma_tracks = Array.isArray(b.ma_tracks) ? b.ma_tracks : (b.ma_tracks ? JSON.parse(b.ma_tracks) : []);

    const dzYT = dz_tracks[0]?.url ? `<a href="${esc(dz_tracks[0].url)}" class="yt-pill" target="_blank" rel="noopener">▶ DZ TRACK</a>` : '';
    const maYT = ma_tracks[0]?.url ? `<a href="${esc(ma_tracks[0].url)}" class="yt-pill" target="_blank" rel="noopener">▶ MA TRACK</a>` : '';

    return `
    <div class="beef-card${b.is_fresh ? ' fresh-card' : ''}" data-n="${String(i+1).padStart(2,'0')}" id="card-${b.id}">
      ${b.is_fresh ? '<span class="fresh-strip">🚨 Fresh Drop — 2026</span>' : ''}
      <div class="card-head">
        <span class="status-badge ${statusCls}">${statusLbl}</span>
        <span class="card-title">${esc(b.title)}</span>
        ${b.views ? `<span class="card-views">${esc(b.views)}</span>` : ''}
        ${dzYT}${maYT}
      </div>
      <div class="card-desc">${esc(b.description || '')}</div>
      <div class="card-body">
        <div class="fighter fighter-l">
          <div class="fighter-name">🇩🇿 ${esc(b.dz_name || '')}${dzBadge}</div>
          <div class="fighter-sub">${esc(b.dz_sub || '')}</div>
          <div class="fighter-bio">${esc(b.dz_bio || '')}</div>
          ${dz_tracks.length ? `<div class="tracks-label">Tracks</div>${mkTracks(dz_tracks)}` : ''}
        </div>
        <div class="vote-col">
          <button class="vote-btn dz-vote${dzV ? ' voted' : ''}" id="vb-dz-${b.id}"
            ${my && !dzV ? 'disabled' : ''} onclick="castVote('${b.id}','dz')">
            <span class="vote-flag">🇩🇿</span>
            <span class="vote-count" id="cd-${b.id}">${v.dz.toLocaleString()}</span>
            <span>VOTE</span>
          </button>
          <div class="vs-divider">VS</div>
          <button class="vote-btn ma-vote${maV ? ' voted' : ''}" id="vb-ma-${b.id}"
            ${my && !maV ? 'disabled' : ''} onclick="castVote('${b.id}','ma')">
            <span class="vote-flag">🇲🇦</span>
            <span class="vote-count" id="cm-${b.id}">${v.ma.toLocaleString()}</span>
            <span>VOTE</span>
          </button>
          <div class="voted-label" id="vlbl-${b.id}" style="color:${dzV?'var(--dz-light)':maV?'var(--ma-light)':'transparent'}">${my ? '✓ voted' : '.'}</div>
        </div>
        <div class="fighter fighter-r">
          <div class="fighter-name">🇲🇦 ${esc(b.ma_name || '')}${maBadge}</div>
          <div class="fighter-sub">${esc(b.ma_sub || '')}</div>
          <div class="fighter-bio">${esc(b.ma_bio || '')}</div>
          ${ma_tracks.length ? `<div class="tracks-label">Tracks</div>${mkTracks(ma_tracks)}` : ''}
        </div>
      </div>
      <div class="mini-bar-row">
        <div class="mini-bar">
          <div class="mini-fill-dz" id="mbar-${b.id}" style="width:${dp}%"></div>
          <div class="mini-fill-ma"></div>
        </div>
        <div class="mini-pcts">
          <span class="dp" id="pd-${b.id}">🇩🇿 ${dp}%</span>
          <span class="vt" id="vt-${b.id}">${(v.dz+v.ma).toLocaleString()} votes</span>
          <span class="mp" id="pm-${b.id}">${mp}% 🇲🇦</span>
        </div>
      </div>
    </div>`;
  }).join('');

  // Stagger card reveal with IntersectionObserver
  observeCards();
}

// ─── SCROLL REVEAL ───
function observeCards() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry, idx) => {
      if (entry.isIntersecting) {
        setTimeout(() => entry.target.classList.add('card-visible'), idx * 80);
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.08 });

  document.querySelectorAll('.beef-card').forEach(card => observer.observe(card));

  // Also handle generic reveal-section
  const secObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); secObserver.unobserve(e.target); } });
  }, { threshold: 0.1 });
  document.querySelectorAll('.reveal-section').forEach(el => secObserver.observe(el));
}

// ─── TOAST ───
let toastTimer;
function showToast(msg, type = 'dz') {
  const t = $('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show toast-${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ─── CUSTOM CURSOR ───
function initCursor() {
  if (window.innerWidth < 640) return;
  const cursor = $('cursor'), trail = $('cursor-trail');
  if (!cursor || !trail) return;

  let mx = 0, my = 0, tx = 0, ty = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX; my = e.clientY;
    cursor.style.left = mx + 'px'; cursor.style.top = my + 'px';
  });

  const animTrail = () => {
    tx += (mx - tx) * 0.12; ty += (my - ty) * 0.12;
    trail.style.left = tx + 'px'; trail.style.top = ty + 'px';
    requestAnimationFrame(animTrail);
  };
  animTrail();

  document.querySelectorAll('a, button, .vote-btn').forEach(el => {
    el.addEventListener('mouseenter', () => { cursor.classList.add('hovering'); trail.classList.add('hovering'); });
    el.addEventListener('mouseleave', () => { cursor.classList.remove('hovering'); trail.classList.remove('hovering'); });
  });
}

// ─── INIT ───
async function init() {
  loadMyVotes();
  initCursor();

  // Show loading
  const list = $('beef-list');
  if (list) list.innerHTML = '<div class="loading-state"><div class="loading-bar"></div><p>Loading beefs...</p></div>';

  try {
    [beefs, votes] = await Promise.all([fetchBeefs(), fetchVotes()]);
  } catch (e) {
    console.error('init error:', e);
    if (list) list.innerHTML = '<div class="loading-state"><p>Failed to load. Check your Supabase config.</p></div>';
    return;
  }

  renderBeefs();
  updateScoreboard();
  subscribeToVotes();
}

document.addEventListener('DOMContentLoaded', init);
