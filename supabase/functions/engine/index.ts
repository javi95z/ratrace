// The game's own engine, on the server.
//
// Plays a game again from its seed and its log, and says where it stands. It is how the server
// sees a game for itself instead of taking a client's word, and it proves that the engine gives
// the same answers here as in the browser. It writes nothing.
//
// Only a signed-in player may call it; a guest is one. The platform checks the token before this
// code runs (`verify_jwt`, on by default), and `withSupabase` checks it again, reads who it is,
// and answers a browser's preflight with the headers the Supabase client sends.
import { withSupabase } from 'npm:@supabase/server@1.9.0';
import { GAMES } from '../_shared/game/index.ts';
import { json, readJson } from '../_shared/http.ts';
import { replayRequest } from '../_shared/replay.ts';

export default {
  fetch: withSupabase({ auth: 'user' }, async (req: Request) => {
    const read = await readJson(req);
    if ('refusal' in read) return read.refusal;
    const reply = replayRequest(GAMES, read.value);
    return json(reply.status, reply.body);
  }),
};
