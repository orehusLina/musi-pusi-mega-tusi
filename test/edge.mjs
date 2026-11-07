// Крайние случаи, безопасность и целостность данных.
// Запуск внутри контейнера на ЧИСТОЙ базе: cd /app && BASE=http://localhost:3000 node test/edge.mjs
// Сервер должен быть запущен с DEV_AUTH=1, INVITE_CODE=test, BOT_TOKEN=<любой тестовый>.
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:3000';
const TOKEN = process.env.BOT_TOKEN || '';
const { db, all, get, run } = await import('/app/src/db.js');
const L = await import('/app/src/logic.js');
const { cfg } = await import('/app/src/config.js');
L.hooks.notify = () => {}; // этот процесс не шлёт уведомления

let failures = 0;
const check = (cond, msg) => {
  console.log(cond ? '  ok ' : '  FAIL', msg);
  if (!cond) failures++;
};
const section = (t) => console.log(`\n# ${t}`);

const devAuth = (id, name = `U${id}`) => `dev ${id}:${encodeURIComponent(name)}`;
async function raw(auth, method, p, body, headers = {}) {
  const res = await fetch(BASE + p, {
    method,
    headers: { ...(auth ? { authorization: auth } : {}), ...(body && !(body instanceof FormData) ? { 'content-type': 'application/json' } : {}), ...headers },
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, json: await res.json().catch(() => ({})) };
}
async function call(id, method, p, body) {
  const r = await raw(devAuth(id), method, p, body);
  if (r.status >= 400) throw Object.assign(new Error(`${id} ${method} ${p} -> ${r.status} ${r.json.error}`), { status: r.status });
  return r.json;
}
const status = async (id, method, p, body) => (await raw(devAuth(id), method, p, body)).status;

const A = 1, B = 2, C = 3, D = 4; // четыре подруги
for (const u of [A, B, C, D]) await call(u, 'POST', '/api/join', { code: 'test' });
const mk = (u, b) => call(u, 'POST', '/api/cards', { budget: 1, ...b }).then((r) => r.id);
// Досрочно закрыть текущий раунд: без выбранной карточки — «пропущен», с карточкой — «состоялся»
const endRound = () =>
  run(`UPDATE rounds SET
         status = CASE WHEN picked_card_id IS NULL THEN 'skipped' ELSE 'done' END,
         slot = CASE WHEN picked_card_id IS NULL THEN slot ELSE COALESCE(slot, '2020-01-01@17') END
       WHERE status IN ('voting','extra','scheduling','booked')`);

/* ------------------------------------------------------------------ */
section('Авторизация Telegram (initData)');
function initData(user, authDate = Math.floor(Date.now() / 1000)) {
  const p = new URLSearchParams({ auth_date: String(authDate), query_id: 'AAA', user: JSON.stringify(user) });
  const check = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(TOKEN).digest();
  p.set('hash', crypto.createHmac('sha256', secret).update(check).digest('hex'));
  return p.toString();
}
if (TOKEN) {
  const good = initData({ id: 500, first_name: 'Тест' });
  check((await raw(`tma ${good}`, 'GET', '/api/me')).status === 200, 'подписанный initData принимается');
  const tampered = good.replace(encodeURIComponent('"id":500'), encodeURIComponent('"id":1'));
  check((await raw(`tma ${tampered}`, 'GET', '/api/me')).status === 401, 'подмена id в initData отклоняется');
  const old = initData({ id: 500, first_name: 'Тест' }, Math.floor(Date.now() / 1000) - 40 * 86400);
  check((await raw(`tma ${old}`, 'GET', '/api/me')).status === 401, 'initData старше 30 дней отклоняется');
  const forged = initData({ id: 500 }).replace(/hash=[0-9a-f]+/, `hash=${'0'.repeat(64)}`);
  check((await raw(`tma ${forged}`, 'GET', '/api/me')).status === 401, 'чужая подпись отклоняется');
  const nonMember = await raw(`tma ${good}`, 'GET', '/api/state');
  check(nonMember.status === 403, 'не участница не видит данные компании');
} else console.log('  (пропущено: нет BOT_TOKEN)');
check((await raw(null, 'GET', '/api/state')).status === 401, 'без авторизации — 401');

section('Код приглашения: защита от перебора');
for (let i = 0; i < 5; i++) await raw(devAuth(900), 'POST', '/api/join', { code: `wrong${i}` });
const bruted = await raw(devAuth(900), 'POST', '/api/join', { code: 'test' });
check(bruted.status === 429, `после 5 ошибок даже верный код временно не принимается (${bruted.status})`);
check((await raw(devAuth(901), 'POST', '/api/join', { code: 'TEST ' })).status === 200, 'код не чувствителен к регистру и пробелам');
run('UPDATE users SET is_member=0 WHERE id=901');

section('Проверка данных карточки');
check((await status(A, 'POST', '/api/cards', { title: '   ' })) === 400, 'пустое название отклоняется');
const weird = await mk(A, {
  title: 'x'.repeat(500), link: 'javascript:alert(1)\nX-Injected: 1', tags: ['culture', 'hack', '<script>'],
  budget: 99, duration: 'forever', time_of_day: ['evening', 'midnight'], fixed_at: 'tomorrow', available_until: '2026-13-99',
  photos: ['/uploads/../../app.db', 'https://evil.example/x.jpg'],
});
const wc = (await call(A, 'GET', `/api/cards/${weird}`)).card;
check(wc.title.length === 140, 'название обрезается до 140 символов');
check(wc.link === '', `ссылки с чужими схемами (javascript: и т.п.) отбрасываются: «${wc.link}»`);
const nl = await mk(A, { title: 'Ссылка', link: 'example.com:8080/a b\nc' });
check((await call(A, 'GET', `/api/cards/${nl}`)).card.link === 'https://example.com:8080/abc', 'из ссылки убираются пробелы и переводы строк, порт сохраняется');
check(JSON.stringify(wc.tags) === '["culture"]', 'неизвестные теги отброшены');
check(wc.budget === 1 && wc.duration === 'short', 'бюджет и длительность вне списка — значения по умолчанию');
check(JSON.stringify(wc.time_of_day) === '["evening"]', 'неизвестное время суток отброшено');
check(wc.fixed_at === null, 'кривая дата сеанса отброшена');
check(wc.photos.length === 0, 'чужие пути и внешние ссылки в фото не принимаются');
const xss = await mk(B, { title: '<img src=x onerror=alert(1)>', why: '"><script>alert(2)</script>' });
check((await call(A, 'GET', `/api/cards/${xss}`)).card.title === '<img src=x onerror=alert(1)>', 'HTML хранится как текст (экранируется при выводе)');

section('Права на карточки');
check((await status(B, 'DELETE', `/api/cards/${weird}`)) === 403, 'удалить чужую карточку нельзя');
const draftId = (await import('/app/src/api.js')).createDraftCard(A, { title: 'Черновик Алины', photos: [] });
check((await status(B, 'GET', `/api/cards/${draftId}`)) === 404, 'чужой черновик не виден');
check((await status(B, 'PUT', `/api/cards/${draftId}`, { title: 'взлом' })) === 403, 'чужой черновик нельзя изменить');
check(!(await call(B, 'GET', '/api/cards')).drafts.some((d) => d.id === draftId), 'чужие черновики не попадают в список');
await call(A, 'DELETE', `/api/cards/${weird}`);
check(!get('SELECT 1 FROM cards WHERE id=?', weird) || get('SELECT status FROM cards WHERE id=?', weird).status === 'archived', 'автор может удалить свою карточку');

section('Загрузки');
const fdBad = new FormData();
fdBad.append('file', new Blob(['<?php echo 1; ?>'], { type: 'image/png' }), 'x.png');
check((await raw(devAuth(A), 'POST', '/api/upload', fdBad)).status === 400, 'не-картинка под видом PNG отклоняется');
const fdHtml = new FormData();
fdHtml.append('file', new Blob(['<html><script>alert(1)</script>'], { type: 'text/html' }), 'x.html');
check((await raw(devAuth(A), 'POST', '/api/upload', fdHtml)).status === 400, 'HTML-файл отклоняется');
const fdBig = new FormData();
fdBig.append('file', new Blob([Buffer.alloc(11_000_000, 1)], { type: 'image/jpeg' }), 'big.jpg');
const big = await raw(devAuth(A), 'POST', '/api/upload', fdBig);
check(big.status === 413 || big.status === 400, `файл больше 10 МБ отклоняется (${big.status})`);
check((await fetch(`${BASE}/uploads/..%2f..%2fapp.db`)).status >= 400, 'выйти из папки uploads нельзя');
const hdr = await fetch(`${BASE}/api/me`, { headers: { authorization: devAuth(A) } });
check(hdr.headers.get('x-content-type-options') === 'nosniff' && hdr.headers.get('cache-control') === 'no-store', 'защитные заголовки на API');

section('Превью ссылок: внутренние адреса недоступны');
for (const u of ['http://127.0.0.1:3000/health', 'http://localhost:3000/api/me', 'http://169.254.169.254/latest/meta-data/', 'http://[::1]:3000/', 'file:///etc/passwd']) {
  const r = await raw(devAuth(A), 'POST', '/api/preview', { url: u });
  check(r.status === 400 || !r.json.title, `не загружается: ${u}`);
}

/* ------------------------------------------------------------------ */
section('Голосование: неверные действия');
const c1 = await mk(A, { title: 'Кино' });
const c2 = await mk(B, { title: 'Боулинг' });
const c3 = await mk(C, { title: 'Пикник', fixed_at: '2020-05-01T12:00' }); // сеанс в прошлом — не должен попадать в колоду
const c4 = await mk(D, { title: 'Каток' });
check((await status(A, 'POST', '/api/round/vote', { cardId: c1, value: 1 })) === 404, 'голос без активного раунда — 404');
await call(A, 'POST', '/api/round/start');
const r0 = await call(B, 'POST', '/api/round/start');
check(all("SELECT id FROM rounds WHERE status IN ('voting','extra','scheduling','booked')").length === 1, 'повторный старт не создаёт второй раунд');
check((await status(A, 'POST', '/api/round/vote', { cardId: c1, value: 5 })) === 400, 'оценка вне -1/1/2 отклоняется');
check((await status(A, 'POST', '/api/round/vote', { cardId: 99999, value: 1 })) === 404, 'голос за несуществующую карточку — 404');
check((await status(A, 'POST', '/api/round/done')) === 400, 'нельзя закончить, не отметив ни одной «можно»');
check((await status(A, 'POST', '/api/round/slots', { slots: [] })) === 400, 'время нельзя отмечать во время голосования');
let seen = new Set();
for (let i = 0; i < 10; i++) {
  const n = (await call(A, 'GET', '/api/round/next')).next;
  if (!n) break;
  seen.add(n.card.id);
  await call(A, 'POST', '/api/round/vote', { cardId: n.card.id, value: -1 });
}
check(!seen.has(c3), 'карточка с прошедшим сеансом не показывается');
run('DELETE FROM votes WHERE user_id=?', A);
run('UPDATE participation SET done_stage=0 WHERE user_id=?', A);

section('Сценарий: трое пропускают — неделя пропускается');
for (const u of [B, C, D]) await call(u, 'POST', '/api/round/mood', { moods: [], pass: true });
check(L.roundById(r0.id).status === 'voting', 'пока одна не ответила — раунд открыт');
await call(A, 'POST', '/api/round/vote', { cardId: c1, value: 1 });
await call(A, 'POST', '/api/round/done');
check(L.roundById(r0.id).status === 'skipped', 'с одной участницей встреча не назначается');

section('Сценарий: голоса одновременно — ровно один выбор');
const r1 = await call(A, 'POST', '/api/round/start');
await Promise.all([A, B, C, D].map(async (u) => {
  await call(u, 'POST', '/api/round/mood', { moods: ['cheap'] });
  await call(u, 'POST', '/api/round/vote', { cardId: c4, value: 2 });
  await call(u, 'POST', '/api/round/done');
}));
const rr1 = L.roundById(r1.id);
check(rr1.status === 'scheduling' && rr1.picked_card_id === c4, 'все за «Каток» — выбран «Каток»');
check(all("SELECT id FROM rounds WHERE status IN ('voting','extra','scheduling','booked')").length === 1, 'активный раунд ровно один');
check((await status(B, 'POST', '/api/round/vote', { cardId: c1, value: 1 })) === 400, 'после выбора голосовать нельзя');

section('Сценарий: выбор времени и бронь');
const sv = (await call(A, 'GET', '/api/state')).round.schedule;
check(sv.keys.length > 0, `есть варианты времени (${sv.keys.length})`);
check((await status(A, 'POST', '/api/round/book', { slot: '2020-01-01@17' })) === 400, 'нельзя забронировать прошедшее/чужое время');
await call(A, 'POST', '/api/round/slots', { slots: [sv.keys[0], sv.keys[0], 'мусор'] });
check(get('SELECT COUNT(*) n FROM availability WHERE round_id=? AND user_id=?', r1.id, A).n === 1, 'дубли и мусор в слотах отброшены');
await call(B, 'POST', '/api/round/book', { slot: sv.keys[0] });
check(L.roundById(r1.id).status === 'booked', 'встреча забронирована');
check((await status(C, 'POST', '/api/round/book', { slot: sv.keys[0] })) === 400, 'повторная бронь отклоняется');
check((await status(C, 'POST', '/api/round/reroll')) === 400, 'перевыбрать после брони нельзя');
run('UPDATE rounds SET slot=? WHERE id=?', '2020-01-01@17', r1.id);
L.finishMeeting(L.roundById(r1.id));
check(L.roundById(r1.id).status === 'done' && get('SELECT status FROM cards WHERE id=?', c4).status === 'visited', 'после встречи карточка уходит в «Уже были»');
check((await status(D, 'POST', `/api/memories/${r1.id}`, { rating: 99, comment: 'ok' })) === 200 && get('SELECT rating FROM memories WHERE round_id=? AND user_id=?', r1.id, D).rating === 5, 'оценка ограничена 1–5');
check((await status(D, 'POST', `/api/memories/${r0.id}`, { rating: 5 })) === 400, 'оценить несостоявшуюся встречу нельзя');

section('Сценарий: джокер');
const r2 = await call(A, 'POST', '/api/round/start');
for (const u of [A, B, C, D]) await call(u, 'POST', '/api/round/mood', { moods: [] });
await call(B, 'POST', '/api/round/joker', { cardId: c2 });
check((await status(B, 'POST', '/api/round/joker', { cardId: c1 })) === 200, 'джокер можно переставить в рамках раунда');
await call(B, 'POST', '/api/round/joker', { cardId: c2 });
for (const u of [A, C, D]) {
  await call(u, 'POST', '/api/round/vote', { cardId: c1, value: 2 });
  await call(u, 'POST', '/api/round/vote', { cardId: c2, value: 1 });
  await call(u, 'POST', '/api/round/done');
}
await call(B, 'POST', '/api/round/vote', { cardId: c1, value: 1 });
await call(B, 'POST', '/api/round/done');
check(L.roundById(r2.id).picked_card_id === c2 && L.roundById(r2.id).pick_reason === 'joker', 'джокер побеждает, если никто не против');
check((await status(B, 'POST', '/api/round/joker', { cardId: c1 })) === 400, 'после выбора джокер не ставится');
endRound();
const r3 = await call(A, 'POST', '/api/round/start');
check((await status(B, 'POST', '/api/round/joker', { cardId: c1 })) === 400, 'второй джокер в том же месяце запрещён');
endRound();

section('Сценарий: джокер с «нет» не срабатывает');
run('UPDATE users SET last_joker_month=NULL');
const r4 = await call(A, 'POST', '/api/round/start');
for (const u of [A, B, C, D]) await call(u, 'POST', '/api/round/mood', { moods: [] });
await call(C, 'POST', '/api/round/joker', { cardId: c2 });
await call(A, 'POST', '/api/round/vote', { cardId: c2, value: -1 });
for (const u of [A, B, C, D]) {
  await call(u, 'POST', '/api/round/vote', { cardId: c1, value: 1 });
  await call(u, 'POST', '/api/round/done').catch(() => {});
}
const rr4 = L.roundById(r4.id);
check(rr4.picked_card_id === c1 && rr4.pick_reason === 'consensus', 'при чьём-то «нет» джокер не срабатывает, выбирается общее');
check(get('SELECT last_joker_month FROM users WHERE id=?', C).last_joker_month === null, 'несработавший джокер не сгорает');

section('Сценарий: перевыбор');
await call(D, 'POST', '/api/round/slots', { slots: [(await call(D, 'GET', '/api/state')).round.schedule.keys[0]] });
await call(D, 'POST', '/api/round/reroll');
const rr5 = L.roundById(r4.id);
check(rr5.status === 'extra' && rr5.picked_card_id === null, 'перевыбор возвращает к довыбору');
check(get('SELECT COUNT(*) n FROM availability WHERE round_id=?', r4.id).n === 0, 'отмеченное время сброшено');
check(!(await call(A, 'GET', '/api/round/next')).next || (await call(A, 'GET', '/api/round/next')).next.card.id !== c1, 'отклонённая карточка больше не предлагается');
endRound();

section('Сценарий: дедлайн — молчащая не блокирует выбор');
const r6 = await call(A, 'POST', '/api/round/start');
for (const u of [A, B, C]) {
  await call(u, 'POST', '/api/round/vote', { cardId: c1, value: 1 });
  await call(u, 'POST', '/api/round/done');
}
check(L.roundById(r6.id).status === 'voting', 'без Полины раунд ждёт');
run('UPDATE rounds SET deadline=? WHERE id=?', Date.now() - 1000, r6.id);
L.closeByDeadline(L.roundById(r6.id));
check(L.roundById(r6.id).status === 'scheduling' && L.roundById(r6.id).picked_card_id === c1, 'по дедлайну выбор среди ответивших');
endRound();

section('Сценарий: новенькая в середине раунда, архивная карточка');
const r7 = await call(A, 'POST', '/api/round/start');
await call(A, 'DELETE', `/api/cards/${c1}`);
const n7 = (await call(B, 'GET', '/api/round/next')).next;
check(!n7 || n7.card.id !== c1, 'удалённая карточка исчезает из колоды');
await call(77, 'POST', '/api/join', { code: 'test' });
const st7 = await call(A, 'GET', '/api/state');
check(st7.round.progress.some((p) => p.user.id === 77), 'новенькая сразу участвует в текущем раунде');
endRound();

section('Фиксированный сеанс, который уже прошёл');
const r8 = await call(A, 'POST', '/api/round/start');
run("UPDATE rounds SET status='scheduling', picked_card_id=?, pick_reason='best' WHERE id=?", c3, r8.id);
const s8 = (await call(A, 'GET', '/api/state')).round.schedule;
check(s8.keys.length === 0, 'у прошедшего сеанса нет вариантов времени');
check((await status(A, 'POST', '/api/round/book', { slot: '2020-05-01@12:00' })) === 400, 'забронировать прошедший сеанс нельзя');
endRound();

/* ------------------------------------------------------------------ */
section('Целостность базы');
check(get('PRAGMA integrity_check').integrity_check === 'ok', 'integrity_check = ok');
check(all('PRAGMA foreign_key_check').length === 0, 'нет битых внешних ключей');
check(get("SELECT COUNT(*) n FROM votes v LEFT JOIN cards c ON c.id=v.card_id WHERE c.id IS NULL").n === 0, 'нет голосов за несуществующие карточки');
check(get("SELECT COUNT(*) n FROM rounds WHERE status IN ('scheduling','booked','done') AND picked_card_id IS NULL").n === 0, 'у каждой назначенной встречи есть карточка');
const { backupDb, referencedUploads } = await import('/app/src/scheduler.js');
await backupDb('edge-test');
const bk = path.join(cfg.dataDir, 'backups', 'app-edge-test.db');
const st = await fs.stat(bk).catch(() => null);
check(st && st.size > 0, `бэкап базы создаётся (${st ? Math.round(st.size / 1024) : 0} КБ)`);
check(referencedUploads() instanceof Set, 'список используемых фото собирается');

console.log(failures ? `\n${failures} проверок не прошло` : '\nвсё ок');
db.close();
process.exit(failures ? 1 : 0);
