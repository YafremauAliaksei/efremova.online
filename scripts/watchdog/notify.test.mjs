import { describe, expect, it } from 'vitest';
import { configuredChannels, heartbeatUrl, sendAll } from './notify.mjs';

const TOKEN = '123456789:AAAbbbCCCdddEEEfffGGGhhhIIIjjjKKKl';

describe('каналы оповещений', () => {
  it('ничего не задано — ни каналов, ни ошибок', () => {
    expect(configuredChannels({})).toEqual({ channels: [], problems: [] });
  });

  it('Telegram с верным токеном и id', () => {
    const { channels, problems } = configuredChannels({
      ALERT_TELEGRAM_BOT_TOKEN: TOKEN,
      ALERT_TELEGRAM_CHAT_ID: '42',
    });
    expect(problems).toEqual([]);
    expect(channels.map((c) => c.name)).toEqual(['telegram']);
  });

  it.each([
    ['токен с чужим хостом', 'x@evil.example/', '42'],
    ['id не число', TOKEN, 'me'],
    ['задан только id', '', '42'],
  ])('Telegram: %s — канал не включается, ошибка видна', (_name, token, chatId) => {
    const { channels, problems } = configuredChannels({
      ALERT_TELEGRAM_BOT_TOKEN: token,
      ALERT_TELEGRAM_CHAT_ID: chatId,
    });
    expect(channels).toEqual([]);
    expect(problems).toHaveLength(1);
  });

  it('ntfy только по https', () => {
    expect(configuredChannels({ ALERT_NTFY_URL: 'http://ntfy.sh/x' }).channels).toEqual([]);
    expect(configuredChannels({ ALERT_NTFY_URL: 'https://ntfy.sh/topic' }).channels).toHaveLength(
      1
    );
  });

  it('почта требует адресатов и ключ', () => {
    expect(configuredChannels({ ALERT_EMAIL_TO: 'me@example.com' }).problems).toHaveLength(1);
    const full = configuredChannels({
      ALERT_EMAIL_TO: 'me@example.com',
      ALERT_EMAIL_FROM: 'watchdog@example.com',
      ALERT_RESEND_API_KEY: 're_abcdefghijkl',
    });
    expect(full.channels.map((c) => c.name)).toEqual(['email']);
  });

  it('пульс только по https', () => {
    expect(heartbeatUrl('https://hc-ping.com/uuid')).toBe('https://hc-ping.com/uuid');
    expect(heartbeatUrl('http://hc-ping.com/uuid')).toBeNull();
    expect(heartbeatUrl(undefined)).toBeNull();
  });
});

describe('отправка', () => {
  it('сбой одного канала не мешает другим, токен не попадает в журнал', async () => {
    const { channels } = configuredChannels({
      ALERT_TELEGRAM_BOT_TOKEN: TOKEN,
      ALERT_TELEGRAM_CHAT_ID: '42',
      ALERT_NTFY_URL: 'https://ntfy.sh/topic',
    });
    const calls = [];
    const fakeFetch = (url) => {
      calls.push(url);
      return Promise.resolve({ ok: !String(url).includes('telegram'), status: 401 });
    };
    const log = [];
    await sendAll(channels, 'текст', fakeFetch, (line) => log.push(line));

    expect(calls).toHaveLength(2);
    expect(log).toHaveLength(1);
    expect(log[0]).toContain('telegram');
    expect(log[0]).not.toContain(TOKEN);
  });
});
