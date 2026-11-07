/* Куда сходим — Telegram Mini App (без сборки, чистый JS) */

const tg = window.Telegram?.WebApp;
const DEV = new URLSearchParams(location.search).get('dev'); // локально: ?dev=1:Аня
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
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  joker: '<rect x="4" y="2" width="16" height="20" rx="2"/><path d="m12 7 1.5 3 3 .4-2.2 2.1.6 3L12 14l-2.9 1.5.6-3-2.2-2.1 3-.4z"/>',
  refresh: '<path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M8 16H3v5"/>',
};
const icon = (name) => `<svg class="i" viewBox="0 0 24 24" aria-hidden="true">${P[name]}</svg>`;

/* ---------------- тема ---------------- */

function currentTheme() {
  try {
    return localStorage.getItem('theme') || 'dark';
  } catch {
    return 'dark';
  }
}

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
  try {
    localStorage.setItem('theme', theme);
  } catch { /* приватный режим */ }
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
  toastTimer = setTimeout(() => (t.hidden = true), 2800);
}

/** Выполнить действие и показать ошибку тостом. Возвращает true при успехе. */
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
};

const head = (label, title, sub = '', settings = false) =>
  `<div class="head"><div><div class="label">${label}</div><h1>${title}</h1>${sub ? `<div class="hint sub">${sub}</div>` : ''}</div>
   ${settings ? `<button class="icon-btn" data-act="go" data-to="#/settings" aria-label="Настройки">${icon('sliders')}</button>` : ''}</div>`;

const ava = (u) =>
  `<span class="ava" style="--h:${hue(u?.id || 0)}">${u?.photo ? `<img src="${esc(u.photo)}" alt="">` : esc((u?.name || '?')[0].toUpperCase())}</span>`;

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

function facts(c) {
  const f = [[icon('wallet'), BUDGET[c.budget]], [icon('clock'), DURATION[c.duration]]];
  if (c.area) f.push([icon('pin'), esc(c.area)]);
  if (c.fixed_at) f.push([icon('calendar'), `${dayLabel(c.fixed_at.slice(0, 10), true)}, ${c.fixed_at.slice(11)}`]);
  else if (c.available_until) f.push([icon('hourglass'), `до ${dayLabel(c.available_until, true)}`]);
  if (c.outdoor) f.push([icon('sun'), 'На улице']);
  if (c.needs_booking) f.push([icon('ticket'), 'Нужна бронь']);
  return `<div class="facts">${f.map(([i, t]) => `<span>${i}${t}</span>`).join('')}</div>`;
}

const media = (c) =>
  c.photo ? `<img src="${esc(c.photo)}" alt="" loading="lazy">` : `<div class="ph" style="--h:${hue(c.id)}">${esc((c.title || '?')[0].toUpperCase())}</div>`;

const people = (list) =>
  `<div class="people">${list
    .map((p) => `<span class="person ${p.done ? 'done' : ''} ${p.pass ? 'pass' : ''}">${ava(p.user)}${esc(p.user.name)}${p.pass ? ' · пропускает' : ''}<i class="st"></i></span>`)
    .join('')}</div>`;

function partialsHtml(partials, title) {
  if (!partials?.length) return '';
  return `<div class="panel"><h3>${title}</h3><p class="hint">Можно сходить своим составом — договоритесь между собой.</p>
    ${partials
      .map((p) => `<div class="list-row"><div class="grow"><b>${esc(p.card.title)}</b><div class="hint">${p.count} из ${p.of}: ${p.likedBy.map((u) => esc(u.name)).join(', ')}</div></div>
        ${p.card.link ? `<button class="icon-btn" data-act="open" data-url="${esc(p.card.link)}" aria-label="Открыть ссылку">${icon('external')}</button>` : ''}</div>`)
      .join('')}</div>`;
}

function cardBlock(c, { interactive = false, badges = '' } = {}) {
  return `<div class="swipe" ${interactive ? 'id="swipe"' : ''}>
    <div class="media">${media(c)}${badges}</div>
    ${interactive ? '<span class="stamp yes">Можно</span><span class="stamp no">Нет</span><span class="stamp fire">Очень хочу</span>' : ''}
    <div class="body">
      <h3>${esc(c.title)}</h3>
      <div>${tagsHtml(c.tags)}</div>
      ${facts(c)}
      ${c.why ? `<p class="why">${esc(c.why)}</p>` : ''}
      <div class="author">${ava(c.author)}Предложила ${esc(c.author?.name)}</div>
      ${c.link ? `<button class="textbtn" data-act="open" data-url="${esc(c.link)}" style="justify-content:flex-start;padding:12px 0 0">${icon('external')}Открыть ссылку</button>` : ''}
    </div>
  </div>`;
}

