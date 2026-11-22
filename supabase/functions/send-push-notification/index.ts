// Spec 008 — Edge Function send-push-notification
// Deno runtime. Excluido de tsc de la app (ver tsconfig.json).
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  buildMessages,
  chunk,
  collectUnregisteredTokens,
  isRetryableStatus,
  parsePushRequest,
  timingSafeEqual,
  type ExpoPushMessage,
  type ExpoPushTicket,
} from './logic.ts';

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_BATCH_SIZE = 100;   // límite por petición de Expo Push API
const MAX_ATTEMPTS = 3;        // RNF-NOT-8.4 (SRS: RF-08, RF-10)

// Variables inyectadas por Supabase en el runtime de Edge Functions.
// Nunca se exponen al cliente.
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const WEBHOOK_SECRET = Deno.env.get('PUSH_WEBHOOK_SECRET') ?? '';

const json = (status: number, body: Record<string, unknown>) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function sendBatch(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let status: number | null = null;
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Accept-Encoding': 'gzip, deflate',
        },
        body: JSON.stringify(messages),
      });
      status = res.status;
      if (res.ok) {
        const payload = (await res.json()) as { data?: ExpoPushTicket[] };
        return payload.data ?? [];
      }
      lastError = `expo_http_${res.status}`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    }
    if (!isRetryableStatus(status) || attempt === MAX_ATTEMPTS) break;
    await delay(500 * attempt);   // 0.5 s, 1 s
  }
  throw new Error(lastError);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const provided = req.headers.get('x-koma-webhook-secret') ?? '';
  if (!WEBHOOK_SECRET || !timingSafeEqual(provided, WEBHOOK_SECRET)) {
    return json(401, { error: 'unauthorized' });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return json(400, { error: 'invalid_json' });
  }
  const pushReq = parsePushRequest(raw);
  if (!pushReq) return json(400, { error: 'invalid_payload' });

  const { data: rows, error: tokensError } = await supabase
    .from('device_tokens')
    .select('expo_push_token')
    .eq('user_id', pushReq.recipient_id);
  if (tokensError) {
    console.error(JSON.stringify({ event: pushReq.event, error: 'tokens_query_failed' }));
    return json(500, { error: 'tokens_query_failed' });
  }

  const tokens = (rows ?? []).map((r: { expo_push_token: string }) => r.expo_push_token);
  if (tokens.length === 0) return json(200, { sent: 0, failed: 0, removed: 0 });

  const messages = buildMessages(pushReq, tokens);
  const tickets: ExpoPushTicket[] = [];
  try {
    for (const batch of chunk(messages, EXPO_BATCH_SIZE)) {
      tickets.push(...(await sendBatch(batch)));
    }
  } catch (e) {
    console.error(JSON.stringify({ event: pushReq.event, error: 'expo_send_failed', detail: String(e) }));
    return json(502, { error: 'expo_send_failed' });
  }

  // RNF-NOT-8.5: limpieza de dispositivos inexistentes
  const invalid = collectUnregisteredTokens(messages, tickets);
  if (invalid.length > 0) {
    const { error: deleteError } = await supabase
      .from('device_tokens')
      .delete()
      .in('expo_push_token', invalid);
    if (deleteError) console.error(JSON.stringify({ event: pushReq.event, error: 'cleanup_failed' }));
  }

  const failed = tickets.filter((t) => t.status === 'error').length;
  // Privacidad: nunca se registran tokens, textos ni IDs de usuario en los logs.
  console.log(JSON.stringify({ event: pushReq.event, sent: tickets.length - failed, failed, removed: invalid.length }));
  return json(200, { sent: tickets.length - failed, failed, removed: invalid.length });
});
