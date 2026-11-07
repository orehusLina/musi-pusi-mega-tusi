import { all, get, run, tx, getSetting } from './db.js';
import { cfg, BLOCKS, MOODS } from './config.js';
import { DAY, HOUR, pad, dateKey, monthKey, parseDateKey, slotToDate, daysBetween, humanSlot } from './time.js';

/* ------------------------------------------------------------------ */
/* Связь с ботом: logic только сообщает о событиях, бот решает, что писать */

export const hooks = {
  notify: (event, data) => console.log('[notify]', event, JSON.stringify(data)),
};
function emit(event, data) {
  try {
    Promise.resolve(hooks.notify(event, data)).catch((e) => console.error('notify failed', event, e));
  } catch (e) {
    console.error('notify failed', event, e);
  }
}

export class UserError extends Error {
  constructor(msg, status = 400) {
    super(msg);
    this.status = status;
  }
}

const OPEN = ['voting', 'extra'];
const ACTIVE = "('voting','extra','scheduling','booked')";

/* ------------------------------------------------------------------ */
/* Люди и карточки */

export const members = () => all('SELECT * FROM users WHERE is_member=1 ORDER BY joined_at, id');
export const userById = (id) => get('SELECT * FROM users WHERE id=?', id);
export const pubUser = (u) => (u ? { id: u.id, name: u.name, username: u.username, photo: u.photo_url } : null);

export function parseCard(c) {
  if (!c) return null;
  return {
    ...c,
    tags: JSON.parse(c.tags),
    photos: (() => {
      const list = JSON.parse(c.photos || '[]');
      return list.length ? list : c.photo ? [c.photo] : [];
    })(),
    time_of_day: JSON.parse(c.time_of_day),
    outdoor: !!c.outdoor,
    needs_booking: !!c.needs_booking,
    author: pubUser(userById(c.author_id)),
  };
}
export const cardById = (id) => parseCard(get('SELECT * FROM cards WHERE id=?', id));

