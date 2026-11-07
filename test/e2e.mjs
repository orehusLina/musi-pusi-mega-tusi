// Сквозная проверка API: node test/e2e.mjs (сервер с DEV_AUTH=1, INVITE_CODE=test на BASE)
const BASE = process.env.BASE || 'http://localhost:3000';
const users = { alinaO: '1:Алина О.', alinaI: '2:Алина И.', olya: '3:Оля', polina: '4:Полина' };
let failures = 0;

async function call(who, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { authorization: `dev ${encodeURIComponent(users[who]).replace('%3A', ':')}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${who} ${method} ${path} -> ${res.status} ${j.error}`);
  return j;
}
const check = (cond, msg) => {
  console.log(cond ? '  ok ' : '  FAIL', msg);
  if (!cond) failures++;
};

// вход
for (const u of Object.keys(users)) {
  const me = await call(u, 'GET', '/api/me');
  check(me.member === false, `${u}: до кода не участница`);
  let rejected = false;
  try { await call(u, 'POST', '/api/join', { code: 'wrong' }); } catch { rejected = true; }
  check(rejected, `${u}: неверный код отклонён`);
  await call(u, 'POST', '/api/join', { code: 'test' });
}

// карточки
const mk = (who, title, extra = {}) => call(who, 'POST', '/api/cards', { title, why: 'потому что круто', tags: ['culture'], budget: 1, ...extra }).then((r) => r.id);
const A = await mk('alinaO', 'Выставка');
const B = await mk('alinaI', 'Караоке', { tags: ['party'], time_of_day: ['evening', 'night'] });
const C = await mk('olya', 'Скалодром', { tags: ['active'], needs_booking: true });
const D = await mk('polina', 'Пикник', { tags: ['nature'], outdoor: true, budget: 0 });
const E = await mk('alinaO', 'Мастер-класс по керамике', { tags: ['creative'], budget: 2 });
const cards = (await call('alinaO', 'GET', '/api/cards')).cards;
check(cards.length === 5, `создано 5 карточек (${cards.length})`);

// раунд
await call('alinaO', 'POST', '/api/round/start');
let st = await call('alinaI', 'GET', '/api/state');
check(st.round?.status === 'voting', 'раунд в статусе voting');
for (const u of Object.keys(users)) await call(u, 'POST', '/api/round/mood', { moods: ['cheap'], pass: false });

// голосуем так, чтобы полного совпадения не было: B нравится троим, Полина против A, C — двоим
const plan = {
  alinaO: { [A]: 2, [B]: 1, [C]: -1, [D]: -1, [E]: -1 },
  alinaI: { [A]: 1, [B]: 2, [C]: 1, [D]: -1, [E]: -1 },
  olya: { [B]: 1, [C]: 1, [A]: -1, [D]: -1, [E]: -1 },
  polina: { [D]: 2, [E]: 1, [A]: -1 }, // B и C Полина не видела
};
for (const [u, votes] of Object.entries(plan)) {
  for (const [card, v] of Object.entries(votes)) await call(u, 'POST', '/api/round/vote', { cardId: Number(card), value: v });
  try { await call(u, 'POST', '/api/round/done'); } catch (e) { /* уже done автоматически */ }
}
st = await call('alinaO', 'GET', '/api/state');
check(st.round.status === 'extra' && st.round.stage === 2, `нет совпадения -> довыбор (status=${st.round.status})`);
check(st.round.partials?.some((p) => p.card.id === B && p.count === 3), 'частичное совпадение: Караоке 3 из 4');

// довыбор: Лене показываются карточки, которые понравились другим
const nx = await call('polina', 'GET', '/api/round/next');
check([B].includes(nx.next?.card.id), `Полине в довыборе показана карточка подруг (${nx.next?.card.title})`);
check(nx.next.likedBy.length === 3, 'видно, кто её хочет');
await call('polina', 'POST', '/api/round/vote', { cardId: B, value: 1 });
st = await call('polina', 'GET', '/api/state');
// остальные должны тоже пройти довыбор (у них может не быть финалистов -> автоматически done при голосовании)
for (const u of ['alinaO', 'alinaI', 'olya']) {
  for (;;) {
    const s = await call(u, 'GET', '/api/state');
    if (s.round.status !== 'extra' || s.round.me.done) break;
    const n = await call(u, 'GET', '/api/round/next');
    if (!n.next) { await call(u, 'POST', '/api/round/done'); break; }
    await call(u, 'POST', '/api/round/vote', { cardId: n.next.card.id, value: 1 });
  }
}
st = await call('alinaO', 'GET', '/api/state');
check(st.round.status === 'scheduling', `после довыбора выбрана активность (status=${st.round.status}, card=${st.round.card?.title})`);
check(!!st.round.schedule?.keys?.length, `есть слоты (${st.round.schedule?.keys?.length})`);

