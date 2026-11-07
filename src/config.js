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
};

export const TAGS = {
  culture: 'Культура',
  active: 'Активное',
  relax: 'Отдых',
  food: 'Еда',
  party: 'Вечеринка',
  nature: 'Природа',
  creative: 'Творчество',
  new: 'Новый опыт',
};

export const MOODS = { cheap: 'Бюджетно', ...TAGS };

export const BLOCKS = [
  { h: '10', key: 'morning', label: 'утро', range: '10–13' },
  { h: '13', key: 'day', label: 'день', range: '13–17' },
  { h: '17', key: 'evening', label: 'вечер', range: '17–21' },
  { h: '21', key: 'night', label: 'ночь', range: '21–00' },
];

export const DURATION_HOURS = { short: 2, half: 4, day: 8 };
