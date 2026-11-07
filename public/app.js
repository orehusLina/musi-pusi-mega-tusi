/* Куда сходим — Telegram Mini App (без сборки, чистый JS) */

const tg = window.Telegram?.WebApp;
const DEV = new URLSearchParams(location.search).get('dev'); // локально: ?dev=1:Алина
if (tg) {
  tg.ready();
  tg.expand();
}

const app = document.getElementById('app');
const tabs = document.getElementById('tabs');

const BUDGET = ['Бесплатно', 'До 1000 ₽', '1000–3000 ₽', 'От 3000 ₽'];
const DURATION = { short: '1–2 часа', half: 'Полдня', day: 'Весь день' };
const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MON = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const THEMES = [['dark', 'Тёмная'], ['light', 'Светлая'], ['tg', 'Как в Telegram']];

let ME = null;
let DICT = null;
let STATE = null;
let moreMode = false;
let cardsTab = 'active';
let cardsFilter = null;

/* ---------------- иконки ---------------- */

const P = {
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  shuffle: '<path d="M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22"/><path d="m18 2 4 4-4 4"/><path d="M2 6h1.9c1.5 0 2.9.9 3.6 2.2"/><path d="M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8"/><path d="m18 14 4 4-4 4"/>',
  home: '<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  bulb: '<path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/><path d="M9 18h6"/><path d="M10 22h4"/>',
  camera: '<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  sliders: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  wallet: '<rect x="2" y="6" width="20" height="14" rx="2"/><path d="M16 13h2M2 10h20M6 6V4h12v2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"/>',
  ticket: '<path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/><path d="M13 5v2M13 17v2M13 11v2"/>',
  hourglass: '<path d="M5 22h14M5 2h14M17 22v-4.2a2 2 0 0 0-.6-1.4L12 12l-4.4 4.4a2 2 0 0 0-.6 1.4V22M7 2v4.2a2 2 0 0 0 .6 1.4L12 12l4.4-4.4a2 2 0 0 0 .6-1.4V2"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7Z"/>',
  moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
  star: '<path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  joker: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="m12 7 1.5 3 3 .4-2.2 2.1.6 3L12 14l-2.9 1.5.6-3-2.2-2.1 3-.4z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M8 16H3v5"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4Z"/>',
};
const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;

/* ---------------- хранилище и тема ---------------- */

const store = {
  get(k, d = null) {
    try {
      return localStorage.getItem(k) ?? d;
    } catch {
      return d;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch { /* приватный режим */ }
  },
};

const currentTheme = () => store.get('theme', 'dark');

function rgbToHex(rgb) {
  const m = rgb.match(/\d+(\.\d+)?/g);
  if (!m) return null;
  return `#${m.slice(0, 3).map((n) => Math.round(Number(n)).toString(16).padStart(2, '0')).join('')}`;
}

function syncTelegramColors() {
  if (!tg) return;
  const bg = rgbToHex(getComputedStyle(document.body).backgroundColor);
  if (!bg) return;
  try {
    if (tg.isVersionAtLeast?.('6.9')) tg.setHeaderColor(bg);
    if (tg.isVersionAtLeast?.('6.1')) tg.setBackgroundColor(bg);
    if (tg.isVersionAtLeast?.('7.10')) tg.setBottomBarColor(bg);
  } catch { /* старый клиент */ }
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  store.set('theme', theme);
  syncTelegramColors();
}

/* ---------------- утилиты ---------------- */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const haptic = (kind = 'light') => tg?.HapticFeedback?.impactOccurred?.(kind);
const success = () => tg?.HapticFeedback?.notificationOccurred?.('success');
const hue = (n) => (Number(n) * 47) % 360;

async function api(path, { method = 'GET', body, form } = {}) {
  const headers = {};
  if (tg?.initData) headers.authorization = `tma ${tg.initData}`;
  else if (DEV) {
    const [id, ...name] = DEV.split(':');
    headers.authorization = `dev ${id}:${encodeURIComponent(name.join(':'))}`;
  }
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(path, { method, headers, body: payload });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(j.error || 'Нет связи с сервером'), { status: res.status });
  return j;
}

let toastTimer;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 2600);
}

async function act(fn) {
  try {
    await fn();
    return true;
  } catch (e) {
    toast(e.message);
    return false;
  }
}

function ask(msg) {
  return new Promise((resolve) => {
    try {
      if (tg?.showConfirm && tg.isVersionAtLeast?.('6.2')) return tg.showConfirm(msg, resolve);
    } catch { /* старый клиент */ }
    resolve(window.confirm(msg));
  });
}

function openLink(url) {
  if (tg?.openLink) tg.openLink(url);
  else window.open(url, '_blank', 'noopener');
}

function view(html, handlers = {}) {
  app.innerHTML = html;
  queueMicrotask(bindGalleries);
  app.onclick = (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || !app.contains(el)) return;
    const h = handlers[el.dataset.act] || common[el.dataset.act];
    if (h) {
      e.preventDefault();
      h(el, e);
    }
  };
}
const common = {
  open: (el) => openLink(el.dataset.url),
  go: (el) => (location.hash = el.dataset.to),
  tipx: (el) => {
    store.set(`tip:${el.dataset.k}`, '1');
    el.closest('.note').remove();
  },
  lb: (el) => lightbox(JSON.parse(el.closest('[data-photos]').dataset.photos), Number(el.dataset.i || 0)),
};

/* ---------------- строительные блоки ---------------- */

const top = (title, action = '') => `<div class="top"><h1>${title}</h1>${action}</div>`;
const settingsBtn = `<button class="icon-btn" data-act="go" data-to="#/settings" aria-label="Настройки">${icon('sliders')}</button>`;

const initials = (name = '?') =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?';
const ava = (u, cls = '') =>
  `<span class="ava ${cls}" style="--h:${hue(u?.id || 0)}">${u?.photo ? `<img src="${esc(u.photo)}" alt="">` : esc(initials(u?.name))}</span>`;

const tagsHtml = (tags) => (tags || []).map((t) => `<span class="tag">${esc(DICT.tags[t] || t)}</span>`).join('');

