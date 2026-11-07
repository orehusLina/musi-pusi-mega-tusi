import fs from 'node:fs/promises';
import path from 'node:path';
import { db, all, run, getSetting, setSetting } from './db.js';
import { cfg } from './config.js';
import * as L from './logic.js';
import { reminders } from './bot.js';
import { cleanupUploads } from './fetchers.js';
import { dateKey, slotToDate, daysBetween, HOUR } from './time.js';

/** Все пути к фото, на которые что-то ссылается (в любых карточках, включая черновики и архив). */
export function referencedUploads() {
  const refs = new Set();
  for (const c of all('SELECT photo, photos FROM cards')) {
    if (c.photo) refs.add(c.photo);
    for (const p of JSON.parse(c.photos || '[]')) refs.add(p);
  }
  for (const m of all('SELECT path FROM memory_photos')) refs.add(m.path);
  return refs;
}

/** Выполнить job не чаще раза за ключ (например, раз в день) — переживает перезапуски. */
async function once(key, fn) {
  if (getSetting(`job:${key}`)) return;
  setSetting(`job:${key}`, Date.now());
  await fn();
}

export async function backupDb(tag) {
  const dir = path.join(cfg.dataDir, 'backups');
  await fs.mkdir(dir, { recursive: true });
  await db.backup(path.join(dir, `app-${tag}.db`));
  const files = (await fs.readdir(dir)).filter((f) => /^app-.+\.db$/.test(f)).sort();
  for (const f of files.slice(0, Math.max(0, files.length - 14))) await fs.unlink(path.join(dir, f));
  console.log(`backup: app-${tag}.db`);
}

async function tick() {
  const now = new Date();
  const today = dateKey(now);
  const h = now.getHours();
  const dow = now.getDay(); // 0 = вс, 6 = сб
  let round = L.currentRound();

  // Дедлайны голосования
  if (round && ['voting', 'extra'].includes(round.status)) {
    L.closeByDeadline(round);
    round = L.currentRound();
  }

  // Суббота 11:00 — новый раунд (с учётом «раз в неделю / раз в две недели»)
  if (dow === 6 && h >= 11) {
    await once(`saturday:${today}`, async () => {
      if (L.currentRound()) return;
      const days = L.daysSinceLastMeeting();
      if (getSetting('cadence', 'biweekly') === 'biweekly' && days !== null && days < 9) return;
      try {
        L.startRound(null);
      } catch (e) {
        console.warn('auto round skipped:', e.message);
      }
    });
  }

  // Напоминание тем, кто ещё не проголосовал: за ~8 часов до дедлайна
  if (round && ['voting', 'extra'].includes(round.status) && round.deadline - now.getTime() < 8 * HOUR) {
    await once(`votes:${round.id}:${round.stage}`, () => reminders.votes(round));
  }

  // Ежедневно в 12:00 — кто не отметил свободное время
  if (round?.status === 'scheduling' && h >= 12 && now.getTime() - round.closed_at > 12 * HOUR) {
    await once(`slots:${round.id}:${today}`, async () => {
      const ids = all('SELECT user_id FROM participation WHERE round_id=? AND slots_done=0', round.id).map((r) => r.user_id);
      const members = L.members().map((m) => m.id);
      await reminders.slots(round, ids.filter((id) => members.includes(id)));
    });
  }

  if (round?.status === 'booked') {
    const start = slotToDate(round.slot);
    // Накануне, с 12:00 — напоминание с погодой
    if (!round.reminded_before && daysBetween(now, start) === 1 && h >= 12) {
      run('UPDATE rounds SET reminded_before=1 WHERE id=?', round.id);
      await reminders.dayBefore(round);
    }
    // Через 6 часов после начала — встреча прошла, просим оценку и фотки
    if (now.getTime() > start.getTime() + 6 * HOUR) L.finishMeeting(round);
  }

  // Каждую ночь в 4:00 — бэкап базы (храним 14 последних) и удаление ненужных фото
  if (h === 4) {
    await once(`backup:${today}`, () => backupDb(today));
    await once(`cleanup:${today}`, async () => {
      const { removed, freed } = await cleanupUploads(referencedUploads());
      if (removed) console.log(`cleanup: removed ${removed} files, freed ${Math.round(freed / 1024)} KB`);
    });
  }

  // Среда 19:00 — если давно не виделись и ничего не запущено
  if (dow === 3 && h >= 19 && !L.currentRound()) {
    await once(`nudge:${today}`, async () => {
      const days = L.daysSinceLastMeeting();
      if (days !== null && days >= 14) await reminders.nudge(days);
    });
  }
}

export function startScheduler() {
  const safe = () => tick().catch((e) => console.error('tick failed', e));
  setTimeout(safe, 5_000);
  setInterval(safe, 60_000);
}
