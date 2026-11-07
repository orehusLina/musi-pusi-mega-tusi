import { Bot, InputFile } from 'grammy';
import { cfg, DURATION_HOURS, TAGS } from './config.js';
import { extractIdea } from './ai.js';
import { run } from './db.js';
import * as L from './logic.js';
import { upsertUser, joinGroup, createDraftCard, cleanLinks } from './api.js';
import { linkPreview, weather, saveUpload } from './fetchers.js';
import { slotToDate, humanDate, humanSlot, dateKey } from './time.js';

/* ---------------- Публичный адрес (свой домен или быстрый туннель Cloudflare) ---------------- */

export const pub = { url: cfg.publicUrl };
let bot = null;

async function refreshTunnelUrl() {
  if (cfg.publicUrl || !cfg.tunnelMetricsUrl) return;
  try {
    const j = await (await fetch(cfg.tunnelMetricsUrl, { signal: AbortSignal.timeout(4000) })).json();
    const url = j.hostname ? `https://${j.hostname}` : '';
    if (url && url !== pub.url) {
      pub.url = url;
      console.log('public url:', url);
      await setMenuButton();
    }
  } catch {
    /* туннель ещё поднимается */
  }
}

async function setMenuButton() {
  if (!bot || !pub.url.startsWith('https://')) return;
  try {
    await bot.api.setChatMenuButton({ menu_button: { type: 'web_app', text: 'Открыть', web_app: { url: pub.url } } });
  } catch (e) {
    console.error('setChatMenuButton failed', e.message);
  }
}

/* ---------------- Отправка сообщений ---------------- */

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const names = (users) => users.map((u) => u.name).join(', ');

function keyboard(text, hash = '') {
  if (!pub.url.startsWith('https://')) return undefined;
  // Путь экрана передаём в query (?r=…): Telegram перезаписывает #hash своими параметрами запуска
  return { inline_keyboard: [[{ text, web_app: { url: `${pub.url}/${hash ? `?r=${encodeURIComponent(hash)}` : ''}` } }]] };
}

async function send(userId, html, button) {
  if (!bot) {
    console.log(`[to ${userId}] ${html.replace(/<[^>]+>/g, '')}`);
    return;
  }
  try {
    await bot.api.sendMessage(userId, html, {
      parse_mode: 'HTML',
      link_preview_options: { is_disabled: true },
      reply_markup: button ? keyboard(...button) : undefined,
    });
  } catch (e) {
    console.warn('send failed', userId, e.description || e.message);
  }
}

const toAll = (html, button, except = null) =>
  Promise.all(L.members().filter((m) => m.id !== except).map((m) => send(m.id, html, button)));

function deadlineText(ts) {
  const d = new Date(ts);
  return `${humanDate(d)}, ${String(d.getHours()).padStart(2, '0')}:00`;
}

function icsFor(round, card) {
  const start = slotToDate(round.slot);
  const end = new Date(start.getTime() + (DURATION_HOURS[card.duration] || 3) * 3600e3);
  const utc = (d) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const e = (s) => String(s || '').replace(/\r/g, '').replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => `\\${m}`).replace(/\n/g, '\\n');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//kuda-shodim//RU', 'CALSCALE:GREGORIAN', 'BEGIN:VEVENT',
    `UID:round-${round.id}-${round.slot.replace(/\W/g, '')}@kuda-shodim`,
    `DTSTAMP:${utc(new Date())}`, `DTSTART:${utc(start)}`, `DTEND:${utc(end)}`,
    `SUMMARY:${e(card.title)}`,
    `DESCRIPTION:${e([card.why, ...(card.links || []).map((l) => (l.label ? `${l.label}: ${l.url}` : l.url))].filter(Boolean).join('\n\n'))}`,
    card.area ? `LOCATION:${e(card.area)}` : null,
    card.link ? `URL:${card.link}` : null,
    'BEGIN:VALARM', 'TRIGGER:-PT3H', 'ACTION:DISPLAY', 'DESCRIPTION:Скоро встреча', 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

function partialsText(roundId, excludeId) {
  const ps = L.partialMatches(roundId, excludeId).filter((p) => p.count >= 2);
  if (!ps.length) return '';
  return '\n\n<b>Совпало у части из вас</b> — можно сходить своим составом:\n' +
    ps.map((p) => `• ${esc(p.card.title)} — ${p.count} из ${p.of} (${esc(names(p.likedBy))})`).join('\n');
}