function dayLabel(key, long = false) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return long ? `${WD[dt.getDay()]}, ${d} ${MON[m - 1]}` : `${WD[dt.getDay()]} ${d}`;
}
const isWeekend = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return [0, 6].includes(new Date(y, m - 1, d).getDay());
};
function fmtTs(ts) {
  const d = new Date(ts);
  return `${WD[d.getDay()]}, ${d.getDate()} ${MON[d.getMonth()]}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function plural(n, one, few, many) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}

function facts(c, short = false) {
  const f = [[icon('wallet'), BUDGET[c.budget]], [icon('clock'), DURATION[c.duration]]];
  if (c.area) f.push([icon('pin'), esc(c.area)]);
  if (!short) {
    if (c.fixed_at) f.push([icon('calendar'), `${dayLabel(c.fixed_at.slice(0, 10), true)}, ${c.fixed_at.slice(11)}`]);
    else if (c.available_until) f.push([icon('hourglass'), `до ${dayLabel(c.available_until, true)}`]);
    if (c.outdoor) f.push([icon('sun'), 'На улице']);
    if (c.needs_booking) f.push([icon('ticket'), 'Нужна бронь']);
  }
  return `<div class="facts">${f.map(([i, t]) => `<span>${i}${t}</span>`).join('')}</div>`;
}

const photosOf = (c) => (c.photos?.length ? c.photos : c.photo ? [c.photo] : []);
const media = (c) =>
  c.photo || c.photos?.length
    ? `<img src="${esc(photosOf(c)[0])}" alt="" loading="lazy">`
    : `<div class="ph" style="--h:${hue(c.id)}">${esc((c.title || '?')[0].toUpperCase())}</div>`;
const dots = (n, i = 0) => (n > 1 ? `<span class="dots">${Array.from({ length: n }, (_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</span>` : '');

/** Фото карточки: в колоде — листаются тапом по краям, в просмотре — свайпом; тап открывает на весь экран. */
function gallery(c, interactive) {
  const ph = photosOf(c);
  if (!ph.length) return media(c);
  const data = `data-photos="${esc(JSON.stringify(ph))}"`;
  if (interactive) return `<div class="flip" ${data} data-i="0"><img src="${esc(ph[0])}" alt="">${dots(ph.length)}</div>`;
  return `<div class="gal-wrap" ${data}><div class="gal">${ph.map((p, i) => `<img src="${esc(p)}" alt="" loading="lazy" data-act="lb" data-i="${i}">`).join('')}</div>${dots(ph.length)}</div>`;
}

function bindGalleries() {
  app.querySelectorAll('.gal-wrap').forEach((w) => {
    const g = w.querySelector('.gal');
    const ds = w.querySelectorAll('.dots i');
    if (!ds.length) return;
    g.addEventListener('scroll', () => {
      const i = Math.round(g.scrollLeft / g.clientWidth);
      ds.forEach((d, k) => d.classList.toggle('on', k === i));
    }, { passive: true });
  });
}

function lightbox(photos, start = 0) {
  const ov = document.createElement('div');
  ov.className = 'lb';
  ov.innerHTML = `<div class="lb-track">${photos.map((p) => `<img src="${esc(p)}" alt="">`).join('')}</div>
    <div class="lb-top"><span class="lb-count">${start + 1} / ${photos.length}</span><button class="lb-x" aria-label="Закрыть">${icon('x')}</button></div>`;
  document.body.appendChild(ov);
  const tr = ov.querySelector('.lb-track');
  requestAnimationFrame(() => (tr.scrollLeft = start * tr.clientWidth));
  tr.addEventListener('scroll', () => {
    ov.querySelector('.lb-count').textContent = `${Math.round(tr.scrollLeft / tr.clientWidth) + 1} / ${photos.length}`;
  }, { passive: true });
  ov.querySelector('.lb-x').onclick = () => ov.remove();
}

function cardFull(c, { interactive = false, badges = '', clamp = false } = {}) {
  return `<div class="card" ${interactive ? 'id="swipe"' : ''}>
    <div class="media">${gallery(c, interactive)}${badges}</div>
    ${interactive ? '<span class="stamp yes">Можно</span><span class="stamp no">Нет</span><span class="stamp fire">Очень хочу</span>' : ''}
    <div class="body">
      <h3>${esc(c.title)}</h3>
      <div>${tagsHtml(c.tags)}</div>
      ${facts(c)}
      ${c.why ? `<p class="why ${clamp ? 'clamp' : ''}">${esc(c.why)}</p>` : ''}
      <div class="foot">${ava(c.author)}<span>Предложила ${esc(c.author?.name)}</span>
        ${c.link ? `<button class="linkbtn" data-act="open" data-url="${esc(c.link)}">Ссылка ${icon('external')}</button>` : ''}</div>
    </div>
  </div>`;
}

const summary = (c) =>
  `<button class="summary" data-act="go" data-to="#/card/${c.id}" style="width:100%;text-align:left">
    <span class="thumb">${media(c)}</span>
    <span class="grow"><b>${esc(c.title)}</b>${facts(c, true)}</span>
  </button>`;

function crew(list, doneKey = 'done', verb = 'Отметились') {
  const done = list.filter((p) => p[doneKey]).length;
  const pass = list.filter((p) => p.pass).length;
  const active = list.length - pass;
  return `<div class="crew"><span class="stack-av">${list.map((p) => ava(p.user, p[doneKey] ? 'done' : p.pass ? 'pass' : '')).join('')}</span>
    <span>${verb} ${done} из ${active}${pass ? ` · ${pass} ${plural(pass, 'пропускает', 'пропускают', 'пропускают')}` : ''}</span></div>`;
}

const emptyCard = (ic, title, text, action = '') =>
  `<div class="empty-card"><div class="ic">${icon(ic)}</div><h3>${title}</h3><p>${text}</p>${action}</div>`;

const tip = (key, html) =>
  store.get(`tip:${key}`) ? '' : `<div class="note">${icon('info')}<span>${html}</span><button class="x" data-act="tipx" data-k="${key}" aria-label="Скрыть">${icon('x')}</button></div>`;

function partialsHtml(partials, title) {
  if (!partials?.length) return '';
  return `<div class="section-title">${title}</div><div class="panel" style="padding-top:6px;padding-bottom:6px">
    ${partials.map((p) => `<div class="list-row"><div class="grow"><b>${esc(p.card.title)}</b><div class="hint">${p.count} из ${p.of}: ${p.likedBy.map((u) => esc(u.name)).join(', ')}</div></div>
      ${p.card.link ? `<button class="icon-btn" data-act="open" data-url="${esc(p.card.link)}" aria-label="Открыть ссылку">${icon('external')}</button>` : ''}</div>`).join('')}
    <p class="hint" style="margin:4px 0 8px">Можно сходить своим составом — договоритесь между собой.</p></div>`;
}

/* ---------------- роутер ---------------- */

const routes = [
  [/^$/, () => renderWeek(), 'week'],
  [/^intro$/, () => renderIntro(true), 'week'],
  [/^settings$/, () => renderSettings(), 'week'],
  [/^cards$/, () => renderCards(), 'cards'],
  [/^card\/new$/, () => renderEditor(null), 'cards'],
  [/^card\/(\d+)\/edit$/, (m) => renderEditor(Number(m[1])), 'cards'],
  [/^card\/(\d+)$/, (m) => renderCard(Number(m[1])), 'cards'],
  [/^memories$/, () => renderMemories(), 'memories'],
];

function setTabs(show) {
  tabs.hidden = !show;
  document.body.classList.toggle('notabs', !show);
}

async function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!ME.member) {
    setTabs(false);
    return renderJoin();
  }
  if (hash === '' && !store.get('intro-seen')) {
    setTabs(false);
    return renderIntro(false);
  }
  setTabs(true);
  const [re, fn, tab] = routes.find(([r]) => r.test(hash)) || routes[0];
  tabs.querySelectorAll('a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  if (tg?.BackButton) {
    if (['', 'cards', 'memories'].includes(hash)) tg.BackButton.hide();
    else tg.BackButton.show();
  }
  window.scrollTo(0, 0);
  try {
    await fn(hash.match(re));
  } catch (e) {
    view(emptyCard('refresh', 'Не получилось загрузить', esc(e.message), '<button class="btn secondary" data-act="retry">Попробовать ещё раз</button>'), {
      retry: () => route(),
    });
  }
}

/* ---------------- вход и онбординг ---------------- */

function renderJoin() {
  view(
    `${top(`Привет, ${esc(ME.user.name)}!`)}
    <p class="sub">Здесь подруги вместе выбирают, куда сходить: собирают идеи, раз в неделю голосуют, а приложение подбирает активность и время, удобное всем.</p>
    <div class="panel"><label class="field"><span class="lbl">Код приглашения</span><input id="code" autocomplete="off" placeholder="Его знают подруги"></label></div>
    <button class="btn" data-act="join">Присоединиться</button>`,
    {
      join: () =>
        act(async () => {
          await api('/api/join', { method: 'POST', body: { code: document.getElementById('code').value } });
          ME.member = true;
          success();
          route();
        }),
    },
  );
}

function renderIntro(fromSettings) {
  const steps = [
    ['bulb', 'Собираем идеи', 'Каждая добавляет места и события. Быстрее всего — отправить боту ссылку в чат.'],
    ['heart', 'Голосуем раз в неделю', 'По субботам бот зовёт отметить несколько карточек: «очень хочу», «можно» или «нет». Занята — пропускаешь неделю.'],
    ['shuffle', 'Приложение выбирает', 'Из того, что подошло всем, одна активность выбирается случайно. Нет общего — быстро довыбираем.'],
    ['calendar', 'Подбираем время', 'Каждая отмечает, когда свободна, — видно время, удобное всем. Бронируете, и всем приходит событие для календаря.'],
    ['camera', 'Сохраняем впечатления', 'После встречи — оценки и фото во вкладке «Встречи».'],
  ];
  view(
    `${top('Как это работает')}
    <p class="sub">Пять шагов — и встречи организуются сами.</p>
    <div class="panel intro" style="padding-top:4px;padding-bottom:4px">${steps.map(([i, t, d]) => `<div class="step"><span class="dot">${icon(i)}</span><div class="grow"><b>${t}</b><span class="hint">${d}</span></div></div>`).join('')}</div>
    <div class="note">${icon('joker')}<span>Раз в месяц у каждой есть <b>джокер</b>: если поставить его на карточку и никто не скажет «нет», она выбирается без жребия.</span></div>
    <div class="actionbar"><button class="btn" data-act="ok">${fromSettings ? 'Понятно' : 'Начать'}</button></div>`,
    {
      ok: () => {
        store.set('intro-seen', '1');
        if (fromSettings) history.back();
        else route();
      },
    },
  );
}

/* ---------------- главная ---------------- */

async function renderWeek() {
  STATE = await api('/api/state');
  const r = STATE.round;
  if (!r) return viewIdle();
  if (r.status === 'voting' || r.status === 'extra') return viewVoting(r);
  if (r.status === 'scheduling') return viewScheduling(r);
  return viewBooked(r);
}

function viewIdle() {
  const d = STATE.daysSince;
  const n = STATE.members.length;
  const cards = STATE.cardsCount;
  const setup = n < 2 || cards < 5;
  const cadence = STATE.cadence === 'weekly' ? 'каждую субботу' : 'по субботам, если вы не виделись больше недели';
  const step = (done, num, title, text, extra = '') =>
    `<div class="step ${done ? 'done' : ''}"><span class="dot">${done ? icon('check') : num}</span><div class="grow"><b>${title}</b><span class="hint">${text}</span>${extra}</div></div>`;
  view(
    `${top(`Привет, ${esc(ME.user.name)}`, settingsBtn)}
    ${STATE.nextMeeting ? `<div class="hero"><div class="hint">Следующая встреча</div><h3 style="margin-top:4px">${esc(STATE.nextMeeting.human)}</h3></div>` : ''}
    ${d !== null ? `<div class="hero"><div class="big">${d}</div><div class="cap">${plural(d, 'день', 'дня', 'дней')} без встречи</div></div>` : ''}
    ${setup ? `<div class="section-title">С чего начать</div><div class="panel" style="padding-top:4px;padding-bottom:4px">
      ${step(n >= 2, 1, 'Позовите подруг', `Сейчас в компании ${n}. Пусть откроют бота и отправят код приглашения.`)}
      ${step(cards >= 5, 2, 'Добавьте идеи', `Сейчас ${cards}. Для интересного выбора нужно хотя бы 5–10.`, cards < 5 ? `<button class="btn small secondary" data-act="go" data-to="#/card/new" style="margin-top:10px">${icon('plus')}Добавить идею</button>` : '')}
      ${step(false, 3, 'Начните голосование', 'Кнопкой ниже — или дождитесь субботы.')}
    </div>` : ''}
    <div class="actionbar"><button class="btn" data-act="start">Начать голосование</button>
      <p class="hint" style="text-align:center;margin:8px 0 0">Бот сам зовёт голосовать ${cadence}</p></div>`,
    {
      start: () =>
        act(async () => {
          await api('/api/round/start', { method: 'POST' });
          success();
          moreMode = false;
          renderWeek();
        }),
    },
  );
}

async function viewVoting(r) {
  const stage2 = r.stage === 2;
  const head = `${top(stage2 ? 'Довыбор' : 'Голосование', settingsBtn)}
    <p class="sub">До ${fmtTs(r.deadline)}</p>
    ${crew(r.progress)}
    ${stage2 ? `<div class="note">${icon('info')}<span><b>Полного совпадения пока нет.</b> Оцени карточки, которые понравились подругам, — так быстрее найдём общий вариант.</span></div>` : ''}`;
  const partials = stage2 ? partialsHtml(r.partials, 'Совпало у части из вас') : '';

  if (r.me.pass) {
    return view(
      `${head}${emptyCard('moon', 'Ты пропускаешь эту неделю', 'Подруги выберут без тебя. Время ты всё равно сможешь отметить, если получится присоединиться.', '<button class="btn secondary" data-act="unpass">Всё-таки участвую</button>')}`,
      {
        unpass: () => act(async () => {
          await api('/api/round/mood', { method: 'POST', body: { moods: r.me.moods, pass: false } });
          renderWeek();
        }),
      },
    );
  }
  if (!r.me.moodSet && !stage2) return viewMood(head, r);
  if (r.me.done && !moreMode) {
    const waiting = r.progress.filter((p) => !p.done && !p.pass).map((p) => p.user.name);
    return view(
      `${head}${emptyCard('check', 'Твой голос учтён',
        waiting.length ? `Ждём: ${waiting.map(esc).join(', ')}. Когда все отметятся, бот выберет активность и пришлёт уведомление.` : 'Подводим итоги…',
        '<button class="btn secondary" data-act="more">Посмотреть ещё карточки</button>')}${partials}`,
      { more: () => { moreMode = true; renderWeek(); } },
    );
  }
  return viewDeck(head, partials, r);
}

function viewMood(head, r) {
  const sel = new Set(r.me.moods);
  view(
    `${head}
    <div class="section-title">Чего хочется на этой неделе?</div>
    <div class="chips">${Object.entries(DICT.moods).map(([k, v]) => `<button class="chip ${sel.has(k) ? 'on' : ''}" data-act="mood" data-k="${k}">${esc(v)}</button>`).join('')}</div>
    <p class="hint" style="margin-top:12px">Можно выбрать несколько или ничего — карточки просто подстроятся.</p>
    <div class="actionbar">
      <button class="btn" data-act="go-on">Смотреть карточки</button>
      <button class="textbtn" data-act="pass">${icon('moon')}На этой неделе пропускаю</button>
    </div>`,
    {
      mood: (el) => {
        const k = el.dataset.k;
        sel.has(k) ? sel.delete(k) : sel.add(k);
        el.classList.toggle('on');
        haptic();
      },
      'go-on': () => act(async () => {
        await api('/api/round/mood', { method: 'POST', body: { moods: [...sel], pass: false } });
        renderWeek();
      }),
      pass: async () => {
        if (!(await ask('Пропустить эту неделю? Подруги выберут без тебя.'))) return;
        act(async () => {
          await api('/api/round/mood', { method: 'POST', body: { moods: [...sel], pass: true } });
          renderWeek();
        });
      },
    },
  );
}

async function viewDeck(head, partials, r) {
  const { next } = await api('/api/round/next');
  if (!next) {
    return view(
      `${head}${emptyCard('bulb', 'Карточки закончились',
        r.me.likes ? 'Ты посмотрела всё, что есть.' : 'Ничего не подошло? Добавь свою идею — она сразу попадёт в голосование.',
        `<div class="stack"><button class="btn secondary" data-act="go" data-to="#/card/new">${icon('plus')}Добавить идею</button>${r.me.likes ? '<button class="btn" data-act="done">Готово</button>' : ''}</div>`)}${partials}`,
      { done: doneVoting },
    );
  }
  const c = next.card;
  const target = STATE.likesTarget;
  const badges =
    (next.likedBy.length ? `<span class="badge left">${icon('heart')}${next.likedBy.map((u) => esc(u.name)).join(', ')}</span>` : '') +
    (next.expiresInDays !== null ? `<span class="badge right">${icon('hourglass')}${next.expiresInDays <= 0 ? 'последний день' : `ещё ${next.expiresInDays} дн.`}</span>` : '');
  const seenSwipes = Number(store.get('swipes', '0'));
  const extras = [];
  if (r.me.jokerCardId === c.id) extras.push(`<span class="hint" style="padding:12px">${icon('joker')} Здесь твой джокер</span>`);
  else if (STATE.jokerAvailable && !r.me.jokerCardId) extras.push(`<button class="textbtn" data-act="joker">${icon('joker')}Джокер</button>`);
  if (r.me.likes >= 1 && !r.me.done) extras.push(`<button class="textbtn" data-act="done">${icon('check')}Закончить</button>`);
  if (moreMode) extras.push('<button class="textbtn" data-act="stop">Вернуться</button>');

  view(
    `${head}
    <div class="meter">${r.stage === 1
      ? `<span>Хочу: ${Math.min(r.me.likes, target)} из ${target}</span><span class="segs">${Array.from({ length: target }, (_, i) => `<i class="${i < r.me.likes ? 'on' : ''}"></i>`).join('')}</span>`
      : `<span>Карточек от подруг: ${next.finalistsLeft}</span>`}</div>
    <div class="deck">${cardFull(c, { interactive: true, badges, clamp: true })}</div>
    <div class="votebar">
      <button class="vote no" data-act="v" data-v="-1"><span class="circle">${icon('x')}</span>Нет</button>
      <button class="vote yes" data-act="v" data-v="1"><span class="circle">${icon('check')}</span>Можно</button>
      <button class="vote fire" data-act="v" data-v="2"><span class="circle">${icon('flame')}</span>Очень хочу</button>
    </div>
    ${seenSwipes < 3 ? '<p class="swipe-hint">Можно свайпать: вправо — можно, влево — нет, вверх — очень хочу</p>' : ''}
    ${extras.length ? `<div class="under">${extras.join('')}</div>` : ''}
    ${partials}`,
    {
      v: (el) => castVote(c.id, Number(el.dataset.v)),
      done: doneVoting,
      stop: () => { moreMode = false; renderWeek(); },
      joker: async () => {
        if (!(await ask(`Поставить джокер на «${c.title}»? Если никто не скажет «нет», она будет выбрана без жребия. Джокер — один раз в месяц.`))) return;
        act(async () => {
          await api('/api/round/joker', { method: 'POST', body: { cardId: c.id } });
          success();
          renderWeek();
        });
      },
    },
  );
  setupSwipe(document.getElementById('swipe'), (v) => castVote(c.id, v));
}

let voting = false;
async function castVote(cardId, value) {
  if (voting) return;
  voting = true;
  store.set('swipes', String(Number(store.get('swipes', '0')) + 1));
  haptic(value === 2 ? 'heavy' : 'light');
  const el = document.getElementById('swipe');
  if (el) {
    el.style.transform = value === -1 ? 'translateX(-130%) rotate(-14deg)' : value === 2 ? 'translateY(-120%)' : 'translateX(130%) rotate(14deg)';
    el.style.opacity = '0';
  }
  await act(() => api('/api/round/vote', { method: 'POST', body: { cardId, value } }));
  voting = false;
  await renderWeek().catch((e) => toast(e.message));
  window.scrollTo(0, 0);
}

function doneVoting() {
  act(async () => {
    await api('/api/round/done', { method: 'POST' });
    moreMode = false;
    success();
    renderWeek();
  });
}

function setupSwipe(el, onVote) {
  if (!el) return;
  let sx = 0, sy = 0, dx = 0, dy = 0, active = false, downTarget = null;
  const stamps = { yes: el.querySelector('.stamp.yes'), no: el.querySelector('.stamp.no'), fire: el.querySelector('.stamp.fire') };
  const flip = el.querySelector('.flip');
  // Тап по фото: левая треть — назад, правая — вперёд, середина — на весь экран
  const tapPhoto = (clientX) => {
    const ph = JSON.parse(flip.dataset.photos);
    let i = Number(flip.dataset.i);
    const r = flip.getBoundingClientRect();
    const x = (clientX - r.left) / r.width;
    if (ph.length > 1 && x < 0.33) i = (i - 1 + ph.length) % ph.length;
    else if (ph.length > 1 && x > 0.67) i = (i + 1) % ph.length;
    else return lightbox(ph, i);
    flip.dataset.i = i;
    flip.querySelector('img').src = ph[i];
    flip.querySelectorAll('.dots i').forEach((d, k) => d.classList.toggle('on', k === i));
    haptic();
  };
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
    downTarget = e.target;
    active = true;
    sx = e.clientX; sy = e.clientY; dx = dy = 0;
    el.classList.add('dragging');
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', (e) => {
    if (!active) return;
    dx = e.clientX - sx; dy = e.clientY - sy;
    el.style.transform = `translate(${dx}px, ${Math.min(0, dy)}px) rotate(${dx / 20}deg)`;
    stamps.yes.style.opacity = Math.max(0, dx / 100);
    stamps.no.style.opacity = Math.max(0, -dx / 100);
    stamps.fire.style.opacity = Math.abs(dx) < 60 ? Math.max(0, -dy / 100) : 0;
  });
  const end = (e) => {
    if (!active) return;
    active = false;
    el.classList.remove('dragging');
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6 && flip && flip.contains(downTarget) && e?.type === 'pointerup') {
      el.style.transform = '';
      return tapPhoto(e.clientX);
    }
    if (dx > 110) return onVote(1);
    if (dx < -110) return onVote(-1);
    if (dy < -120 && Math.abs(dx) < 60) return onVote(2);
    el.style.transform = '';
    Object.values(stamps).forEach((s) => (s.style.opacity = 0));
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/* ---------------- выбор времени ---------------- */

function showReveal(r) {
  const key = `revealed:${r.id}:${r.card.id}`;
  if (store.get(key)) return;
  store.set(key, '1');
  const ov = document.createElement('div');
  ov.className = 'reveal';
  ov.innerHTML = '<div class="spinner"><i></i><i></i><i></i></div>';
  document.body.appendChild(ov);
  haptic('medium');
  setTimeout(() => {
    ov.innerHTML = `<div class="result"><div class="hint">Выбрано</div><h1>${esc(r.card.title)}</h1><button class="btn" style="width:auto;padding:0 36px;margin:0 auto">Дальше</button></div>`;
    success();
    ov.onclick = () => ov.remove();
  }, 1400);
}

const REASON = {
  consensus: 'Подошло всем — выбрано случайно из общих совпадений.',
  best: 'Лучший вариант: никто не против.',
  joker: 'Выбрано по джокеру.',
};

function viewScheduling(r) {
  showReveal(r);
  const s = r.schedule;
  const sel = new Set(s.mine);
  const others = {};
  for (const [k, users] of Object.entries(s.counts)) others[k] = users.filter((u) => u !== ME.user.id).length;
  let dirty = false;

  const nameOf = (id) => STATE.members.find((m) => m.id === id)?.name || '?';
  const wx = (d) => {
    const w = s.weather?.[d];
    return w ? `${w.icon} ${w.tmax}°` : '';
  };

  const gridHtml = () => {
    if (s.fixed) {
      const on = sel.has(s.fixed);
      const n = (others[s.fixed] || 0) + (on ? 1 : 0);
      return `<div class="panel"><div class="hint">Время фиксированное</div><h3 style="margin-top:4px">${dayLabel(s.fixed.slice(0, 10), true)}, ${s.fixed.slice(11)}</h3>
        <p class="hint">${wx(s.fixed.slice(0, 10))} · смогут ${n} из ${s.total}</p>
        <button class="btn ${on ? '' : 'secondary'}" data-act="cell" data-k="${s.fixed}" style="margin-top:10px">${on ? `${icon('check')}Я смогу` : 'Я смогу'}</button></div>`;
    }
    if (!s.keys.length) return emptyCard('calendar', 'Свободных дат не осталось', 'Можно выбрать другую активность — кнопка внизу.');
    return `<div class="grid-wrap"><table class="grid"><tr><th></th>${s.blocks.map((b) => `<th>${b.label}<small>${b.range}</small></th>`).join('')}</tr>
      ${s.days.map((d) => `<tr><td class="day ${isWeekend(d) ? 'we' : ''}">${dayLabel(d)}<small>${wx(d)}</small></td>${s.blocks.map((b) => {
        const k = `${d}@${b.h}`;
        if (!s.keys.includes(k)) return '<td></td>';
        const mine = sel.has(k);
        const n = (others[k] || 0) + (mine ? 1 : 0);
        return `<td><button class="cell ${mine ? 'mine' : ''} ${n === s.total ? 'full' : ''}" style="--heat:${n / s.total}" data-act="cell" data-k="${k}">${n || ''}</button></td>`;
      }).join('')}</tr>`).join('')}</table>
      <div class="legend"><span><i class="mine"></i>ты свободна</span><span><i class="full"></i>свободны все</span><span>цифра — сколько могут</span></div></div>`;
  };

  const slotParts = (slot) => {
    const [d, t] = slot.split('@');
    const b = DICT.blocks.find((x) => x.h === t);
    return { day: dayLabel(d, true), time: b ? `${b.label}, ${b.range}` : t };
  };
  const rankingHtml = () => {
    const best = s.ranking.filter((x) => x.count >= Math.min(2, s.total));
    if (!best.length) return '';
    return `<div class="section-title">Лучшее время</div><div class="panel" style="padding-top:4px;padding-bottom:4px">${best.map((x) => {
      const { day, time } = slotParts(x.slot);
      const missing = STATE.members.filter((m) => !x.users.includes(m.id)).map((m) => esc(m.name));
      return `<div class="list-row"><div class="grow"><b>${day}</b><div class="hint">${time}</div>
        <div class="hint" style="color:${x.count === s.total ? 'var(--yes)' : 'var(--hint)'}">${x.count === s.total ? 'Свободны все' : `Не могут: ${missing.join(', ')}`}</div></div>
        <button class="btn small" data-act="book" data-k="${x.slot}">Бронируем</button></div>`;
    }).join('')}</div>`;
  };

  const draw = () =>
    view(
      `${top('Выбрано', settingsBtn)}
      ${summary(r.card)}
      <p class="hint" style="margin:0 2px">${REASON[r.reason]}${r.reason === 'joker' && r.jokerBy ? ` Джокер: ${esc(r.jokerBy.name)}.` : ''}</p>
      <div class="section-title">Когда ты свободна?</div>
      ${crew(r.progress.map((p) => ({ ...p, pass: false })), 'slotsDone', 'Отметили время')}
      ${gridHtml()}
      ${dirty || !r.me.slotsDone ? `<div class="actionbar"><button class="btn" data-act="save">${r.me.slotsDone ? 'Сохранить изменения' : 'Сохранить моё время'}</button></div>` : ''}
      ${rankingHtml()}
      ${partialsHtml(r.partials, 'Ещё совпало')}
      <button class="textbtn danger" data-act="reroll" style="margin-top:8px">${icon('refresh')}Не подходит — выбрать другое</button>`,
      {
        cell: (el) => {
          const k = el.dataset.k;
          sel.has(k) ? sel.delete(k) : sel.add(k);
          dirty = true;
          haptic();
          const y = window.scrollY;
          draw();
          window.scrollTo(0, y);
        },
        save: () => act(async () => {
          await api('/api/round/slots', { method: 'POST', body: { slots: [...sel] } });
          success();
          toast('Время сохранено');
          const y = window.scrollY;
          await renderWeek();
          window.scrollTo(0, y);
        }),
        book: async (el) => {
          if (dirty) await api('/api/round/slots', { method: 'POST', body: { slots: [...sel] } }).catch(() => {});
          const x = s.ranking.find((q) => q.slot === el.dataset.k);
          if (!(await ask(`Бронируем: ${x.human}? Всем придёт уведомление и событие для календаря.`))) return;
          act(async () => {
            await api('/api/round/book', { method: 'POST', body: { slot: x.slot } });
            success();
            renderWeek();
          });
        },
        reroll: async () => {
          if (!(await ask('Выбрать другую активность? Эта карточка выпадет из текущего голосования, и все быстро довыберут другую.'))) return;
          act(async () => {
            await api('/api/round/reroll', { method: 'POST' });
            moreMode = false;
            renderWeek();
          });
        },
      },
    );
  draw();
}

function viewBooked(r) {
  const date = r.slot.slice(0, 10);
  const w = r.schedule?.weather?.[date];
  const info = [];
  if (w) info.push(`<span>${icon('sun')}${w.tmax}°${w.rain !== null ? `, осадки ${w.rain}%` : ''}</span>`);
  if (r.booker) info.push(`<span>${icon('ticket')}Бронирует ${esc(r.booker.name)}</span>`);
  view(
    `${top('Встреча назначена', settingsBtn)}
    <div class="hero"><div class="hint">Когда</div><h3 style="font-size:22px;margin:4px 0 0">${esc(r.slotHuman)}</h3>
      ${info.length ? `<div class="facts" style="margin-bottom:0">${info.join('')}</div>` : ''}</div>
    ${summary(r.card)}
    <div class="note">${icon('calendar')}<span>Бот отправил каждой файл <b>vstrecha.ics</b> — нажми на него в чате, чтобы добавить встречу в календарь. Накануне придёт напоминание.</span></div>
    ${partialsHtml(r.partials, 'Ещё совпало — на будущее')}
    <button class="textbtn danger" data-act="unbook">Отменить бронь</button>`,
    {
      unbook: async () => {
        if (!(await ask('Отменить бронь и выбрать другое время? Всем придёт уведомление.'))) return;
        act(async () => {
          await api('/api/round/unbook', { method: 'POST' });
          renderWeek();
        });
      },
    },
  );
}

/* ---------------- идеи ---------------- */

async function renderCards() {
  const { cards, drafts, counts } = await api(`/api/cards?status=${cardsTab}`);
  if (cardsTab === 'visited' && !counts.visited) cardsTab = 'active';
  const list = cardsFilter ? cards.filter((c) => c.tags.includes(cardsFilter)) : cards;
  const addBtn = `<button class="btn small secondary" data-act="go" data-to="#/card/new">${icon('plus')}Добавить</button>`;
  const usedTags = new Set(cards.flatMap((c) => c.tags));
  const showFilters = cardsTab === 'active' && cards.length >= 6;
  const empty = cardsTab === 'active' && !cards.length;

  view(
    `${top('Идеи', empty ? '' : addBtn)}
    <p class="sub">${counts.active ? `${counts.active} ${plural(counts.active, 'идея', 'идеи', 'идей')} в общем списке` : 'Места и события, куда хочется сходить'}</p>
    ${counts.visited ? `<div class="seg"><button class="${cardsTab === 'active' ? 'on' : ''}" data-act="tab" data-v="active">Все</button><button class="${cardsTab === 'visited' ? 'on' : ''}" data-act="tab" data-v="visited">Уже были · ${counts.visited}</button></div>` : ''}
    ${!empty ? tip('botlink', 'Быстрый способ добавить идею — отправь боту ссылку в чат, он сам заполнит карточку.') : ''}
    ${showFilters ? `<div class="chips scroll">${Object.entries(DICT.tags).filter(([k]) => usedTags.has(k)).map(([k, v]) => `<button class="chip ${cardsFilter === k ? 'on' : ''}" data-act="filter" data-k="${k}">${esc(v)}</button>`).join('')}</div>` : ''}
    ${drafts.length ? `<div class="section-title">Твои черновики</div><div class="panel" style="padding-top:4px;padding-bottom:4px">${drafts.map((d) => `<div class="list-row"><div class="grow">${esc(d.title || 'Без названия')}</div><button class="btn small secondary" data-act="go" data-to="#/card/${d.id}/edit">Дописать</button></div>`).join('')}</div>` : ''}
    ${empty
      ? emptyCard('bulb', 'Пока нет ни одной идеи', 'Добавь место или событие, куда хочется сходить. Ещё можно просто отправить боту ссылку в чат — он сам создаст карточку.', '<button class="btn" data-act="go" data-to="#/card/new">Добавить идею</button>')
      : list.length
        ? `<div class="tiles">${list.map((c) => `<button class="tile" data-act="go" data-to="#/card/${c.id}">${media(c)}<div class="t">${esc(c.title)}<small>${BUDGET[c.budget]} · ${esc(c.author?.name)}</small></div></button>`).join('')}</div>`
        : `<p class="hint" style="text-align:center;margin:32px 0">${cardsTab === 'visited' ? 'Здесь появятся места, где вы уже были.' : 'В этой категории пока ничего нет.'}</p>`}`,
    {
      tab: (el) => { cardsTab = el.dataset.v; cardsFilter = null; renderCards(); },
      filter: (el) => { cardsFilter = cardsFilter === el.dataset.k ? null : el.dataset.k; renderCards(); },
    },
  );
}

async function renderCard(id) {
  const { card: c } = await api(`/api/cards/${id}`);
  view(
    `<div style="height:8px"></div>${cardFull(c)}
    <div class="actionbar"><div class="row">
      <button class="btn secondary" data-act="go" data-to="#/card/${c.id}/edit">${icon('edit')}Изменить</button>
      ${c.status === 'visited' ? '<button class="btn" data-act="restore">Хотим ещё раз</button>' : ''}
    </div></div>`,
    {
      restore: () => act(async () => {
        await api(`/api/cards/${c.id}/restore`, { method: 'POST' });
        toast('Карточка снова в общем списке');
        cardsTab = 'active';
        location.hash = '#/cards';
      }),
    },
  );
}

async function resizeImage(file, max = 1280) {
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement('canvas');
    c.width = Math.round(img.width * k);
    c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.85));
  } catch {
    return file;
  }
}

async function uploadImage(file, url = '/api/upload') {
  const blob = await resizeImage(file);
  const fd = new FormData();
  fd.append('file', blob, 'photo.jpg');
  return api(url, { method: 'POST', form: fd });
}

async function renderEditor(id) {
  const c = id
    ? (await api(`/api/cards/${id}`)).card
    : { title: '', why: '', link: '', photo: '', tags: [], budget: 1, duration: 'short', time_of_day: [], area: '', outdoor: false, needs_booking: false, available_until: null, fixed_at: null, status: 'new' };
  const f = { ...c, tags: new Set(c.tags), time_of_day: new Set(c.time_of_day), photos: [...photosOf(c)] };
  const isMine = !id || c.author_id === ME.user.id;
  const MAX_PHOTOS = 10;
  const stripHtml = () =>
    f.photos.map((p, i) => `<div class="pthumb" data-photos="${esc(JSON.stringify(f.photos))}">
        <img src="${esc(p)}" alt="" data-act="lb" data-i="${i}">
        ${i === 0 ? '<span class="pcover">Обложка</span>' : `<button class="pmake" data-act="pcover" data-i="${i}">Сделать обложкой</button>`}
        <button class="pdel" data-act="pdel" data-i="${i}" aria-label="Удалить фото">${icon('x')}</button>
      </div>`).join('') +
    (f.photos.length < MAX_PHOTOS ? `<label class="padd">${icon('plus')}<span>${f.photos.length ? 'Ещё' : 'Добавить фото'}</span><input type="file" accept="image/*" multiple id="photoInput"></label>` : '');
  const drawStrip = () => {
    document.getElementById('pstrip').innerHTML = stripHtml();
    const inp = document.getElementById('photoInput');
    if (!inp) return;
    inp.addEventListener('change', async () => {
      const files = [...inp.files].slice(0, MAX_PHOTOS - f.photos.length);
      if (!files.length) return;
      toast(files.length > 1 ? `Загружаю ${files.length} фото…` : 'Загружаю фото…');
      for (const file of files) await act(async () => f.photos.push((await uploadImage(file)).path));
      drawStrip();
    });
  };
  const one = (name, options, cur) =>
    `<div class="chips">${options.map(([v, label]) => `<button class="chip ${String(cur) === String(v) ? 'on' : ''}" data-act="one" data-name="${name}" data-v="${v}">${label}</button>`).join('')}</div>`;
  const many = (act, options, set) =>
    `<div class="chips">${options.map(([k, label]) => `<button class="chip ${set.has(k) ? 'on' : ''}" data-act="${act}" data-k="${k}">${esc(label)}</button>`).join('')}</div>`;

  view(
    `${top(c.status === 'draft' ? 'Допиши карточку' : id ? 'Изменить идею' : 'Новая идея')}
    <p class="sub">${c.status === 'draft' ? 'Бот заполнил то, что нашёл по ссылке. Проверь и добавь детали.' : 'Обязательно только название — остальное по желанию.'}</p>

    <div class="panel">
      <label class="field"><span class="lbl">Ссылка</span><div class="row"><input id="link" class="grow" type="url" inputmode="url" placeholder="https://…" value="${esc(f.link)}"><button class="btn small secondary" data-act="preview">Заполнить</button></div>
        <span class="help">Вставь ссылку и нажми «Заполнить» — название и картинка подтянутся.</span></label>
      <label class="field"><span class="lbl">Название</span><input id="title" maxlength="140" placeholder="Например, иммерсивный спектакль" value="${esc(f.title)}"></label>
      <label class="field"><span class="lbl">Почему стоит сходить</span><textarea id="why" maxlength="1500" placeholder="Пара слов: что там интересного">${esc(f.why)}</textarea></label>
      <div class="field"><span class="lbl">Фото</span><div class="pstrip" id="pstrip"></div><span class="help">До ${MAX_PHOTOS} фото. Первое — обложка. Нажми на фото, чтобы посмотреть.</span></div>
    </div>

    <div class="section-title">Подробнее</div>
    <div class="panel">
      <div class="field"><span class="lbl">Категория</span>${many('tag', Object.entries(DICT.tags), f.tags)}</div>
      <div class="field"><span class="lbl">Бюджет на человека</span>${one('budget', BUDGET.map((b, i) => [i, b]), f.budget)}</div>
      <div class="field"><span class="lbl">Сколько займёт</span>${one('duration', Object.entries(DURATION), f.duration)}</div>
      <label class="field"><span class="lbl">Где</span><input id="area" maxlength="120" placeholder="Район, адрес или метро" value="${esc(f.area)}"></label>
    </div>

    <div class="section-title">Когда</div>
    <div class="panel">
      <div class="field"><span class="lbl">Время суток</span>${many('tod', DICT.blocks.map((b) => [b.key, `${b.label}, ${b.range}`]), f.time_of_day)}<span class="help">Ничего не выбрано — подходит любое время.</span></div>
      <label class="field"><span class="lbl">Доступно до</span><input type="date" id="available_until" value="${esc(f.available_until || '')}"><span class="help">Для выставок и сезонных мест.</span></label>
      <label class="field"><span class="lbl">Точная дата и время</span><input type="datetime-local" id="fixed_at" value="${esc(f.fixed_at || '')}"><span class="help">Для концертов и спектаклей с конкретным сеансом.</span></label>
    </div>

    <div class="panel tight">
      <label class="toggle"><span>На улице<small>Покажем прогноз погоды</small></span><input type="checkbox" class="switch" id="outdoor" ${f.outdoor ? 'checked' : ''}></label>
      <label class="toggle"><span>Нужна бронь или билеты<small>Бот назначит, кто бронирует</small></span><input type="checkbox" class="switch" id="needs_booking" ${f.needs_booking ? 'checked' : ''}></label>
    </div>

    ${id && isMine ? '<button class="textbtn danger" data-act="del">Удалить идею</button>' : ''}
    <div class="actionbar"><button class="btn" data-act="save">${c.status === 'draft' ? 'Добавить в идеи' : 'Сохранить'}</button></div>`,
    {
      one: (el) => {
        f[el.dataset.name] = el.dataset.name === 'budget' ? Number(el.dataset.v) : el.dataset.v;
        el.parentElement.querySelectorAll('.chip').forEach((b) => b.classList.toggle('on', b === el));
        haptic();
      },
      pdel: (el) => { f.photos.splice(Number(el.dataset.i), 1); drawStrip(); haptic(); },
      pcover: (el) => { const [p] = f.photos.splice(Number(el.dataset.i), 1); f.photos.unshift(p); drawStrip(); haptic(); },
      tag: (el) => { const k = el.dataset.k; f.tags.has(k) ? f.tags.delete(k) : f.tags.add(k); el.classList.toggle('on'); haptic(); },
      tod: (el) => { const k = el.dataset.k; f.time_of_day.has(k) ? f.time_of_day.delete(k) : f.time_of_day.add(k); el.classList.toggle('on'); haptic(); },
      preview: (el) => {
        const url = document.getElementById('link').value.trim();
        if (!url) return toast('Сначала вставь ссылку');
        el.disabled = true;
        el.textContent = '…';
        act(async () => {
          const p = await api('/api/preview', { method: 'POST', body: { url: /^https?:/i.test(url) ? url : `https://${url}` } });
          const t = document.getElementById('title');
          const w = document.getElementById('why');
          if (p.title && !t.value) t.value = p.title;
          if (p.description && !w.value) w.value = p.description;
          if (p.image && f.photos.length < MAX_PHOTOS) {
            f.photos.push(p.image);
            drawStrip();
          }
          toast(p.title || p.image ? 'Заполнено по ссылке' : 'Сайт не отдал данные — заполни вручную');
        }).finally(() => { el.disabled = false; el.textContent = 'Заполнить'; });
      },
      save: () => act(async () => {
        const v = (k) => document.getElementById(k).value;
        if (!v('title').trim()) {
          document.getElementById('title').focus();
          throw new Error('Добавь название');
        }
        const body = {
          title: v('title'), why: v('why'), link: v('link'), area: v('area'), photos: f.photos,
          tags: [...f.tags], time_of_day: [...f.time_of_day], budget: f.budget, duration: f.duration,
          outdoor: document.getElementById('outdoor').checked, needs_booking: document.getElementById('needs_booking').checked,
          available_until: v('available_until') || null, fixed_at: v('fixed_at') || null,
        };
        const res = id ? await api(`/api/cards/${id}`, { method: 'PUT', body }) : await api('/api/cards', { method: 'POST', body });
        success();
        toast('Сохранено');
        location.replace(`#/card/${res.id}`);
      }),
      del: async () => {
        if (!(await ask('Удалить идею?'))) return;
        act(async () => {
          await api(`/api/cards/${id}`, { method: 'DELETE' });
          location.hash = '#/cards';
        });
      },
    },
  );

  drawStrip();
}

