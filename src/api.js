import crypto from 'node:crypto';
import { cfg, TAGS, MOODS, BLOCKS } from './config.js';
import { all, get, run, setSetting } from './db.js';
import * as L from './logic.js';
import { linkPreview, saveUpload, weather } from './fetchers.js';

const { UserError } = L;

/* ---------------- Авторизация через Telegram initData ---------------- */

function verifyInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;
  params.delete('hash');
  const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
  const secret = crypto.createHmac('sha256', 'WebAppData').update(cfg.botToken).digest();
  const calc = crypto.createHmac('sha256', secret).update(check).digest('hex');
  if (calc.length !== hash.length || !crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash))) return null;
  if (Date.now() / 1000 - Number(params.get('auth_date')) > 30 * 86400) return null;
  try {
    return JSON.parse(params.get('user'));
  } catch {
    return null;
  }
}

export function upsertUser(tg) {
  const name = [tg.first_name, tg.last_name].filter(Boolean).join(' ').trim() || tg.username || 'Подруга';
  run(
    `INSERT INTO users(id, name, username, photo_url) VALUES(?,?,?,?)
     ON CONFLICT(id) DO UPDATE SET username=excluded.username, photo_url=COALESCE(excluded.photo_url, users.photo_url)`,
    tg.id, name.slice(0, 40), tg.username || null, tg.photo_url || null,
  );
  return L.userById(tg.id);
}

export function joinGroup(userId, code) {
  if (cfg.inviteCode && String(code || '').trim().toLowerCase() !== cfg.inviteCode.toLowerCase()) {
    throw new UserError('Неверный код приглашения', 403);
  }
  const u = L.userById(userId);
  if (!u.is_member) run('UPDATE users SET is_member=1, joined_at=? WHERE id=?', Date.now(), userId);
  const round = L.currentRound();
  if (round) L.ensurePart(round.id, userId);
  return L.userById(userId);
}

/* ---------------- Карточки ---------------- */

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const UPLOAD_RE = /^\/uploads\/[a-f0-9]+\.(jpg|png|webp|gif)$/;
const dateOrNull = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : null);

