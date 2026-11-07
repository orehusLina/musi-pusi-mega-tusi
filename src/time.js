import { BLOCKS } from './config.js';

export const DAY = 864e5;
export const HOUR = 36e5;
export const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

export function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** 'YYYY-MM-DD@HH' или 'YYYY-MM-DD@HH:MM' -> Date (локальное время сервера, TZ из окружения) */
export function slotToDate(slot) {
  const [d, t] = slot.split('@');
  const [hh, mm = '0'] = t.split(':');
  const base = parseDateKey(d);
  base.setHours(Number(hh), Number(mm), 0, 0);
  return base;
}

const WD = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];
const MONTHS = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];

export function humanDate(d) {
  return `${WD[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

export function humanSlot(slot) {
  const d = slotToDate(slot);
  const t = slot.split('@')[1];
  if (t.includes(':')) return `${humanDate(d)}, ${t}`;
  const b = BLOCKS.find((x) => x.h === t);
  return `${humanDate(d)}, ${b ? `${b.label} (${b.range})` : `${t}:00`}`;
}

export function daysBetween(a, b) {
  const da = new Date(a); da.setHours(0, 0, 0, 0);
  const dbb = new Date(b); dbb.setHours(0, 0, 0, 0);
  return Math.round((dbb - da) / DAY);
}
