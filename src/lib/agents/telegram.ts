import { safeFetch } from '@/lib/safeFetch';

const api = (token: string, method: string) => `https://api.telegram.org/bot${token}/${method}`;
async function call<T>(token: string, method: string, body?: unknown): Promise<{ ok: boolean; result?: T; description?: string }> {
  try {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 10_000);
    const res = await safeFetch(api(token, method), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body ?? {}), signal: ctl.signal }); clearTimeout(t);
    return await res.json() as { ok: boolean; result?: T; description?: string };
  } catch { return { ok: false, description: 'Could not reach Telegram.' }; }
}
export const validToken = (t: string) => /^\d{6,12}:[A-Za-z0-9_-]{30,50}$/.test(t);
export const getMe = (token: string) => call<{ username: string; first_name: string }>(token, 'getMe');
export const setWebhook = (token: string, url: string, secret: string) => call<boolean>(token, 'setWebhook', { url, secret_token: secret, allowed_updates: ['message'], drop_pending_updates: true });
export const deleteWebhook = (token: string) => call<boolean>(token, 'deleteWebhook', { drop_pending_updates: true });
export const sendMessage = (token: string, chatId: number | string, text: string) => call(token, 'sendMessage', { chat_id: chatId, text: text.slice(0, 3800), disable_web_page_preview: true });