/* ---------------- Тексты ---------------- */

const HOW_IT_WORKS =
  '<b>Как это работает</b>\n\n' +
  '<b>1. Идеи.</b> Каждая добавляет места и события, куда хотелось бы сходить. Проще всего — прислать мне ссылку, переслать пост о мероприятии или описать его парой строк: я сделаю черновик карточки.\n\n' +
  '<b>2. Голосование.</b> По субботам я присылаю приглашение. Открываешь приложение и отмечаешь несколько карточек: «очень хочу», «можно» или «нет». Это занимает пару минут. Если неделя занята — нажми «пропускаю».\n\n' +
  '<b>3. Выбор.</b> Когда все отметились, я случайно выбираю одну активность из тех, что подошли всем. Если общего нет — покажу частичные совпадения и попрошу быстро довыбрать.\n\n' +
  '<b>4. Время.</b> Каждая отмечает, когда свободна в ближайшие две недели, — я покажу время, которое подходит всем. Нажимаете «Бронируем», и всем приходит файл для календаря.\n\n' +
  '<b>5. После встречи</b> можно поставить оценку и добавить фото.';

/* ---------------- Реакции на события ---------------- */

const handlers = {
  async round_started({ roundId, by }) {
    const r = L.roundById(roundId);
    const who = by ? `${esc(L.userById(by)?.name)} начала голосование.\n\n` : '';
    await toAll(
      `${who}<b>Куда идём на этой неделе?</b>\n\nОтметь несколько карточек — что хочется, а что нет. ` +
        `Если неделя занята, можно пропустить.\n\nГолосуем до <b>${deadlineText(r.deadline)}</b>.`,
      ['Голосовать'],
      by,
    );
  },
  async extra_round({ roundId }) {
    const r = L.roundById(roundId);
    await toAll(
      '<b>Общего совпадения пока нет.</b>' + partialsText(roundId) +
        `\n\nЧтобы выбрать что-то для всех, посмотри карточки, которые понравились остальным. Это пара минут, до <b>${deadlineText(r.deadline)}</b>.`,
      ['Довыбрать'],
    );
  },
  async picked({ roundId }) {
    const r = L.roundById(roundId);
    const c = L.cardById(r.picked_card_id);
    const why = {
      consensus: 'Подошло всем — выбрано случайно из общих совпадений.',
      best: 'Лучший вариант: никто не против.',
      joker: `${esc(L.userById(r.joker_user_id)?.name)} использовала джокер.`,
    }[r.pick_reason];
    await toAll(
      `<b>Выбрано: ${esc(c.title)}</b>\n${why}${partialsText(roundId, c.id)}\n\nТеперь отметь, когда ты свободна в ближайшие две недели.`,
      ['Отметить время'],
    );
  },
  async round_skipped({ reason }) {
    await toAll(
      reason === 'nothing'
        ? 'В этот раз ничего не совпало. Добавьте новых идей — в субботу попробуем снова.'
        : 'На этой неделе пропускаем: участвовать могут меньше двух человек. В субботу спрошу снова.',
      ['Открыть'],
    );
  },
  async slots_ready({ roundId }) {
    const r = L.roundById(roundId);
    const v = L.scheduleView(r, 0);
    const best = v.ranking[0];
    const text = best
      ? `Лучший вариант: <b>${esc(best.human)}</b> — свободны ${best.count} из ${v.total}.`
      : 'Общего времени пока нет. Попробуйте отметить больше вариантов.';
    await toAll(`<b>Все отметили время.</b>\n${text}\n\nОсталось нажать «Бронируем».`, ['Забронировать']);
  },
  async booked({ roundId }) {
    const r = L.roundById(roundId);
    const c = L.cardById(r.picked_card_id);
    const booker = r.booker_id ? `\nБронирует: <b>${esc(L.userById(r.booker_id)?.name)}</b>` : '';
    const html = `<b>Встреча назначена</b>\n\n${esc(c.title)}\n${esc(humanSlot(r.slot))}${booker}` +
      (c.link ? `\n${esc(c.link)}` : '') + '\n\nНиже файл — открой его, чтобы добавить встречу в календарь.';
    const ics = Buffer.from(icsFor(r, c), 'utf8');
    for (const m of L.members()) {
      await send(m.id, html, ['Открыть']);
      if (bot) {
        try {
          await bot.api.sendDocument(m.id, new InputFile(ics, 'vstrecha.ics'));
        } catch (e) {
          console.warn('ics failed', m.id, e.description || e.message);
        }
      }
    }
  },
  async unbooked({ by }) {
    await toAll(`${esc(L.userById(by)?.name)} отменила бронь — выбираем время заново.`, ['Открыть'], by);
  },
  async rerolled({ by, cardId }) {
    const c = L.cardById(cardId);
    await toAll(
      `${esc(L.userById(by)?.name)} отметила, что «${esc(c?.title)}» сейчас не подходит. Давайте быстро довыберем другое.`,
      ['Довыбрать'],
      by,
    );
  },
  async meeting_done() {
    await toAll('Как прошла встреча? Поставь оценку и добавь фото — они сохранятся во вкладке «Были».', ['Открыть', 'memories']);
  },
};

