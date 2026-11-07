import path from 'node:path';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const cfg = {
  botToken: process.env.BOT_TOKEN || '',
  inviteCode: (process.env.INVITE_CODE || '').trim(),
  publicUrl: (process.env.PUBLIC_URL || '').replace(/\/+$/, ''),
  tunnelMetricsUrl: process.env.TUNNEL_METRICS_URL || '',
  port: num(process.env.PORT, 3000),
  dataDir: path.resolve(process.env.DATA_DIR || './data'),
  // Только для локальной проверки без Telegram: заголовок "Authorization: dev <id>:<имя>"
  devAuth: process.env.DEV_AUTH === '1',
  lat: num(process.env.CITY_LAT, 55.7558),
  lon: num(process.env.CITY_LON, 37.6173),
  // Сколько лайков достаточно поставить за раунд, чтобы считаться «отметилась»
  likesTarget: num(process.env.LIKES_TARGET, 3),
  // После скольких карточек раунд для человека считается пройденным
  maxShown: num(process.env.MAX_SHOWN, 10),
  // Необязательно: Gemini разбирает текст/страницу и заполняет поля карточки
  geminiKey: process.env.GEMINI_API_KEY || '',
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  geminiFallback: process.env.GEMINI_FALLBACK_MODEL || 'gemini-2.5-flash-lite',
};

// Категории карточек. Ключи не переименовывать — они хранятся в базе.
export const TAGS = {
  culture: 'Выставки и музеи',
  theatre: 'Театр',
  music: 'Концерты',
  cinema: 'Кино',
  learn: 'Лекции и воркшопы',
  conference: 'Конференции и митапы',
  hackathon: 'Хакатоны',
  party: 'Вечеринки',
  food: 'Еда',
  market: 'Маркеты и шопинг',
  active: 'Спорт и движение',
  games: 'Игры и квесты',
  nature: 'Природа и прогулки',
  trip: 'За город',
  relax: 'Отдых',
  beauty: 'Красота и спа',
  creative: 'Творчество',
  new: 'Новый опыт',
};

// Настроения недели — крупнее категорий: каждое подходит к нескольким категориям
export const MOODS = {
  cheap: 'Бюджетно',
  culture: 'Культурно',
  active: 'Подвигаться',
  relax: 'Отдохнуть',
  food: 'Вкусно поесть',
  party: 'Потусить',
  nature: 'На воздухе',
  creative: 'Сделать что-то руками',
  grow: 'Прокачаться',
  new: 'Что-то новое',
};

export const MOOD_TAGS = {
  culture: ['culture', 'theatre', 'music', 'cinema', 'learn'],
  active: ['active', 'games', 'trip'],
  relax: ['relax', 'beauty', 'nature'],
  food: ['food', 'market'],
  party: ['party', 'music', 'games'],
  nature: ['nature', 'trip'],
  creative: ['creative', 'learn'],
  grow: ['learn', 'conference', 'hackathon'],
  new: ['new', 'games', 'hackathon'],
};

export const BLOCKS = [
  { h: '10', key: 'morning', label: 'утро', range: '10–13' },
  { h: '13', key: 'day', label: 'день', range: '13–17' },
  { h: '17', key: 'evening', label: 'вечер', range: '17–21' },
  { h: '21', key: 'night', label: 'ночь', range: '21–00' },
];

export const DURATION_HOURS = { short: 2, half: 4, day: 8 };