/* ---------------- встречи ---------------- */

async function renderMemories() {
  const { items } = await api('/api/memories');
  view(
    `${top('Встречи')}
    <p class="sub">${items.length ? `${items.length} ${plural(items.length, 'встреча', 'встречи', 'встреч')} вместе` : 'Оценки, фото и впечатления после каждой встречи'}</p>
    ${items.length ? '' : emptyCard('camera', 'Встреч пока не было', 'После первой встречи здесь можно будет поставить оценку, оставить пару слов и добавить фото.')}
    ${items.map((m) => {
      const mine = m.notes.find((n) => n.user?.id === ME.user.id) || {};
      const others = m.notes.filter((n) => (n.comment || n.rating) && n.user?.id !== ME.user.id);
      return `<div class="panel mem">
        ${m.card.photo ? `<img class="cover" src="${esc(m.card.photo)}" alt="">` : ''}
        <div class="row"><h3 class="grow">${esc(m.card.title)}</h3>${m.avg ? `<span class="hint"><span style="color:var(--fire)">★</span> ${m.avg.toFixed(1)}</span>` : ''}</div>
        <p class="hint" style="margin-top:0">${esc(m.human)}</p>
        ${m.photos.length ? `<div class="gallery" data-photos="${esc(JSON.stringify(m.photos.map((p) => p.path)))}">${m.photos.map((p, i) => `<img src="${esc(p.path)}" alt="" loading="lazy" data-act="lb" data-i="${i}">`).join('')}</div>` : ''}
        ${others.map((n) => `<div class="review"><div class="row">${ava(n.user)}<b class="grow">${esc(n.user?.name)}</b>${n.rating ? `<span style="color:var(--fire)">${'★'.repeat(n.rating)}</span>` : ''}</div>${esc(n.comment)}</div>`).join('')}
        <div class="review"><div class="hint">Твоя оценка</div>
          <div class="stars" data-round="${m.roundId}" data-rating="${mine.rating || 0}">${[1, 2, 3, 4, 5].map((i) => `<button class="${i <= (mine.rating || 0) ? 'on' : ''}" data-act="star" data-r="${i}" aria-label="${i}">${icon('star')}</button>`).join('')}</div>
          <textarea id="c-${m.roundId}" placeholder="Что запомнилось?">${esc(mine.comment || '')}</textarea>
          <div class="row" style="margin-top:10px">
            <label class="btn small secondary" style="position:relative">${icon('camera')}Фото<input type="file" accept="image/*" multiple data-round="${m.roundId}" class="memPhoto" style="position:absolute;inset:0;opacity:0"></label>
            <span class="grow"></span>
            <button class="btn small" data-act="saveMem" data-round="${m.roundId}">Сохранить</button>
          </div>
        </div>
      </div>`;
    }).join('')}`,
    {
      star: (el) => {
        const box = el.parentElement;
        box.dataset.rating = el.dataset.r;
        box.querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.r) <= Number(el.dataset.r)));
        haptic();
      },
      saveMem: (el) => act(async () => {
        const id = el.dataset.round;
        const rating = Number(app.querySelector(`.stars[data-round="${id}"]`).dataset.rating) || null;
        await api(`/api/memories/${id}`, { method: 'POST', body: { rating, comment: document.getElementById(`c-${id}`).value } });
        success();
        toast('Сохранено');
        renderMemories();
      }),
    },
  );
  app.querySelectorAll('.memPhoto').forEach((inp) =>
    inp.addEventListener('change', async () => {
      toast('Загружаю…');
      for (const file of inp.files) await act(() => uploadImage(file, `/api/memories/${inp.dataset.round}/photo`));
      renderMemories();
    }),
  );
}