L.hooks.notify = async (event, data) => {
  const h = handlers[event];
  if (h) await h(data);
};

/* ---------------- Напоминания по расписанию (их вызывает scheduler) ---------------- */

export const reminders = {
  async votes(round) {
    for (const id of L.pendingVoters(round)) {
      await send(id, `Напоминаю: голосование идёт до <b>${deadlineText(round.deadline)}</b>. Отметь хотя бы одну карточку.`, ['Голосовать']);
    }
  },
  async slots(round, ids) {
    for (const id of ids) await send(id, 'Отметь, пожалуйста, когда ты свободна, — без тебя не получится подобрать время.', ['Отметить время']);
  },
  async dayBefore(round) {
    const c = L.cardById(round.picked_card_id);
    let w = '';
    const day = (await weather())[dateKey(slotToDate(round.slot))];
    if (day) {
      w = `\nПогода: ${day.tmax}°`;
      if (day.rain !== null) w += `, вероятность осадков ${day.rain}%`;
      if (c.outdoor && day.rain >= 60) w += '. Активность на улице — возможно, стоит взять зонт или перенести.';
    }
    const booking = round.booker_id ? `\n${esc(L.userById(round.booker_id)?.name)}, не забудь про бронь.` : '';
    await toAll(`<b>Завтра встреча:</b> ${esc(c.title)}\n${esc(humanSlot(round.slot))}${w}${booking}`, ['Открыть']);
  },
  async nudge(days) {
    await toAll(`Вы не виделись уже ${days} дней. Давайте выберем, куда сходить?`, ['Начать выбор']);
  },
};

/* ---------------- Сам бот ---------------- */

const isTelegramLink = (u) => /^https?:\/\/(t\.me|telegram\.me|telegram\.dog)\//i.test(u);

/**
 * Все ссылки сообщения: спрятанные под текстом («Купить билеты»), написанные адресом
 * и ссылка на сам пересланный пост из публичного канала. Внешние — первыми.
 */