// слоты: общий слот у всех + один у троих
const keys = st.round.schedule.keys;
const [s1, s2] = [keys[1], keys[2]];
await call('alinaO', 'POST', '/api/round/slots', { slots: [s1, s2] });
await call('alinaI', 'POST', '/api/round/slots', { slots: [s1, s2] });
await call('olya', 'POST', '/api/round/slots', { slots: [s1] });
await call('polina', 'POST', '/api/round/slots', { slots: [s1, s2, 'garbage'] });
st = await call('olya', 'GET', '/api/state');
check(st.round.schedule.ranking[0].slot === s1 && st.round.schedule.ranking[0].count === 4, `лучший слот — все 4 (${st.round.schedule.ranking[0].human})`);
check(!st.round.schedule.counts.garbage, 'мусорный слот отброшен');

await call('alinaI', 'POST', '/api/round/book', { slot: s1 });
st = await call('alinaO', 'GET', '/api/state');
check(st.round.status === 'booked' && st.round.slot === s1, `забронировано: ${st.round.slotHuman}`);
await call('alinaO', 'POST', '/api/round/unbook');
st = await call('alinaO', 'GET', '/api/state');
check(st.round.status === 'scheduling', 'бронь отменяется');
await call('alinaO', 'POST', '/api/round/book', { slot: s1 });

// перевыбор недоступен после брони
let blocked = false;
try { await call('alinaO', 'POST', '/api/round/reroll'); } catch { blocked = true; }
check(blocked, 'после брони перевыбрать нельзя');

// новый раунд не стартует, пока есть активный
const again = await call('polina', 'POST', '/api/round/start');
check(again.id === st.round.id, 'повторный старт возвращает текущий раунд');

// превью ссылки
const pv = await call('alinaO', 'POST', '/api/preview', { url: 'https://example.com' });
check(pv.title === 'Example Domain', `превью ссылки: "${pv.title}"`);
let ssrf = false;
const pv2 = await call('alinaO', 'POST', '/api/preview', { url: 'http://127.0.0.1:3000/health' });
ssrf = !pv2.title;
check(ssrf, 'локальные адреса не загружаются');

// загрузка картинки
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const fd = new FormData();
fd.append('file', new Blob([png], { type: 'image/png' }), 'a.png');
const up = await fetch(`${BASE}/api/upload`, { method: 'POST', headers: { authorization: 'dev 1:x' }, body: fd }).then((r) => r.json());
check(/^\/uploads\/.+\.webp$/.test(up.path || ''), `загрузка фото, сжато в WebP: ${up.path}`);
const img = await fetch(BASE + up.path);
check(img.ok && img.headers.get('content-type') === 'image/webp', 'фото отдаётся');
const multi = await call('olya', 'POST', '/api/cards', { title: 'С фото', photos: [up.path, up.path, '/etc/passwd'] });
const mc = (await call('olya', 'GET', `/api/cards/${multi.id}`)).card;
check(mc.photos.length === 1 && mc.photo === up.path, `несколько фото: дубли и чужие пути отброшены (${mc.photos.length})`);

// чужой без кода не видит данные
let forbidden = false;
try {
  users.stranger = '99:Чужая';
  await call('stranger', 'GET', '/api/state');
} catch { forbidden = true; }
check(forbidden, 'без кода приглашения API закрыт');

const html = await fetch(BASE + '/').then((r) => r.text());
check(html.includes('Куда сходим'), 'страница миниаппа отдаётся');

console.log(failures ? `\n${failures} проверок не прошло` : '\nвсё ок');
process.exit(failures ? 1 : 0);