/* ---------------- настройки ---------------- */

async function renderSettings() {
  if (!STATE) STATE = await api('/api/state');
  const seg = (act, options, cur) =>
    `<div class="seg" style="margin:0">${options.map(([k, v]) => `<button class="${cur === k ? 'on' : ''}" data-act="${act}" data-v="${k}">${v}</button>`).join('')}</div>`;
  view(
    `${top('Настройки')}
    <div class="section-title" style="margin-top:12px">Оформление</div>
    ${seg('theme', THEMES, currentTheme())}
    <div class="section-title">Профиль</div>
    <div class="panel"><label class="field"><span class="lbl">Как тебя называть</span><input id="name" maxlength="40" value="${esc(ME.user.name)}"></label></div>
    <div class="section-title">Как часто голосуем</div>
    ${seg('cad', [['weekly', 'Каждую неделю'], ['biweekly', 'Раз в две недели']], STATE.cadence)}
    <p class="hint" style="margin:8px 2px 0">Общая настройка для всех. «Раз в две недели» — бот позовёт в субботу, если вы не виделись больше 8 дней.</p>
    <div class="section-title">В компании — ${STATE.members.length}</div>
    <div class="panel"><div class="people" style="margin:0">${STATE.members.map((u) => `<span class="person">${ava(u)}${esc(u.name)}</span>`).join('')}</div>
      <p class="hint" style="margin:10px 0 0">Чтобы добавить подругу, пусть откроет бота и отправит код приглашения.</p></div>
    <button class="textbtn" data-act="go" data-to="#/intro" style="margin-top:6px">${icon('info')}Как это работает</button>`,
    {
      theme: (el) => {
        applyTheme(el.dataset.v);
        el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
        haptic();
      },
      cad: (el) => act(async () => {
        await api('/api/settings', { method: 'PUT', body: { cadence: el.dataset.v } });
        STATE.cadence = el.dataset.v;
        el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
        toast('Сохранено');
      }),
    },
  );
  document.getElementById('name').addEventListener('change', (e) =>
    act(async () => {
      const name = e.target.value.trim();
      if (!name) return;
      await api('/api/me', { method: 'PUT', body: { name } });
      ME.user.name = name;
      toast('Имя сохранено');
    }),
  );
}