function cleanCard(b) {
  const c = {
    title: str(b.title, 140),
    why: str(b.why, 1500),
    link: str(b.link, 500),
    photos: [...new Set(Array.isArray(b.photos) ? b.photos : b.photo ? [b.photo] : [])].filter((x) => UPLOAD_RE.test(x)).slice(0, 10),
    tags: JSON.stringify((b.tags || []).filter((t) => t in TAGS)),
    budget: [0, 1, 2, 3].includes(Number(b.budget)) ? Number(b.budget) : 1,
    duration: ['short', 'half', 'day'].includes(b.duration) ? b.duration : 'short',
    time_of_day: JSON.stringify((b.time_of_day || []).filter((t) => BLOCKS.some((x) => x.key === t))),
    area: str(b.area, 120),
    outdoor: b.outdoor ? 1 : 0,
    needs_booking: b.needs_booking ? 1 : 0,
    available_until: dateOrNull(b.available_until),
    fixed_at: /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(b.fixed_at || '') ? b.fixed_at : null,
  };
  if (c.link && !/^https?:\/\//i.test(c.link)) c.link = `https://${c.link}`;
  c.photo = c.photos[0] || '';
  c.photos = JSON.stringify(c.photos);
  if (!c.title) throw new UserError('Нужно хотя бы название');
  return c;
}

export function createDraftCard(userId, data) {
  const now = Date.now();
  const info = run(
    `INSERT INTO cards(author_id,status,title,why,link,photo,photos,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)`,
    userId, 'draft', str(data.title, 140), str(data.why, 1500), str(data.link, 500), data.photo || '',
    JSON.stringify(data.photo ? [data.photo] : []), now, now,
  );
  return Number(info.lastInsertRowid);
}

/* ---------------- Маршруты ---------------- */

export async function registerApi(app) {
  app.setErrorHandler((err, req, reply) => {
    const status = err.status || err.statusCode || 500;
    if (status >= 500) req.log.error(err);
    reply.code(status).send({ error: status >= 500 ? 'Что-то сломалось, попробуй ещё раз' : err.message });
  });

  app.addHook('preHandler', async (req) => {
    if (!req.url.startsWith('/api/')) return;
    const h = req.headers.authorization || '';
    let tg = null;
    if (h.startsWith('tma ')) tg = verifyInitData(h.slice(4));
    else if (cfg.devAuth && h.startsWith('dev ')) {
      const [id, name] = h.slice(4).split(':');
      tg = { id: Number(id), first_name: decodeURIComponent(name || `Dev${id}`) };
    }
    if (!tg?.id) throw new UserError('Открой приложение из Telegram', 401);
    req.user = upsertUser(tg);
    const open = ['/api/me', '/api/join'];
    if (!req.user.is_member && !open.includes(req.url.split('?')[0])) throw new UserError('Сначала введи код приглашения', 403);
  });

  const uid = (req) => req.user.id;
  const round = () => {
    const r = L.currentRound();
    if (!r) throw new UserError('Сейчас нет активного выбора', 404);
    return r;
  };

  app.get('/api/me', async (req) => ({
    user: L.pubUser(req.user),
    member: !!req.user.is_member,
    needCode: !!cfg.inviteCode,
    dict: { tags: TAGS, moods: MOODS, blocks: BLOCKS },
  }));
  app.post('/api/join', async (req) => ({ user: L.pubUser(joinGroup(uid(req), req.body?.code)) }));
  app.put('/api/me', async (req) => {
    const name = str(req.body?.name, 40);
    if (name) run('UPDATE users SET name=? WHERE id=?', name, uid(req));
    return { ok: true };
  });

  app.get('/api/state', async (req) => {
    const state = L.buildState(uid(req));
    if (state.round?.schedule) {
      const w = await weather();
      state.round.schedule.weather = Object.fromEntries(state.round.schedule.days.map((d) => [d, w[d] || null]));
    }
    return state;
  });
  app.put('/api/settings', async (req) => {
    if (['weekly', 'biweekly'].includes(req.body?.cadence)) setSetting('cadence', req.body.cadence);
    return { ok: true };
  });

  app.post('/api/round/start', async (req) => ({ id: L.startRound(uid(req)).id }));
  app.post('/api/round/mood', async (req) => {
    L.setMood(round(), uid(req), req.body?.moods, !!req.body?.pass);
    return { ok: true };
  });
  app.get('/api/round/next', async (req) => {
    const r = round();
    return { next: L.nextCard(r, uid(req)) };
  });
  app.post('/api/round/vote', async (req) => {
    L.vote(round(), uid(req), Number(req.body?.cardId), req.body?.value);
    return { ok: true };
  });
  app.post('/api/round/done', async (req) => {
    L.markDone(round(), uid(req));
    return { ok: true };
  });
  app.post('/api/round/joker', async (req) => {
    const id = req.body?.cardId;
    L.useJoker(round(), uid(req), id === null ? null : Number(id));
    return { ok: true };
  });
  app.post('/api/round/slots', async (req) => {
    L.setSlots(round(), uid(req), req.body?.slots);
    return { ok: true };
  });
  app.post('/api/round/book', async (req) => {
    L.book(round(), uid(req), String(req.body?.slot || ''));
    return { ok: true };
  });
  app.post('/api/round/unbook', async (req) => {
    L.unbook(round(), uid(req));
    return { ok: true };
  });
  app.post('/api/round/reroll', async (req) => {
    L.reroll(round(), uid(req));
    return { ok: true };
  });

  app.get('/api/cards', async (req) => {
    const status = req.query.status === 'visited' ? 'visited' : 'active';
    const cards = all('SELECT * FROM cards WHERE status=? ORDER BY created_at DESC', status).map(L.parseCard);
    const drafts = all("SELECT * FROM cards WHERE status='draft' AND author_id=? ORDER BY created_at DESC", uid(req)).map(L.parseCard);
    const counts = Object.fromEntries(
      all("SELECT status, COUNT(*) n FROM cards WHERE status IN ('active','visited') GROUP BY status").map((r) => [r.status, r.n]),
    );
    return { cards, drafts, counts: { active: counts.active || 0, visited: counts.visited || 0 } };
  });
  app.get('/api/cards/:id', async (req) => {
    const c = L.cardById(Number(req.params.id));
    if (!c || (c.status === 'draft' && c.author_id !== uid(req))) throw new UserError('Карточка не найдена', 404);
    return { card: c };
  });
  app.post('/api/cards', async (req) => {
    const c = cleanCard(req.body || {});
    const now = Date.now();
    const info = run(
      `INSERT INTO cards(author_id,status,title,why,link,photo,photos,tags,budget,duration,time_of_day,area,outdoor,needs_booking,available_until,fixed_at,created_at,updated_at)
       VALUES(?, 'active', ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      uid(req), c.title, c.why, c.link, c.photo, c.photos, c.tags, c.budget, c.duration, c.time_of_day, c.area, c.outdoor, c.needs_booking,
      c.available_until, c.fixed_at, now, now,
    );
    return { id: Number(info.lastInsertRowid) };
  });
  app.put('/api/cards/:id', async (req) => {
    const id = Number(req.params.id);
    const old = get('SELECT * FROM cards WHERE id=?', id);
    if (!old) throw new UserError('Карточка не найдена', 404);
    if (old.status === 'draft' && old.author_id !== uid(req)) throw new UserError('Это чужой черновик', 403);
    const c = cleanCard(req.body || {});
    run(
      `UPDATE cards SET title=?,why=?,link=?,photo=?,photos=?,tags=?,budget=?,duration=?,time_of_day=?,area=?,outdoor=?,needs_booking=?,
         available_until=?,fixed_at=?,updated_at=?, status=CASE WHEN status='draft' THEN 'active' ELSE status END WHERE id=?`,
      c.title, c.why, c.link, c.photo, c.photos, c.tags, c.budget, c.duration, c.time_of_day, c.area, c.outdoor, c.needs_booking,
      c.available_until, c.fixed_at, Date.now(), id,
    );
    return { id };
  });
  app.delete('/api/cards/:id', async (req) => {
    const id = Number(req.params.id);
    const c = get('SELECT * FROM cards WHERE id=?', id);
    if (!c) throw new UserError('Карточка не найдена', 404);
    if (c.author_id !== uid(req)) throw new UserError('Удалить может только автор', 403);
    const used = get('SELECT 1 FROM votes WHERE card_id=? LIMIT 1', id) || get('SELECT 1 FROM rounds WHERE picked_card_id=? LIMIT 1', id);
    if (used || c.status !== 'draft') run("UPDATE cards SET status='archived' WHERE id=?", id);
    else run('DELETE FROM cards WHERE id=?', id);
    return { ok: true };
  });
  app.post('/api/cards/:id/restore', async (req) => {
    run("UPDATE cards SET status='active' WHERE id=? AND status='visited'", Number(req.params.id));
    return { ok: true };
  });

  app.post('/api/preview', async (req) => {
    const url = str(req.body?.url, 500);
    if (!/^https?:\/\//i.test(url)) throw new UserError('Это не похоже на ссылку');
    return linkPreview(url);
  });

  app.post('/api/upload', async (req) => {
    const file = await req.file();
    if (!file) throw new UserError('Нет файла');
    const buf = await file.toBuffer();
    try {
      return { path: await saveUpload(buf, file.mimetype) };
    } catch {
      throw new UserError('Подойдут только картинки: jpg, png, webp');
    }
  });

  app.get('/api/memories', async () => ({ items: L.memoriesList() }));
  app.post('/api/memories/:roundId', async (req) => {
    L.saveMemory(Number(req.params.roundId), uid(req), req.body?.rating, req.body?.comment);
    return { ok: true };
  });
  app.post('/api/memories/:roundId/photo', async (req) => {
    const roundId = Number(req.params.roundId);
    const r = L.roundById(roundId);
    if (!r || r.status !== 'done') throw new UserError('Эта встреча ещё не прошла');
    const file = await req.file();
    if (!file) throw new UserError('Нет файла');
    let p;
    try {
      p = await saveUpload(await file.toBuffer(), file.mimetype);
    } catch {
      throw new UserError('Подойдут только картинки: jpg, png, webp');
    }
    run('INSERT INTO memory_photos(round_id,user_id,path,created_at) VALUES(?,?,?,?)', roundId, uid(req), p, Date.now());
    return { path: p };
  });
}