export function messageLinks(msg) {
  const text = msg.text || msg.caption || '';
  const out = [];
  for (const e of msg.entities || msg.caption_entities || []) {
    if (e.type === 'text_link') out.push({ url: e.url, label: text.slice(e.offset, e.offset + e.length).trim() });
    else if (e.type === 'url') out.push({ url: text.slice(e.offset, e.offset + e.length), label: '' });
  }
  for (const m of text.matchAll(/https?:\/\/[^\s<>"]+/gi)) out.push({ url: m[0], label: '' });
  const o = msg.forward_origin;
  if (o?.type === 'channel' && o.chat?.username) {
    out.push({ url: `https://t.me/${o.chat.username}/${o.message_id}`, label: 'Пост в Telegram' });
  } else if (msg.forward_from_chat?.username && msg.forward_from_message_id) {
    out.push({ url: `https://t.me/${msg.forward_from_chat.username}/${msg.forward_from_message_id}`, label: 'Пост в Telegram' });
  }
  const clean = cleanLinks(out);
  return [...clean.filter((l) => !isTelegramLink(l.url)), ...clean.filter((l) => isTelegramLink(l.url))];
}
const BUDGET_TEXT = ['бесплатно', 'до 1000 ₽', '1000–3000 ₽', 'от 3000 ₽'];

/** Что нейросеть нашла в сообщении — коротко, чтобы сразу было видно, если что-то не так. */
function draftSummary(c) {
  const bits = [];
  if (c.tags?.length) bits.push(c.tags.map((t) => TAGS[t]).join(', '));
  if (c.fixed_at) bits.push(`📅 ${humanSlot(c.fixed_at.replace('T', '@'))}`);
  else if (c.available_until) bits.push(`📅 до ${humanDate(new Date(`${c.available_until}T12:00`))}`);
  if (c.budget !== null && c.budget !== undefined) bits.push(`💸 ${BUDGET_TEXT[c.budget]}`);
  if (c.area) bits.push(`📍 ${c.area}`);
  if (c.needs_booking) bits.push('🎟️ нужна бронь');
  if (c.links?.length) bits.push(`🔗 ${c.links.map((l) => l.label || new URL(l.url).hostname.replace(/^www\./, '')).join(', ')}`);
  return bits.length ? `\n${bits.map((b) => esc(b)).join('\n')}` : '';
}

export async function startBot() {
  setInterval(refreshTunnelUrl, 30_000);
  await refreshTunnelUrl();

  if (!cfg.botToken) {
    console.warn('BOT_TOKEN не задан — бот не запущен, уведомления пишутся в лог');
    return;
  }
  bot = new Bot(cfg.botToken);

  bot.use(async (ctx, next) => {
    if (ctx.from && ctx.chat?.type === 'private') {
      upsertUser(ctx.from);
      run('UPDATE users SET can_message=1 WHERE id=?', ctx.from.id);
    }
    await next();
  });

  const memberWelcome = async (ctx, fresh) => {
    const ms = L.members();
    const crew = ms.length > 1 ? `\n\nСейчас в компании: ${esc(names(ms))}.` : '';
    const first = fresh
      ? '<b>Готово, ты в компании.</b>' + crew +
        '\n\nДля начала добавь пару идей, куда хотелось бы сходить. Можно просто прислать мне ссылку, переслать пост или описать идею текстом.'
      : '<b>Привет!</b> Открой приложение кнопкой ниже. Чтобы добавить идею, пришли мне ссылку, перешли пост или опиши её текстом.' + crew;
    await ctx.reply(first, { parse_mode: 'HTML', reply_markup: keyboard('Открыть приложение') });
  };

  bot.command('start', async (ctx) => {
    const code = ctx.match?.trim();
    const wasMember = !!L.userById(ctx.from.id)?.is_member;
    if (!wasMember && code) {
      try {
        joinGroup(ctx.from.id, code);
      } catch {
        /* неверный код — попросим прислать */
      }
    }
    const isMember = !!L.userById(ctx.from.id).is_member;
    if (isMember) {
      if (!wasMember) await ctx.reply(HOW_IT_WORKS, { parse_mode: 'HTML' });
      return memberWelcome(ctx, !wasMember);
    }
    await ctx.reply(
      '<b>Привет!</b> Это бот, в котором мы с подругами вместе выбираем, куда сходить.\n\n' + HOW_IT_WORKS +
        '\n\n<b>Чтобы присоединиться, пришли мне код приглашения</b> — его знают подруги.',
      { parse_mode: 'HTML' },
    );
  });

  bot.command('help', (ctx) =>
    ctx.reply(
      HOW_IT_WORKS + '\n\n<b>Команды</b>\n/new — начать голосование сейчас\n/help — эта справка\n\nИли просто пришли ссылку, перешли пост или опиши идею текстом — сделаю черновик карточки.',
      { parse_mode: 'HTML', reply_markup: keyboard('Открыть приложение') },
    ),
  );

  bot.command('new', async (ctx) => {
    if (!L.userById(ctx.from.id)?.is_member) return ctx.reply('Сначала пришли код приглашения.');
    try {
      const r = L.startRound(ctx.from.id);
      await ctx.reply(r.started_by === ctx.from.id ? 'Голосование началось, всем отправлено приглашение.' : 'Голосование уже идёт.', {
        reply_markup: keyboard('Голосовать'),
      });
    } catch (e) {
      await ctx.reply(e.message);
    }
  });

  // Идея из сообщения: ссылка (берём название и картинку со страницы), пересланный пост с фото
  // или просто текст (первая строка — название, остальное — описание).
  bot.on(['message:text', 'message:photo'], async (ctx) => {
    const msg = ctx.message;
    const text = (msg.text || msg.caption || '').trim();
    const u = L.userById(ctx.from.id);
    if (!u.is_member) {
      if (!msg.text) return ctx.reply('Сначала пришли код приглашения — его знают подруги.');
      try {
        joinGroup(ctx.from.id, text);
        await ctx.reply(HOW_IT_WORKS, { parse_mode: 'HTML' });
        return memberWelcome(ctx, true);
      } catch (e) {
        return ctx.reply(e.status === 429 ? e.message : 'Это не похоже на код приглашения. Уточни его у подруг и пришли ещё раз.');
      }
    }
    const links = messageLinks(msg);
    const hasPhoto = !!msg.photo?.length;
    if (!links.length && !hasPhoto && text.length < 12) {
      return ctx.reply(
        'Чтобы добавить идею, пришли ссылку, перешли пост о мероприятии или просто опиши его парой строк: первая строка — название, дальше — подробности.',
        { reply_markup: keyboard('Открыть приложение') },
      );
    }
    const wait = await ctx.reply('Делаю черновик…');
    const photos = [];
    if (hasPhoto) {
      try {
        const f = await ctx.api.getFile(msg.photo[msg.photo.length - 1].file_id);
        const res = await fetch(`https://api.telegram.org/file/bot${cfg.botToken}/${f.file_path}`, { signal: AbortSignal.timeout(15000) });
        photos.push(await saveUpload(Buffer.from(await res.arrayBuffer()), 'image/jpeg'));
      } catch (e) {
        console.warn('photo download failed', e.message);
      }
    }
    // Страницу для разбора берём из «внешней» ссылки (сайт, билеты); пост в Telegram — только если больше ничего нет
    const external = links.find((l) => !isTelegramLink(l.url));
    const pageUrl = external?.url || (!text ? links[0]?.url : '');
    const rest = text.replace(/https?:\/\/[^\s<>"]+/gi, '').trim();
    const lines = rest.split('\n').map((x) => x.trim()).filter(Boolean);
    let page = {};
    if (pageUrl) {
      page = await linkPreview(pageUrl);
      if (page.image) photos.push(page.image);
    }
    let title = lines[0] || page.title || '';
    let why = lines.length > 1 ? lines.slice(1).join('\n') : page.description || '';
    if (!text && page.title) { title = page.title; why = page.description; }
    // Нейросеть: дата, цена, категория, место и т.д. Если не ответила — остаётся простой разбор выше.
    const ai = await extractIdea({ text: rest, url: pageUrl || '', page });
    const card = ai
      ? { ...ai, title: ai.title || title, why: ai.why || why, links, photos, budget: ai.budget ?? 1, duration: ai.duration || 'short' }
      : { title, why, links, photos };
    const id = createDraftCard(ctx.from.id, card);
    await ctx.api.editMessageText(
      ctx.chat.id,
      wait.message_id,
      `Черновик готов: <b>${esc(card.title || 'без названия')}</b>${ai ? draftSummary({ ...card, budget: ai.budget }) : ''}\n\n` +
        (ai ? 'Проверь, всё ли верно, и добавь в идеи.' : 'Проверь название, добавь категорию и детали — после этого идея попадёт в общий список.'),
      { parse_mode: 'HTML', reply_markup: keyboard('Дооформить карточку', `card/${id}/edit`) },
    );
  });

  bot.catch((e) => console.error('bot error', e.error?.message || e));
  await bot.api.setMyCommands([
    { command: 'start', description: 'Открыть приложение' },
    { command: 'new', description: 'Начать голосование сейчас' },
    { command: 'help', description: 'Как это работает' },
  ]);
  try {
    await bot.api.setMyDescription(
      'Бот для компании подруг: собираем идеи, куда сходить, раз в неделю голосуем, бот выбирает активность и подбирает время, удобное всем.',
    );
    await bot.api.setMyShortDescription('Вместе выбираем, куда сходить, и подбираем общее время.');
  } catch (e) {
    console.warn('description failed', e.message);
  }
  await setMenuButton();
  bot.start({ drop_pending_updates: false });
  console.log('bot started');
}