/* ---------------- старт ---------------- */

async function init() {
  applyTheme(currentTheme());
  tg?.onEvent?.('themeChanged', syncTelegramColors);
  tabs.innerHTML = [['#/', 'week', 'home', 'Главная'], ['#/cards', 'cards', 'bulb', 'Идеи'], ['#/memories', 'memories', 'camera', 'Встречи']]
    .map(([href, tab, ic, label]) => `<a href="${href}" data-tab="${tab}">${icon(ic)}${label}</a>`)
    .join('');

  if (!tg?.initData && !DEV) {
    app.innerHTML = emptyCard('heart', 'Открой через Telegram', 'Это мини-приложение — запусти его кнопкой «Открыть» в чате с ботом.');
    return;
  }
  try {
    ME = await api('/api/me');
  } catch (e) {
    app.innerHTML = emptyCard('refresh', 'Не получилось загрузить', esc(e.message));
    return;
  }
  DICT = ME.dict;
  // Ссылки из бота ведут на экран через ?r=… (Telegram занимает #hash своими параметрами)
  const deep = new URLSearchParams(location.search).get('r');
  const keep = DEV ? `?dev=${encodeURIComponent(DEV)}` : '';
  if (deep) history.replaceState(null, '', `${location.pathname}${keep}#/${deep}`);
  else if (/tgWebApp/.test(location.hash)) history.replaceState(null, '', `${location.pathname}${keep}#/`);
  tg?.BackButton?.onClick(() => (history.length > 1 ? history.back() : (location.hash = '#/')));
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && location.hash.replace(/^#\/?/, '') === '' && !document.querySelector('.reveal') && !document.querySelector('.grid')) {
      renderWeek().catch(() => {});
    }
  });
  route();
}

init();