/* ---------------- роутер ---------------- */

const routes = [
  [/^$/, () => renderWeek(), 'week'],
  [/^intro$/, () => renderIntro(), 'week'],
  [/^settings$/, () => renderSettings(), 'week'],
  [/^cards$/, () => renderCards(), 'cards'],
  [/^card\/new$/, () => renderEditor(null), 'cards'],
  [/^card\/(\d+)\/edit$/, (m) => renderEditor(Number(m[1])), 'cards'],
  [/^card\/(\d+)$/, (m) => renderCard(Number(m[1])), 'cards'],
  [/^memories$/, () => renderMemories(), 'memories'],
];

function seenIntro() {
  try {
    return !!localStorage.getItem('intro-seen');
  } catch {
    return true;
  }
}

async function route() {
  const hash = location.hash.replace(/^#\/?/, '');
  if (!ME.member) {
    tabs.hidden = true;
    return renderJoin();
  }
  tabs.hidden = false;
  if (hash === '' && !seenIntro()) return renderIntro();
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
    view(`<div class="empty">${icon('refresh')}<p>${esc(e.message)}</p><button class="btn soft" data-act="retry">Попробовать ещё раз</button></div>`, {
      retry: () => route(),
    });
  }
}

/* ---------------- вход и онбординг ---------------- */

