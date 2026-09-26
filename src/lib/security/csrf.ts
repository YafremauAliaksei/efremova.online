/**
 * Проверка источника изменяющего запроса (защита от CSRF).
 *
 * Браузер сам сообщает, откуда пришёл запрос: Sec-Fetch-Site и Origin.
 * Чужой сайт не может ни убрать, ни подделать их — это делает браузер.
 *
 * ⚠️ С ЧЕМ СРАВНИВАТЬ ORIGIN
 *
 * Раньше Origin сравнивался с request.nextUrl.origin. В standalone-сборке
 * это адрес, который слушает сам сервер (http://localhost:3000), а не домен
 * сайта: за nginx браузер присылал Origin https://efremova.online, сравнение
 * не сходилось, и ЛЮБОЕ сохранение в админке получало 403. Проверено
 * запросом через заголовок Host 2026-09-26.
 *
 * Сравниваем с Host — доменом, на который браузер отправил запрос. Подделать
 * пару «Origin + Host» может curl, но не браузер жертвы, а CSRF — атака именно
 * через браузер жертвы. Схема (http/https) не сравнивается: за nginx
 * приложение видит http, а браузер — https; Sec-Fetch-Site и так говорит,
 * совпадает ли источник целиком.
 */
export function isSameOriginRequest(input: {
  origin: string | null;
  fetchSite: string | null;
  host: string | null;
}): boolean {
  const sameSite = input.fetchSite === 'same-origin' || input.fetchSite === 'none';
  return sameSite && (input.origin === null || originHost(input.origin) === input.host);
}

/** host из Origin; «null» и мусор — не домен и ни с чем не совпадают */
function originHost(origin: string): string | undefined {
  try {
    return new URL(origin).host;
  } catch {
    return undefined;
  }
}