function nowIso(d = new Date()) {
  return `${dateKey(d)}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function availableCards(now = new Date()) {
  return all(
    `SELECT * FROM cards WHERE status='active'
       AND (available_until IS NULL OR available_until >= ?)
       AND (fixed_at IS NULL OR fixed_at > ?)`,
    dateKey(now),
    nowIso(now),
  ).map(parseCard);
}

const cardMatchesMood = (c, mood) => (mood === 'cheap' ? c.budget <= 1 : c.tags.includes(mood));

/* ------------------------------------------------------------------ */
/* Раунды */

export const currentRound = () => get(`SELECT * FROM rounds WHERE status IN ${ACTIVE} ORDER BY id DESC LIMIT 1`);
export const roundById = (id) => get('SELECT * FROM rounds WHERE id=?', id);

export function lastMeeting(now = Date.now()) {
  const rows = all("SELECT * FROM rounds WHERE slot IS NOT NULL AND status IN ('booked','done') ORDER BY slot DESC");
  return rows.find((r) => slotToDate(r.slot).getTime() <= now) || null;
}
export function nextMeeting(now = Date.now()) {
  const rows = all("SELECT * FROM rounds WHERE slot IS NOT NULL AND status='booked' ORDER BY slot ASC");
  return rows.find((r) => slotToDate(r.slot).getTime() > now) || null;
}
export function daysSinceLastMeeting(now = Date.now()) {
  const last = lastMeeting(now);
  return last ? daysBetween(slotToDate(last.slot), now) : null;
}

export function ensurePart(roundId, userId) {
  run('INSERT OR IGNORE INTO participation(round_id, user_id) VALUES(?,?)', roundId, userId);
  return get('SELECT * FROM participation WHERE round_id=? AND user_id=?', roundId, userId);
}

function partsOf(roundId) {
  return all(
    `SELECT p.* FROM participation p JOIN users u ON u.id=p.user_id
      WHERE p.round_id=? AND u.is_member=1`,
    roundId,
  ).map((p) => ({ ...p, moods: JSON.parse(p.moods) }));
}

function activeIds(roundId) {
  return partsOf(roundId).filter((p) => !p.pass).map((p) => p.user_id);
}

function roundStats(roundId) {
  const stats = new Map();
  for (const v of all('SELECT user_id, card_id, value FROM votes WHERE round_id=?', roundId)) {
    let s = stats.get(v.card_id);
    if (!s) {
      s = { cardId: v.card_id, likes: new Set(), loves: new Set(), vetoes: new Set(), score: 0 };
      stats.set(v.card_id, s);
    }
    if (v.value > 0) {
      s.likes.add(v.user_id);
      s.score += v.value;
      if (v.value === 2) s.loves.add(v.user_id);
    } else s.vetoes.add(v.user_id);
  }
  return stats;
}

function groupMoods(roundId) {
  const counts = {};
  for (const p of partsOf(roundId)) if (!p.pass) for (const m of p.moods) counts[m] = (counts[m] || 0) + 1;
  return counts;
}

function myCounts(roundId, userId) {
  return get(
    'SELECT COUNT(*) AS votes, COALESCE(SUM(value>0),0) AS likes FROM votes WHERE round_id=? AND user_id=?',
    roundId,
    userId,
  );
}

function computeDeadline(now = Date.now()) {
  const d = new Date(now);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  d.setHours(20, 0, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 7);
  const diff = d.getTime() - now;
  // Запуск в субботу -> дедлайн в воскресенье 20:00. Иначе просто 48 часов.
  return diff >= 24 * HOUR && diff <= 72 * HOUR ? d.getTime() : now + 48 * HOUR;
}

export function startRound(userId = null) {
  const cur = currentRound();
  if (cur) return cur;
  if (members().length < 2) throw new UserError('Нужно хотя бы две участницы. Пригласи подруг: пусть откроют бота и пришлют код приглашения');
  const now = Date.now();
  const id = tx(() => {
    const info = run(
      "INSERT INTO rounds(status, stage, started_at, started_by, deadline) VALUES('voting', 1, ?, ?, ?)",
      now,
      userId,
      computeDeadline(now),
    );
    for (const m of members()) run('INSERT OR IGNORE INTO participation(round_id,user_id) VALUES(?,?)', info.lastInsertRowid, m.id);
    return Number(info.lastInsertRowid);
  });
  emit('round_started', { roundId: id, by: userId });
  return roundById(id);
}

export function setMood(round, userId, moods, pass) {
  if (!OPEN.includes(round.status)) throw new UserError('Голосование уже закрыто');
  const clean = [...new Set((moods || []).filter((m) => m in MOODS))];
  ensurePart(round.id, userId);
  run('UPDATE participation SET mood_set=1, moods=?, pass=? WHERE round_id=? AND user_id=?', JSON.stringify(clean), pass ? 1 : 0, round.id, userId);
  if (pass) emit('passed', { roundId: round.id, userId });
  maybeClose(round.id);
}

/** Кандидаты для конкретного человека: ещё не оценены им и никем не забанены. */
function candidatesFor(round, userId) {
  const stats = roundStats(round.id);
  const act = activeIds(round.id);
  const mine = new Set(all('SELECT card_id FROM votes WHERE round_id=? AND user_id=?', round.id, userId).map((r) => r.card_id));
  const vetoed = (id) => {
    const s = stats.get(id);
    return !!s && [...s.vetoes].some((u) => act.includes(u));
  };
  const othersLikes = (c) => {
    const s = stats.get(c.id);
    return s ? [...s.likes].filter((u) => u !== userId && act.includes(u)) : [];
  };
  const cands = availableCards().filter((c) => !mine.has(c.id) && !vetoed(c.id));
  const finalists = cands
    .filter((c) => othersLikes(c).length > 0)
    .sort((a, b) => othersLikes(b).length - othersLikes(a).length || stats.get(b.id).score - stats.get(a.id).score);
  return { cands, finalists, othersLikes, stats };
}

export function nextCard(round, userId) {
  if (!OPEN.includes(round.status)) return null;
  const { cands, finalists, othersLikes } = candidatesFor(round, userId);
  if (!cands.length) return null;

  let pick = round.stage === 2 && finalists.length ? finalists[0] : null;
  if (!pick) {
    // Основной выбор: подтягиваем то, что уже понравилось другим (так быстрее находится совпадение),
    // то, что подходит под настроение недели, давно не показывалось или скоро закончится.
    const moods = groupMoods(round.id);
    const now = Date.now();
    let best = -Infinity;
    for (const c of cands) {
      let s = 4 * othersLikes(c).length;
      for (const [m, n] of Object.entries(moods)) if (cardMatchesMood(c, m)) s += 1.5 * n;
      s += Math.min(30, c.last_shown_at ? (now - c.last_shown_at) / DAY : 30) / 10;
      if (!c.times_shown) s += 1.5;
      if (c.available_until && daysBetween(now, parseDateKey(c.available_until)) <= 14) s += 2;
      if (c.fixed_at) s += 1;
      s += Math.random() * 2.5;
      if (s > best) {
        best = s;
        pick = c;
      }
    }
  }
  if (run('INSERT OR IGNORE INTO shown VALUES(?,?,?)', round.id, userId, pick.id).changes) {
    run('UPDATE cards SET times_shown=times_shown+1, last_shown_at=? WHERE id=?', Date.now(), pick.id);
  }
  const daysLeft = pick.available_until ? daysBetween(Date.now(), parseDateKey(pick.available_until)) : null;
  return {
    card: pick,
    likedBy: othersLikes(pick).map((id) => pubUser(userById(id))),
    finalistsLeft: round.stage === 2 ? finalists.length : 0,
    expiresInDays: daysLeft !== null && daysLeft <= 14 ? daysLeft : null,
  };
}

function markDoneRaw(round, userId) {
  run('UPDATE participation SET done_stage=? WHERE round_id=? AND user_id=?', round.stage, round.id, userId);
}

function autoDone(round, userId) {
  const p = ensurePart(round.id, userId);
  if (p.done_stage >= round.stage) return;
  const { votes, likes } = myCounts(round.id, userId);
  const { cands, finalists } = candidatesFor(round, userId);
  const ok =
    round.stage === 1
      ? !cands.length || (likes >= 1 && (likes >= cfg.likesTarget || votes >= cfg.maxShown))
      : !cands.length || (likes >= 1 && finalists.length === 0);
  if (ok) markDoneRaw(round, userId);
}

export function vote(round, userId, cardId, value) {
  if (!OPEN.includes(round.status)) throw new UserError('Голосование уже закрыто');
  value = Number(value);
  if (![-1, 1, 2].includes(value)) throw new UserError('Странная оценка');
  if (!get("SELECT id FROM cards WHERE id=? AND status='active'", cardId)) throw new UserError('Карточка не найдена', 404);
  ensurePart(round.id, userId);
  run('UPDATE participation SET pass=0, mood_set=1 WHERE round_id=? AND user_id=?', round.id, userId);
  run(
    `INSERT INTO votes(round_id,user_id,card_id,value,stage,created_at) VALUES(?,?,?,?,?,?)
     ON CONFLICT(round_id,user_id,card_id) DO UPDATE SET value=excluded.value, stage=excluded.stage, created_at=excluded.created_at`,
    round.id, userId, cardId, value, round.stage, Date.now(),
  );
  autoDone(round, userId);
  maybeClose(round.id);
}

export function markDone(round, userId) {
  if (!OPEN.includes(round.status)) throw new UserError('Голосование уже закрыто');
  const { likes } = myCounts(round.id, userId);
  const { cands } = candidatesFor(round, userId);
  if (likes < 1 && cands.length) throw new UserError('Отметь хотя бы одну карточку как «можно» или «очень хочу»');
  ensurePart(round.id, userId);
  markDoneRaw(round, userId);
  maybeClose(round.id);
}

export function useJoker(round, userId, cardId) {
  if (!OPEN.includes(round.status)) throw new UserError('Голосование уже закрыто');
  ensurePart(round.id, userId);
  if (cardId === null) {
    run('UPDATE participation SET joker_card_id=NULL WHERE round_id=? AND user_id=?', round.id, userId);
    return;
  }
  const u = userById(userId);
  if (u.last_joker_month === monthKey(new Date())) throw new UserError('Джокер в этом месяце уже использован');
  if (!availableCards().some((c) => c.id === cardId)) throw new UserError('Эта карточка сейчас недоступна');
  run('UPDATE participation SET joker_card_id=? WHERE round_id=? AND user_id=?', cardId, round.id, userId);
  vote(round, userId, cardId, 2);
}

export function maybeClose(roundId) {
  const round = roundById(roundId);
  if (!round || !OPEN.includes(round.status)) return;
  const act = partsOf(roundId).filter((p) => !p.pass);
  if (act.every((p) => p.done_stage >= round.stage)) closeStage(round, false);
}

function authorWins() {
  const wins = {};
  const rows = all(
    `SELECT c.author_id FROM rounds r JOIN cards c ON c.id=r.picked_card_id
      WHERE r.picked_card_id IS NOT NULL ORDER BY r.id DESC LIMIT 8`,
  );
  for (const r of rows) wins[r.author_id] = (wins[r.author_id] || 0) + 1;
  return wins;
}

function weightedPick(list) {
  const wins = authorWins();
  const weighted = list.map((s) => {
    const c = cardById(s.cardId);
    // Небольшая справедливость: чьи идеи недавно уже выигрывали — у тех вес чуть ниже
    return { s, w: s.score / (1 + 0.35 * (wins[c.author_id] || 0)) };
  });
  const total = weighted.reduce((a, x) => a + x.w, 0);
  let r = Math.random() * total;
  for (const x of weighted) {
    r -= x.w;
    if (r <= 0) return x.s;
  }
  return weighted[weighted.length - 1].s;
}

export function partialMatches(roundId, excludeId = null) {
  const stats = roundStats(roundId);
  const act = activeIds(roundId);
  return [...stats.values()]
    .filter((s) => s.cardId !== excludeId && s.likes.size >= 2)
    .sort((a, b) => b.likes.size - a.likes.size || b.score - a.score)
    .slice(0, 4)
    .map((s) => {
      const c = cardById(s.cardId);
      return {
        card: { id: c.id, title: c.title, photo: c.photo, link: c.link },
        likedBy: [...s.likes].map((id) => pubUser(userById(id))),
        count: s.likes.size,
        of: act.length,
      };
    });
}

function closeStage(round, byDeadline) {
  const stats = roundStats(round.id);
  let act = partsOf(round.id).filter((p) => !p.pass);
  if (byDeadline) act = act.filter((p) => myCounts(round.id, p.user_id).votes > 0);
  const ids = act.map((p) => p.user_id);

  if (ids.length < 2) {
    run("UPDATE rounds SET status='skipped', closed_at=? WHERE id=?", Date.now(), round.id);
    emit('round_skipped', { roundId: round.id });
    return;
  }
  const available = new Set(availableCards().map((c) => c.id));
  const noVeto = (s) => available.has(s.cardId) && ![...s.vetoes].some((u) => ids.includes(u));

  // 1) Джокер побеждает, если никто из идущих не поставил «не хочу»
  for (const p of act) {
    if (!p.joker_card_id) continue;
    const s = stats.get(p.joker_card_id);
    if (s && noVeto(s)) return pickCard(round, s.cardId, 'joker', p.user_id);
  }
  // 2) Полное совпадение: всем, кто идёт, ок
  const consensus = [...stats.values()].filter((s) => noVeto(s) && ids.every((u) => s.likes.has(u)));
  if (consensus.length) return pickCard(round, weightedPick(consensus).cardId, 'consensus');

  // 3) Совпадения нет -> довыбор (один раз), показываем частичные совпадения
  if (round.stage === 1) {
    run(
      "UPDATE rounds SET stage=2, status='extra', deadline=? WHERE id=?",
      Math.max(Date.now() + 24 * HOUR, round.deadline),
      round.id,
    );
    emit('extra_round', { roundId: round.id });
    return;
  }
  // 4) После довыбора всё равно что-то выбираем: лучшее, на что никто не сказал «нет»
  const best = [...stats.values()]
    .filter(noVeto)
    .sort((a, b) => b.likes.size - a.likes.size || b.score - a.score || Math.random() - 0.5)[0];
  if (best) return pickCard(round, best.cardId, 'best');
  run("UPDATE rounds SET status='skipped', closed_at=? WHERE id=?", Date.now(), round.id);
  emit('round_skipped', { roundId: round.id, reason: 'nothing' });
}

function pickCard(round, cardId, reason, jokerUser = null) {
  run(
    "UPDATE rounds SET status='scheduling', picked_card_id=?, pick_reason=?, joker_user_id=?, closed_at=? WHERE id=?",
    cardId, reason, jokerUser, Date.now(), round.id,
  );
  if (jokerUser) run('UPDATE users SET last_joker_month=? WHERE id=?', monthKey(new Date()), jokerUser);
  emit('picked', { roundId: round.id });
}

export function closeByDeadline(round) {
  if (OPEN.includes(round.status) && Date.now() >= round.deadline) closeStage(round, true);
}

export function pendingVoters(round) {
  return partsOf(round.id)
    .filter((p) => !p.pass && p.done_stage < round.stage)
    .map((p) => p.user_id);
}

/* ------------------------------------------------------------------ */
/* Слоты */

export function slotOptions(round) {
  const card = cardById(round.picked_card_id);
  if (card.fixed_at) {
    const [d, t] = card.fixed_at.split('T');
    const key = `${d}@${t}`;
    return { days: [d], blocks: [], fixed: key, keys: [key] };
  }
  const now = new Date();
  const days = [];
  for (let i = 0; i < 14; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() + i);
    const k = dateKey(d);
    if (card.available_until && k > card.available_until) break;
    days.push(k);
  }
  const blocks = BLOCKS.filter((b) => !card.time_of_day.length || card.time_of_day.includes(b.key));
  const keys = [];
  for (const d of days) for (const b of blocks) {
    const k = `${d}@${b.h}`;
    if (slotToDate(k).getTime() > now.getTime() + HOUR) keys.push(k);
  }
  return { days: days.filter((d) => keys.some((k) => k.startsWith(d))), blocks, fixed: null, keys };
}

export function scheduleView(round, userId) {
  const opt = slotOptions(round);
  const valid = new Set(opt.keys);
  if (round.slot) valid.add(round.slot);
  const counts = {};
  const mine = [];
  for (const a of all('SELECT user_id, slot FROM availability WHERE round_id=?', round.id)) {
    if (!valid.has(a.slot)) continue;
    (counts[a.slot] ||= []).push(a.user_id);
    if (a.user_id === userId) mine.push(a.slot);
  }
  const ranking = Object.entries(counts)
    .map(([slot, users]) => ({ slot, users, count: users.length, human: humanSlot(slot) }))
    .sort((a, b) => b.count - a.count || a.slot.localeCompare(b.slot))
    .slice(0, 5);
  return { ...opt, counts, mine, ranking, total: members().length };
}

export function setSlots(round, userId, slots) {
  if (round.status !== 'scheduling') throw new UserError('Сейчас время не выбирается');
  const valid = new Set(slotOptions(round).keys);
  const clean = [...new Set(slots || [])].filter((s) => valid.has(s));
  const ms = members();
  const allDoneBefore = ms.every((m) => ensurePart(round.id, m.id).slots_done);
  tx(() => {
    run('DELETE FROM availability WHERE round_id=? AND user_id=?', round.id, userId);
    for (const s of clean) run('INSERT INTO availability(round_id,user_id,slot) VALUES(?,?,?)', round.id, userId, s);
    run('UPDATE participation SET slots_done=1 WHERE round_id=? AND user_id=?', round.id, userId);
  });
  const allDoneNow = ms.every((m) => ensurePart(round.id, m.id).slots_done);
  if (allDoneNow && !allDoneBefore) emit('slots_ready', { roundId: round.id });
  else emit('slots_marked', { roundId: round.id, userId });
}

function pickBooker(round, slot, card) {
  if (!card.needs_booking) return null;
  const ms = members().map((m) => m.id);
  const free = all('SELECT user_id FROM availability WHERE round_id=? AND slot=?', round.id, slot)
    .map((r) => r.user_id)
    .filter((id) => ms.includes(id));
  const pool = free.length ? free : ms;
  const counts = Object.fromEntries(pool.map((id) => [id, 0]));
  for (const r of all('SELECT booker_id FROM rounds WHERE booker_id IS NOT NULL')) {
    if (r.booker_id in counts) counts[r.booker_id]++;
  }
  const min = Math.min(...Object.values(counts));
  const cands = pool.filter((id) => counts[id] === min);
  return cands[Math.floor(Math.random() * cands.length)];
}

export function book(round, userId, slot) {
  if (round.status !== 'scheduling') throw new UserError('Сейчас нечего бронировать');
  if (!slotOptions(round).keys.includes(slot)) throw new UserError('Это время уже недоступно');
  const card = cardById(round.picked_card_id);
  const booker = pickBooker(round, slot, card);
  run("UPDATE rounds SET status='booked', slot=?, booker_id=?, reminded_before=0 WHERE id=?", slot, booker, round.id);
  emit('booked', { roundId: round.id, by: userId });
}

export function unbook(round, userId) {
  if (round.status !== 'booked') throw new UserError('Встреча ещё не назначена');
  run("UPDATE rounds SET status='scheduling', slot=NULL, booker_id=NULL WHERE id=?", round.id);
  emit('unbooked', { roundId: round.id, by: userId });
}

/** Перевыбрать, если выпавшее место не подходит (закрыто, дорого и т.п.) */
export function reroll(round, userId) {
  if (round.status !== 'scheduling') throw new UserError('Перевыбрать можно только до брони');
  const bad = round.picked_card_id;
  tx(() => {
    run('DELETE FROM availability WHERE round_id=?', round.id);
    run('UPDATE participation SET slots_done=0 WHERE round_id=?', round.id);
    run(
      `INSERT INTO votes(round_id,user_id,card_id,value,stage,created_at) VALUES(?,?,?,-1,?,?)
       ON CONFLICT(round_id,user_id,card_id) DO UPDATE SET value=-1`,
      round.id, userId, bad, round.stage, Date.now(),
    );
    run(
      "UPDATE rounds SET status='extra', stage=2, picked_card_id=NULL, pick_reason=NULL, joker_user_id=NULL, deadline=? WHERE id=?",
      Date.now() + 24 * HOUR,
      round.id,
    );
    run('UPDATE participation SET done_stage=1 WHERE round_id=? AND done_stage>1', round.id);
  });
  emit('rerolled', { roundId: round.id, by: userId, cardId: bad });
  maybeClose(round.id);
}

export function finishMeeting(round) {
  run("UPDATE rounds SET status='done' WHERE id=?", round.id);
  run("UPDATE cards SET status='visited', visited_at=? WHERE id=?", Date.now(), round.picked_card_id);
  emit('meeting_done', { roundId: round.id });
}

/* ------------------------------------------------------------------ */
/* Воспоминания */

export function memoriesList() {
  return all("SELECT * FROM rounds WHERE status='done' ORDER BY slot DESC").map((r) => {
    const notes = all('SELECT * FROM memories WHERE round_id=?', r.id);
    const rated = notes.filter((n) => n.rating);
    return {
      roundId: r.id,
      slot: r.slot,
      human: humanSlot(r.slot),
      card: cardById(r.picked_card_id),
      avg: rated.length ? rated.reduce((a, n) => a + n.rating, 0) / rated.length : null,
      notes: notes.map((n) => ({ user: pubUser(userById(n.user_id)), rating: n.rating, comment: n.comment })),
      photos: all('SELECT id, path, user_id FROM memory_photos WHERE round_id=? ORDER BY id', r.id),
    };
  });
}

export function saveMemory(roundId, userId, rating, comment) {
  const r = roundById(roundId);
  if (!r || r.status !== 'done') throw new UserError('Эта встреча ещё не прошла');
  rating = rating ? Math.max(1, Math.min(5, Number(rating))) : null;
  run(
    `INSERT INTO memories(round_id,user_id,rating,comment,created_at) VALUES(?,?,?,?,?)
     ON CONFLICT(round_id,user_id) DO UPDATE SET rating=excluded.rating, comment=excluded.comment`,
    roundId, userId, rating, String(comment || '').slice(0, 2000), Date.now(),
  );
}

/* ------------------------------------------------------------------ */
/* Всё состояние для экрана «Неделя» */

export function buildState(userId) {
  const ms = members();
  const next = nextMeeting();
  const me = userById(userId);
  const state = {
    members: ms.map(pubUser),
    cadence: getSetting('cadence', 'biweekly'),
    daysSince: daysSinceLastMeeting(),
    jokerAvailable: me?.last_joker_month !== monthKey(new Date()),
    likesTarget: cfg.likesTarget,
    cardsCount: get("SELECT COUNT(*) n FROM cards WHERE status='active'").n,
    round: null,
  };
  const round = currentRound();
  if (!round) return state;

  const p = ensurePart(round.id, userId);
  const counts = myCounts(round.id, userId);
  const parts = Object.fromEntries(partsOf(round.id).map((x) => [x.user_id, x]));
  const r = {
    id: round.id,
    status: round.status,
    stage: round.stage,
    deadline: round.deadline,
    me: {
      moodSet: !!p.mood_set,
      moods: JSON.parse(p.moods),
      pass: !!p.pass,
      done: p.done_stage >= round.stage,
      likes: counts.likes,
      votes: counts.votes,
      jokerCardId: p.joker_card_id,
      slotsDone: !!p.slots_done,
    },
    progress: ms.map((m) => {
      const x = parts[m.id] || {};
      return {
        user: pubUser(m),
        pass: !!x.pass,
        done: (x.done_stage || 0) >= round.stage,
        votes: myCounts(round.id, m.id).votes,
        slotsDone: !!x.slots_done,
      };
    }),
  };
  if (OPEN.includes(round.status)) {
    if (round.stage === 2) r.partials = partialMatches(round.id);
  } else {
    r.card = cardById(round.picked_card_id);
    r.reason = round.pick_reason;
    r.jokerBy = pubUser(userById(round.joker_user_id));
    r.partials = partialMatches(round.id, round.picked_card_id);
    r.schedule = scheduleView(round, userId);
  }
  if (round.status === 'booked') {
    r.slot = round.slot;
    r.slotHuman = humanSlot(round.slot);
    r.booker = pubUser(userById(round.booker_id));
  }
  state.round = r;
  if (next && next.id !== round.id) state.nextMeeting = { human: humanSlot(next.slot) };
  return state;
}
