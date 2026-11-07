import dns from 'node:dns/promises';
import net from 'node:net';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { cfg } from './config.js';

/* ---------------- Безопасная загрузка чужих страниц (превью ссылок) ---------------- */

function isPrivateIp(ip) {
  if (net.isIPv6(ip)) {
    const l = ip.toLowerCase();
    if (l.startsWith('::ffff:')) return isPrivateIp(l.slice(7));
    return l === '::1' || l === '::' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80');
  }
  const [a, b] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

async function safeFetch(rawUrl, accept) {
  let url = new URL(rawUrl);
  for (let hop = 0; hop < 5; hop++) {
    if (!/^https?:$/.test(url.protocol)) throw new Error('bad protocol');
    const { address } = await dns.lookup(url.hostname);
    if (isPrivateIp(address)) throw new Error('private address');
    const res = await fetch(url, {
      redirect: 'manual',
      signal: AbortSignal.timeout(8000),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; KudaShodimBot/1.0; +https://telegram.org)',
        'accept-language': 'ru,en;q=0.8',
        accept,
      },
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = new URL(res.headers.get('location'), url);
      continue;
    }
    return { res, url };
  }
  throw new Error('too many redirects');
}

async function readLimited(res, limit) {
  const reader = res.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > limit) {
      reader.cancel().catch(() => {});
      if (chunks.length) break;
      throw new Error('too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks);
}

const decode = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&nbsp;/g, ' ').trim();

export async function linkPreview(rawUrl) {
  const out = { title: '', description: '', image: '' };
  try {
    const { res, url } = await safeFetch(rawUrl, 'text/html,application/xhtml+xml');
    if (!res.ok) return out;
    const html = (await readLimited(res, 1_500_000)).toString('utf8');
    const meta = {};
    for (const m of html.matchAll(/<meta\s[^>]*>/gi)) {
      const tag = m[0];
      const key = (tag.match(/(?:property|name)\s*=\s*["']([^"']+)["']/i) || [])[1];
      const val = (tag.match(/content\s*=\s*["']([^"']*)["']/i) || [])[1];
      if (key && val && !(key.toLowerCase() in meta)) meta[key.toLowerCase()] = decode(val);
    }
    const titleTag = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1];
    out.title = meta['og:title'] || meta['twitter:title'] || (titleTag ? decode(titleTag) : '');
    out.description = meta['og:description'] || meta['description'] || meta['twitter:description'] || '';
    const img = meta['og:image'] || meta['og:image:url'] || meta['twitter:image'];
    if (img) {
      try {
        out.image = await downloadImage(new URL(img, url).toString());
      } catch {
        /* картинку не отдали — не страшно */
      }
    }
  } catch (e) {
    console.warn('preview failed', rawUrl, e.message);
  }
  out.title = out.title.slice(0, 140);
  out.description = out.description.slice(0, 500);
  return out;
}

const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif' };

export async function saveUpload(buf, mime) {
  const ext = EXT[mime];
  if (!ext) throw new Error('unsupported image type');
  const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  await fs.writeFile(path.join(cfg.dataDir, 'uploads', name), buf);
  return `/uploads/${name}`;
}

async function downloadImage(url) {
  const { res } = await safeFetch(url, 'image/*');
  const mime = (res.headers.get('content-type') || '').split(';')[0].trim();
  if (!res.ok || !EXT[mime]) throw new Error('not an image');
  return saveUpload(await readLimited(res, 6_000_000), mime);
}

/* ---------------- Погода (Open-Meteo, без ключа) ---------------- */

let weatherCache = { at: 0, data: {} };

const ICONS = [
  [[0], '☀️'], [[1, 2], '🌤️'], [[3], '☁️'], [[45, 48], '🌫️'],
  [[51, 53, 55, 56, 57, 61, 63, 80, 81], '🌦️'], [[65, 66, 67, 82], '🌧️'],
  [[71, 73, 75, 77, 85, 86], '🌨️'], [[95, 96, 99], '⛈️'],
];
const icon = (code) => (ICONS.find(([codes]) => codes.includes(code)) || [null, '🌡️'])[1];

/** { 'YYYY-MM-DD': { icon, tmax, rain } } на ~2 недели вперёд */
export async function weather() {
  if (Date.now() - weatherCache.at < 3 * 3600e3) return weatherCache.data;
  try {
    const u = `https://api.open-meteo.com/v1/forecast?latitude=${cfg.lat}&longitude=${cfg.lon}` +
      '&daily=weather_code,temperature_2m_max,precipitation_probability_max&timezone=auto&forecast_days=16';
    const res = await fetch(u, { signal: AbortSignal.timeout(6000) });
    const j = await res.json();
    const data = {};
    j.daily.time.forEach((d, i) => {
      data[d] = {
        icon: icon(j.daily.weather_code[i]),
        tmax: Math.round(j.daily.temperature_2m_max[i]),
        rain: j.daily.precipitation_probability_max[i] ?? null,
      };
    });
    weatherCache = { at: Date.now(), data };
  } catch (e) {
    console.warn('weather failed', e.message);
    weatherCache.at = Date.now() - 2.5 * 3600e3; // повторим через полчаса
  }
  return weatherCache.data;
}
