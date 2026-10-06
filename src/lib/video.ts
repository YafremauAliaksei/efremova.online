/**
 * Ролики YouTube на сайте без YouTube на странице (docs/13, п.1.1).
 *
 * Плеера нет: встроенный плеер — это скрипты и cookie Google на каждой
 * странице и IP каждого посетителя у Google ещё до щелчка. Вместо него —
 * карточка с обложкой со своего домена. Щелчок ведёт сначала на свою
 * страницу-предупреждение, и только оттуда, по второму щелчку, — на YouTube.
 *
 * Из базы и из формы берётся только id ролика (11 знаков); адреса
 * собираются здесь. Чужой адрес в карточку не попадёт.
 *
 * Файл без 'server-only' и без сети: чистые функции, их проверяют тесты.
 */

const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

export function isVideoId(value: unknown): value is string {
  return typeof value === 'string' && VIDEO_ID.test(value);
}

const YOUTUBE_HOSTS = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
  'music.youtube.com',
  'youtube-nocookie.com',
  'www.youtube-nocookie.com',
  'youtu.be',
]);

/**
 * id ролика из того, что вставил владелец: ссылка из адресной строки,
 * «Поделиться» (youtu.be), Shorts, встраивание или сам id. Ссылка на
 * другой сайт, канал или плейлист без ролика — null.
 */
export function parseVideoId(raw: string): string | null {
  const value = raw.trim();
  if (VIDEO_ID.test(value)) return value;

  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
  } catch {
    return null;
  }
  if (!YOUTUBE_HOSTS.has(url.hostname.toLowerCase())) return null;

  const candidate =
    url.hostname.toLowerCase() === 'youtu.be'
      ? url.pathname.split('/')[1]
      : (url.searchParams.get('v') ??
        /^\/(?:shorts|embed|live|v)\/([^/]+)/.exec(url.pathname)?.[1]);
  return isVideoId(candidate) ? candidate : null;
}

/** Ролик на YouTube — куда ведёт кнопка на странице-предупреждении */
export function youtubeWatchUrl(id: string): string {
  return `https://www.youtube.com/watch?v=${id}`;
}

/**
 * Обложки ролика: сначала крупная (1280×720, есть не у всех роликов),
 * затем стандартная (480×360). Их скачивает сервер при сохранении блока —
 * браузер посетителя к YouTube за обложкой не обращается.
 */
export function thumbnailUrls(id: string): string[] {
  return [
    `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`,
    `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
  ];
}

/** Своя страница-предупреждение перед переходом (без языка — его добавит ссылка) */
export function leavePath(id: string): string {
  return `/out/youtube/${id}`;
}
