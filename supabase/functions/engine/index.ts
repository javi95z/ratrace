// The game's own engine, on the server.
//
// One job for now: play a game again from its seed and its log, and say where it stands. It is how
// the server sees a game for itself instead of taking a client's word, and it proves that the
// engine gives the same answers here as in the browser. It writes nothing.
//
// Only a signed-in player may call it; a guest is one. The platform checks the token before this
// code runs (`verify_jwt`, on by default) and `withSupabase` checks it again and reads who it is.
import { withSupabase } from 'npm:@supabase/server@1';
import { GAMES } from '../_shared/game/index.ts';
import { replayRequest } from '../_shared/replay.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
/** A whole life is a few dozen kilobytes of choices. Anything much larger is not a game. */
const MAX_BODY = 300_000;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

const play = withSupabase({ auth: 'user' }, async (req: Request) => {
  if (req.method !== 'POST') return json(405, { error: 'method-not-allowed' });
  const text = await req.text();
  if (text.length > MAX_BODY) return json(413, { error: 'too-large' });
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return json(400, { error: 'bad-request', field: 'body' });
  }
  const reply = replayRequest(GAMES, raw);
  return json(reply.status, reply.body);
});

export default {
  // A browser asks leave before it sends a token; that question carries none, so it is answered before the check.
  fetch: (req: Request) => (req.method === 'OPTIONS' ? new Response('ok', { headers: CORS }) : play(req)),
};