function renderJoin() {
  view(
    `${head('Добро пожаловать', `Привет, ${esc(ME.user.name)}!`)}
    <p>Здесь подруги вместе выбирают, куда сходить: собирают идеи, раз в неделю голосуют, а приложение подбирает активность и время, удобное всем.</p>
    <label class="field"><span class="label">Код приглашения</span><input id="code" autocomplete="off" placeholder="Его знают подруги"></label>
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

function renderIntro() {
  tabs.hidden = false;
  const steps = [
    ['bulb', 'Собираем идеи', 'Каждая добавляет места и события, куда хотелось бы сходить. Быстрее всего — прислать боту ссылку.'],
    ['heart', 'Голосуем раз в неделю', 'По субботам бот присылает приглашение. Отмечаешь несколько карточек: «очень хочу», «можно» или «нет». Если неделя занята — пропускаешь.'],
    ['shuffle', 'Приложение выбирает', 'Из того, что подошло всем, выбирается одна активность случайно. Если общего нет — покажем частичные совпадения и быстро довыберем.'],
    ['calendar', 'Подбираем время', 'Каждая отмечает, когда свободна. Видно, какое время подходит всем, — бронируете, и всем приходит событие для календаря.'],
    ['camera', 'Сохраняем впечатления', 'После встречи — оценки и фото во вкладке «Были».'],
  ];
  view(
    `${head('Как это работает', 'Пять шагов')}
    <div class="panel intro steps">${steps.map(([i, t, d]) => `<div class="step"><span class="dot">${icon(i)}</span><div class="grow"><b>${t}</b><span class="hint">${d}</span></div></div>`).join('')}</div>
    <div class="note">${icon('joker')} Раз в месяц у каждой есть <b>джокер</b>: если поставить его на карточку и никто не скажет «нет», она выбирается без жребия.</div>
    <button class="btn" data-act="ok">Понятно</button>`,
    {
      ok: () => {
        try {
          localStorage.setItem('intro-seen', '1');
        } catch { /* ничего */ }
        if (location.hash.replace(/^#\/?/, '') === 'intro') location.hash = '#/';
        else route();
      },
    },
  );
}

/* ---------------- неделя ---------------- */

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
  const cadence = STATE.cadence === 'weekly' ? 'каждую субботу' : 'по субботам, если вы не виделись больше недели';
  const setup = n < 2 || cards < 5;
  view(
    `${head('Неделя', `Привет, ${esc(ME.user.name)}`, '', true)}
    <div class="stat">
      <div class="num">${d === null ? '—' : d}</div>
      <div class="cap">${d === null ? 'встреч пока не было' : `${plural(d, 'день', 'дня', 'дней')} без встречи`}</div>
      ${STATE.nextMeeting ? `<p style="margin-top:12px">Следующая встреча: <b>${esc(STATE.nextMeeting.human)}</b></p>` : ''}
    </div>
    ${setup ? `<div class="panel"><h3>С чего начать</h3><div class="steps">
      <div class="step ${n >= 2 ? 'done' : ''}"><span class="dot">${n >= 2 ? icon('check') : 1}</span><div class="grow"><b>Позовите подруг</b><span class="hint">Сейчас в компании ${n}. Пусть откроют бота и пришлют код приглашения.</span></div></div>
      <div class="step ${cards >= 5 ? 'done' : ''}"><span class="dot">${cards >= 5 ? icon('check') : 2}</span><div class="grow"><b>Добавьте идеи</b><span class="hint">Сейчас ${cards}. Чтобы выбор был интересным, нужно хотя бы 5–10.</span>
        ${cards < 5 ? `<button class="textbtn" data-act="go" data-to="#/card/new" style="justify-content:flex-start;padding:8px 0 0">${icon('plus')}Добавить идею</button>` : ''}</div></div>
      <div class="step"><span class="dot">3</span><div class="grow"><b>Начните голосование</b><span class="hint">Кнопкой ниже или дождитесь субботы.</span></div></div>
    </div></div>` : ''}
    <p class="hint" style="margin:14px 2px">Бот сам присылает приглашение проголосовать ${cadence}. Можно начать и сейчас.</p>
    <button class="btn" data-act="start">${icon('shuffle')}Начать голосование</button>`,
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
  const top = `${head(stage2 ? 'Довыбор' : 'Голосование', stage2 ? 'Найдём то, что подойдёт всем' : 'Куда идём на этой неделе?', `До ${fmtTs(r.deadline)}`, true)}
    ${people(r.progress)}
    ${stage2 ? `<div class="note">Полного совпадения пока нет. Посмотри карточки, которые понравились подругам, — так быстрее найдём общий вариант.</div>${partialsHtml(r.partials, 'Совпало у части из вас')}` : ''}`;

  if (r.me.pass) {
    return view(
      `${top}<div class="panel" style="text-align:center;padding:28px 18px">${icon('moon')}<h3 style="margin-top:10px">Ты пропускаешь эту неделю</h3>
        <p class="hint">Подруги выберут без тебя. Время ты всё равно сможешь отметить, если получится присоединиться.</p></div>
       <button class="btn soft" data-act="unpass">Всё-таки участвую</button>`,
      {
        unpass: () => act(async () => {
          await api('/api/round/mood', { method: 'POST', body: { moods: r.me.moods, pass: false } });
          renderWeek();
        }),
      },
    );
  }
  if (!r.me.moodSet && !stage2) return viewMood(top, r);
  if (r.me.done && !moreMode) {
    const waiting = r.progress.filter((p) => !p.done && !p.pass).map((p) => p.user.name);
    return view(
      `${top}<div class="panel" style="text-align:center;padding:28px 18px"><span style="color:var(--yes)">${icon('check')}</span><h3 style="margin-top:10px">Готово, твой голос учтён</h3>
        <p class="hint">${waiting.length ? `Ждём: ${waiting.map(esc).join(', ')}. Когда все отметятся, бот выберет активность и пришлёт уведомление.` : 'Подводим итоги…'}</p></div>
       <button class="textbtn" data-act="more">Посмотреть ещё карточки</button>`,
      { more: () => { moreMode = true; renderWeek(); } },
    );
  }
  return viewDeck(top, r);
}

function viewMood(top, r) {
  const sel = new Set(r.me.moods);
  view(
    `${top}
    <h2>Чего хочется на этой неделе?</h2>
    <p class="hint" style="margin-bottom:14px">Выбери одно или несколько — карточки подстроятся. Можно ничего не выбирать.</p>
    <div class="chips">${Object.entries(DICT.moods).map(([k, v]) => `<button class="chip ${sel.has(k) ? 'on' : ''}" data-act="mood" data-k="${k}">${esc(v)}</button>`).join('')}</div>
    <div class="stack" style="margin-top:24px">
      <button class="btn" data-act="go-on">Смотреть карточки</button>
      <button class="textbtn muted" data-act="pass">${icon('moon')}Пропускаю эту неделю</button>
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

async function viewDeck(top, r) {
  const { next } = await api('/api/round/next');
  if (!next) {
    return view(
      `${top}<div class="empty">${icon('bulb')}<h3>Карточки закончились</h3>
        <p>${r.me.likes ? 'Ты посмотрела всё, что есть.' : 'Ничего не подошло? Добавь свою идею — она сразу попадёт в голосование.'}</p></div>
       <div class="stack"><button class="btn soft" data-act="go" data-to="#/card/new">${icon('plus')}Добавить идею</button>
       ${r.me.likes ? '<button class="btn" data-act="done">Готово</button>' : ''}</div>`,
      { done: doneVoting },
    );
  }
  const c = next.card;
  const target = STATE.likesTarget;
  const pct = Math.min(100, (r.me.likes / target) * 100);
  const badges =
    (next.likedBy.length ? `<span class="badge left">${icon('heart')}${next.likedBy.map((u) => esc(u.name)).join(', ')}</span>` : '') +
    (next.expiresInDays !== null ? `<span class="badge right">${icon('hourglass')}${next.expiresInDays <= 0 ? 'последний день' : `ещё ${next.expiresInDays} дн.`}</span>` : '');
  const joker =
    r.me.jokerCardId === c.id
      ? `<p class="hint" style="text-align:center">${icon('joker')} На этой карточке твой джокер</p>`
      : STATE.jokerAvailable && !r.me.jokerCardId
        ? `<button class="textbtn" data-act="joker">${icon('joker')}Джокер: хочу именно это</button>`
        : '';
  view(
    `${top}
    <div class="meter"><span>${r.stage === 2 ? `Карточек от подруг: ${next.finalistsLeft}` : `Отмечено: ${r.me.likes} из ${target}`}</span><span>${r.me.votes} просмотрено</span></div>
    ${r.stage === 1 ? `<div class="progress"><i style="width:${pct}%"></i></div>` : ''}
    <div class="deck">${cardBlock(c, { interactive: true, badges })}</div>
    <div class="votebar">
      <button class="vote no" data-act="v" data-v="-1"><span class="circle">${icon('x')}</span>Нет</button>
      <button class="vote yes" data-act="v" data-v="1"><span class="circle">${icon('check')}</span>Можно</button>
      <button class="vote fire" data-act="v" data-v="2"><span class="circle">${icon('flame')}</span>Очень хочу</button>
    </div>
    <p class="swipe-hint">Можно свайпать: вправо — можно, влево — нет, вверх — очень хочу</p>
    ${joker}
    ${r.me.likes >= 1 && !r.me.done ? '<button class="textbtn muted" data-act="done">Достаточно, закончить</button>' : ''}
    ${moreMode ? '<button class="textbtn muted" data-act="stop">Вернуться</button>' : ''}`,
    {
      v: (el) => castVote(c.id, Number(el.dataset.v)),
      done: doneVoting,
      stop: () => { moreMode = false; renderWeek(); },
      joker: async () => {
        if (!(await ask(`Поставить джокер на «${c.title}»? Если никто не скажет «нет», выберем её без жребия. Джокер — один раз в месяц.`))) return;
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
  haptic(value === 2 ? 'heavy' : 'light');
  const el = document.getElementById('swipe');
  if (el) {
    el.style.transform = value === -1 ? 'translateX(-130%) rotate(-14deg)' : value === 2 ? 'translateY(-120%)' : 'translateX(130%) rotate(14deg)';
    el.style.opacity = '0';
  }
  await act(() => api('/api/round/vote', { method: 'POST', body: { cardId, value } }));
  voting = false;
  const y = window.scrollY;
  await renderWeek().catch((e) => toast(e.message));
  window.scrollTo(0, Math.min(y, 200));
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
  let sx = 0, sy = 0, dx = 0, dy = 0, active = false;
  const stamps = { yes: el.querySelector('.stamp.yes'), no: el.querySelector('.stamp.no'), fire: el.querySelector('.stamp.fire') };
  el.addEventListener('pointerdown', (e) => {
    if (e.target.closest('button')) return;
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
  const end = () => {
    if (!active) return;
    active = false;
    el.classList.remove('dragging');
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
  try {
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, '1');
  } catch { /* без localStorage просто покажем ещё раз */ }
  const ov = document.createElement('div');
  ov.className = 'reveal';
  ov.innerHTML = '<div class="spinner"><i></i><i></i><i></i></div>';
  document.body.appendChild(ov);
  haptic('medium');
  setTimeout(() => {
    ov.innerHTML = `<div class="result"><div class="label">Выбрано</div><h1>${esc(r.card.title)}</h1><button class="btn" style="width:auto;padding:0 32px;margin:0 auto">Дальше</button></div>`;
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
      return `<div class="panel"><div class="label">Время фиксированное</div><h3 style="margin-top:6px">${dayLabel(s.fixed.slice(0, 10), true)}, ${s.fixed.slice(11)}</h3>
        <p class="hint">${wx(s.fixed.slice(0, 10))} · смогут ${n} из ${s.total}</p>
        <button class="btn ${on ? '' : 'soft'}" data-act="cell" data-k="${s.fixed}" style="margin-top:10px">${on ? `${icon('check')}Я смогу` : 'Я смогу'}</button></div>`;
    }
    if (!s.keys.length) return '<div class="panel">Свободных дат уже не осталось. Можно выбрать другую активность.</div>';
    return `<div class="grid-wrap"><table class="grid"><tr><th></th>${s.blocks.map((b) => `<th>${b.label}<small>${b.range}</small></th>`).join('')}</tr>
      ${s.days.map((d) => `<tr><td class="day ${isWeekend(d) ? 'we' : ''}">${dayLabel(d)}<small>${wx(d)}</small></td>${s.blocks.map((b) => {
        const k = `${d}@${b.h}`;
        if (!s.keys.includes(k)) return '<td></td>';
        const mine = sel.has(k);
        const n = (others[k] || 0) + (mine ? 1 : 0);
        return `<td><button class="cell ${mine ? 'mine' : ''} ${n === s.total ? 'full' : ''}" style="--heat:${n / s.total}" data-act="cell" data-k="${k}">${n || ''}</button></td>`;
      }).join('')}</tr>`).join('')}</table>
      <div class="legend"><span><i class="mine"></i>ты свободна</span><span><i class="full"></i>свободны все</span><span>цифра — сколько свободны</span></div></div>`;
  };

  const rankingHtml = () => {
    if (!s.ranking.length) return '';
    return `<h2>Лучшее время</h2><div class="panel">${s.ranking.map((x) => `<div class="list-row"><div class="grow"><b>${esc(x.human)}</b>
      <div class="hint">${x.count === s.total ? 'Свободны все' : `Свободны ${x.count} из ${s.total}`}: ${x.users.map((u) => esc(nameOf(u))).join(', ')}</div></div>
      <button class="btn small" data-act="book" data-k="${x.slot}">Бронируем</button></div>`).join('')}</div>`;
  };

  const draw = () =>
    view(
      `${head('Результат', esc(r.card.title), REASON[r.reason] + (r.reason === 'joker' && r.jokerBy ? ` Джокер: ${esc(r.jokerBy.name)}.` : ''), true)}
      ${cardBlock(r.card)}
      ${partialsHtml(r.partials, 'Ещё совпадения')}
      <h2>Когда ты свободна?</h2>
      <p class="hint" style="margin-bottom:12px">Отметь все варианты, когда можешь. ${r.me.slotsDone ? '' : '<b style="color:var(--text)">Ты ещё не отмечала.</b>'}</p>
      ${gridHtml()}
      <div class="savebar"><button class="btn" data-act="save" ${dirty || !r.me.slotsDone ? '' : 'disabled'}>${r.me.slotsDone ? (dirty ? 'Сохранить изменения' : 'Сохранено') : 'Сохранить'}</button></div>
      <h2>Кто отметил время</h2>${people(r.progress.map((p) => ({ ...p, done: p.slotsDone, pass: false })))}
      ${rankingHtml()}
      <button class="textbtn danger" data-act="reroll" style="margin-top:12px">${icon('refresh')}Это сейчас не подходит — выбрать другое</button>`,
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
          toast('Сохранено');
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
    `${head('Встреча назначена', esc(r.slotHuman), '', true)}
    ${info.length ? `<div class="facts" style="margin-top:-8px">${info.join('')}</div>` : ''}
    ${cardBlock(r.card)}
    <div class="note">Бот прислал каждой файл <b>vstrecha.ics</b> — открой его в чате, чтобы добавить встречу в календарь. Накануне придёт напоминание.</div>
    ${partialsHtml(r.partials, 'Ещё совпадения на будущее')}
    <button class="textbtn danger" data-act="unbook">Отменить бронь и выбрать другое время</button>`,
    {
      unbook: async () => {
        if (!(await ask('Отменить бронь? Всем придёт уведомление.'))) return;
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
  const { cards, drafts } = await api(`/api/cards?status=${cardsTab}`);
  const list = cardsFilter ? cards.filter((c) => c.tags.includes(cardsFilter)) : cards;
  view(
    `${head('Идеи', 'Куда хочется', cardsTab === 'active' ? `${cards.length} ${plural(cards.length, 'идея', 'идеи', 'идей')} в общем списке` : 'Места, где вы уже были')}
    <div class="seg">
      <button class="${cardsTab === 'active' ? 'on' : ''}" data-act="tab" data-v="active">Все идеи</button>
      <button class="${cardsTab === 'visited' ? 'on' : ''}" data-act="tab" data-v="visited">Уже были</button>
    </div>
    <div class="chips scroll" style="margin-top:12px">${Object.entries(DICT.tags).map(([k, v]) => `<button class="chip ${cardsFilter === k ? 'on' : ''}" data-act="filter" data-k="${k}">${esc(v)}</button>`).join('')}</div>
    ${drafts.length ? `<div class="panel"><h3>Твои черновики</h3><p class="hint">Допиши — и они попадут в общий список.</p>${drafts.map((d) => `<div class="list-row"><div class="grow">${esc(d.title || 'Без названия')}</div><button class="btn small soft" data-act="go" data-to="#/card/${d.id}/edit">Дописать</button></div>`).join('')}</div>` : ''}
    ${list.length ? `<div class="tiles">${list.map((c) => `<button class="tile" data-act="go" data-to="#/card/${c.id}">${media(c)}<div class="t">${esc(c.title)}<small>${BUDGET[c.budget]} · ${esc(c.author?.name)}</small></div></button>`).join('')}</div>`
      : `<div class="empty">${icon('bulb')}<p>${cardsTab === 'active' ? (cardsFilter ? 'В этой категории пока ничего нет.' : 'Пока пусто. Добавь первую идею — или пришли боту ссылку, он сам сделает карточку.') : 'Здесь появятся места, где вы уже были.'}</p></div>`}
    <p class="hint" style="text-align:center;margin-top:20px">${icon('link')} Чтобы быстро добавить идею, пришли боту ссылку</p>
    <button class="btn fab" data-act="go" data-to="#/card/new">${icon('plus')}Идея</button>`,
    {
      tab: (el) => { cardsTab = el.dataset.v; renderCards(); },
      filter: (el) => { cardsFilter = cardsFilter === el.dataset.k ? null : el.dataset.k; renderCards(); },
    },
  );
}

async function renderCard(id) {
  const { card: c } = await api(`/api/cards/${id}`);
  view(
    `<div style="height:8px"></div>${cardBlock(c)}
    <div class="stack" style="margin-top:14px">
      <button class="btn secondary" data-act="go" data-to="#/card/${c.id}/edit">Редактировать</button>
      ${c.status === 'visited' ? '<button class="btn" data-act="restore">Хотим ещё раз — вернуть в идеи</button>' : ''}
    </div>`,
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
  const f = { ...c, tags: new Set(c.tags), time_of_day: new Set(c.time_of_day) };
  const isMine = !id || c.author_id === ME.user.id;
  const photoInner = () => (f.photo ? `<img src="${esc(f.photo)}" alt="">` : `<span class="empty-ph">${icon('camera')}Добавить фото</span>`);

  const seg = (name, options, cur) =>
    `<div class="seg">${options.map(([v, label]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-act="seg" data-name="${name}" data-v="${v}">${label}</button>`).join('')}</div>`;

  view(
    `${head(c.status === 'draft' ? 'Черновик' : id ? 'Редактирование' : 'Новая идея', c.status === 'draft' ? 'Допиши карточку' : id ? esc(c.title) : 'Куда сходим?')}
    <label class="field"><span class="label">Ссылка</span><div class="row"><input id="link" class="grow" type="url" inputmode="url" placeholder="https://…" value="${esc(f.link)}"><button class="btn small soft" data-act="preview">Заполнить</button></div>
      <span class="hint" style="display:block;margin-top:6px">Вставь ссылку и нажми «Заполнить» — название и картинка подтянутся сами.</span></label>
    <div class="field"><span class="label">Фото</span><div class="photo-pick" id="photoBox"><span id="photoInner">${photoInner()}</span><input type="file" accept="image/*" id="photoInput"></div></div>
    <label class="field"><span class="label">Название *</span><input id="title" maxlength="140" placeholder="Например, иммерсивный спектакль" value="${esc(f.title)}"></label>
    <label class="field"><span class="label">Почему стоит сходить</span><textarea id="why" maxlength="1500" placeholder="Пара слов: что там интересного">${esc(f.why)}</textarea></label>
    <div class="field"><span class="label">Категория</span><div class="chips">${Object.entries(DICT.tags).map(([k, v]) => `<button class="chip ${f.tags.has(k) ? 'on' : ''}" data-act="tag" data-k="${k}">${esc(v)}</button>`).join('')}</div></div>
    <div class="field"><span class="label">Бюджет на человека</span>${seg('budget', BUDGET.map((b, i) => [i, b]), f.budget)}</div>
    <div class="field"><span class="label">Сколько займёт</span>${seg('duration', Object.entries(DURATION), f.duration)}</div>
    <div class="field"><span class="label">Когда подходит</span><div class="chips">${DICT.blocks.map((b) => `<button class="chip ${f.time_of_day.has(b.key) ? 'on' : ''}" data-act="tod" data-k="${b.key}">${b.label}, ${b.range}</button>`).join('')}</div>
      <span class="hint" style="display:block;margin-top:6px">Если ничего не выбрать — подходит любое время.</span></div>
    <label class="field"><span class="label">Где</span><input id="area" maxlength="120" placeholder="Район, адрес или метро" value="${esc(f.area)}"></label>
    <div class="panel flush">
      <label class="toggle"><span>На улице<small>Покажем прогноз погоды</small></span><input type="checkbox" class="switch" id="outdoor" ${f.outdoor ? 'checked' : ''}></label>
      <label class="toggle"><span>Нужна бронь или билеты<small>Бот назначит, кто бронирует</small></span><input type="checkbox" class="switch" id="needs_booking" ${f.needs_booking ? 'checked' : ''}></label>
    </div>
    <label class="field"><span class="label">Доступно до</span><input type="date" id="available_until" value="${esc(f.available_until || '')}">
      <span class="hint" style="display:block;margin-top:6px">Для выставок и сезонных мест: после этой даты карточка не будет предлагаться.</span></label>
    <label class="field"><span class="label">Точная дата и время</span><input type="datetime-local" id="fixed_at" value="${esc(f.fixed_at || '')}">
      <span class="hint" style="display:block;margin-top:6px">Для концертов и спектаклей с конкретным сеансом.</span></label>
    <div class="stack" style="margin:24px 0 8px">
      <button class="btn" data-act="save">${c.status === 'draft' ? 'Добавить в идеи' : 'Сохранить'}</button>
      ${id && isMine ? '<button class="textbtn danger" data-act="del">Удалить</button>' : ''}
    </div>`,
    {
      seg: (el) => {
        f[el.dataset.name] = el.dataset.name === 'budget' ? Number(el.dataset.v) : el.dataset.v;
        el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
        haptic();
      },
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
          if (p.image && !f.photo) {
            f.photo = p.image;
            document.getElementById('photoInner').innerHTML = photoInner();
          }
          toast(p.title || p.image ? 'Заполнено по ссылке' : 'Сайт не отдал данные — заполни вручную');
        }).finally(() => { el.disabled = false; el.textContent = 'Заполнить'; });
      },
      save: () => act(async () => {
        const v = (k) => document.getElementById(k).value;
        const body = {
          title: v('title'), why: v('why'), link: v('link'), area: v('area'), photo: f.photo,
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
        if (!(await ask('Удалить карточку?'))) return;
        act(async () => {
          await api(`/api/cards/${id}`, { method: 'DELETE' });
          location.hash = '#/cards';
        });
      },
    },
  );

  document.getElementById('photoInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const box = document.getElementById('photoBox');
    box.style.opacity = '.5';
    await act(async () => {
      const { path } = await uploadImage(file);
      f.photo = path;
      document.getElementById('photoInner').innerHTML = photoInner();
    });
    box.style.opacity = '';
  });
}

/* ---------------- воспоминания ---------------- */

async function renderMemories() {
  const { items } = await api('/api/memories');
  const starsRo = (n) => (n ? `<span style="color:var(--fire)">★</span> ${n.toFixed(1)}` : '');
  view(
    `${head('Были', 'Наши встречи')}
    ${items.length ? '' : `<div class="empty">${icon('camera')}<p>Здесь появятся ваши встречи: оценки, фото и впечатления.</p></div>`}
    ${items.map((m) => {
      const mine = m.notes.find((n) => n.user?.id === ME.user.id) || {};
      return `<div class="panel mem">
        ${m.card.photo ? `<img class="cover" src="${esc(m.card.photo)}" alt="">` : ''}
        <h3 style="margin-top:12px">${esc(m.card.title)}</h3>
        <p class="hint">${esc(m.human)} ${m.avg ? `· ${starsRo(m.avg)}` : ''}</p>
        ${m.photos.length ? `<div class="gallery">${m.photos.map((p) => `<img src="${esc(p.path)}" alt="" loading="lazy" data-act="open" data-url="${esc(location.origin + p.path)}">`).join('')}</div>` : ''}
        ${m.notes.filter((n) => (n.comment || n.rating) && n.user?.id !== ME.user.id).map((n) => `<div class="review"><div class="row">${ava(n.user)}<b class="grow">${esc(n.user?.name)}</b>${n.rating ? `<span style="color:var(--fire)">${'★'.repeat(n.rating)}</span>` : ''}</div>${esc(n.comment)}</div>`).join('')}
        <div class="label" style="margin-top:14px">Твоя оценка</div>
        <div class="stars" data-round="${m.roundId}" data-rating="${mine.rating || 0}">${[1, 2, 3, 4, 5].map((i) => `<button class="${i <= (mine.rating || 0) ? 'on' : ''}" data-act="star" data-r="${i}" aria-label="${i}">${icon('star')}</button>`).join('')}</div>
        <textarea id="c-${m.roundId}" placeholder="Что запомнилось?">${esc(mine.comment || '')}</textarea>
        <div class="row" style="margin-top:10px">
          <button class="btn small" data-act="saveMem" data-round="${m.roundId}">Сохранить</button>
          <label class="btn small secondary" style="position:relative">${icon('camera')}Добавить фото<input type="file" accept="image/*" multiple data-round="${m.roundId}" class="memPhoto" style="position:absolute;inset:0;opacity:0"></label>
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
  let cadence = STATE.cadence;
  view(
    `${head('Настройки', 'Профиль и компания')}
    <div class="field"><span class="label">Оформление</span>
      <div class="seg">${THEMES.map(([k, v]) => `<button class="${currentTheme() === k ? 'on' : ''}" data-act="theme" data-v="${k}">${v}</button>`).join('')}</div></div>
    <label class="field"><span class="label">Как тебя называть</span><input id="name" maxlength="40" value="${esc(ME.user.name)}"></label>
    <div class="field"><span class="label">Как часто голосуем</span>
      <div class="seg"><button class="${cadence === 'weekly' ? 'on' : ''}" data-act="cad" data-v="weekly">Каждую неделю</button><button class="${cadence === 'biweekly' ? 'on' : ''}" data-act="cad" data-v="biweekly">Раз в две недели</button></div>
      <span class="hint" style="display:block;margin-top:6px">Общая настройка для всех. «Раз в две недели» — бот позовёт в субботу, если вы не виделись больше 8 дней.</span></div>
    <div class="panel"><h3>В компании — ${STATE.members.length}</h3>${people(STATE.members.map((u) => ({ user: u })))}<p class="hint">Чтобы добавить подругу: пусть откроет бота и пришлёт код приглашения.</p></div>
    <button class="btn" data-act="save">Сохранить</button>
    <button class="textbtn" data-act="go" data-to="#/intro" style="margin-top:8px">Как это работает</button>`,
    {
      theme: (el) => {
        applyTheme(el.dataset.v);
        el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
        haptic();
      },
      cad: (el) => {
        cadence = el.dataset.v;
        el.parentElement.querySelectorAll('button').forEach((b) => b.classList.toggle('on', b === el));
      },
      save: () => act(async () => {
        const name = document.getElementById('name').value.trim();
        await api('/api/me', { method: 'PUT', body: { name } });
        await api('/api/settings', { method: 'PUT', body: { cadence } });
        if (name) ME.user.name = name;
        success();
        location.hash = '#/';
      }),
    },
  );
}

/* ---------------- старт ---------------- */

async function init() {
  applyTheme(currentTheme());
  tg?.onEvent?.('themeChanged', syncTelegramColors);
  tabs.innerHTML = [['#/', 'week', 'shuffle', 'Неделя'], ['#/cards', 'cards', 'bulb', 'Идеи'], ['#/memories', 'memories', 'camera', 'Были']]
    .map(([href, tab, ic, label]) => `<a href="${href}" data-tab="${tab}">${icon(ic)}${label}</a>`)
    .join('');

  if (!tg?.initData && !DEV) {
    app.innerHTML = `<div class="empty">${icon('heart')}<h3>Открой через Telegram</h3><p>Это мини-приложение — запусти его кнопкой «Открыть» в чате с ботом.</p></div>`;
    return;
  }
  try {
    ME = await api('/api/me');
  } catch (e) {
    app.innerHTML = `<div class="empty"><p>${esc(e.message)}</p></div>`;
    return;
  }
  DICT = ME.dict;
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
