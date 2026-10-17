/**
 * Everything of the game a server needs, as one module: the engine, and the content of one
 * version. `pnpm online:bundle` turns this into a single file an Edge Function can import.
 */
export { ENGINE_VERSION, finalScore, livedStatus, realNetWorth, replayLog, SEED_BITS, stateHash, viewOf } from '@ratrace/engine';
export { challengeOf, challengeStart, content, CONTENT_VERSION, lives, replayLife, roomStart, stepLife } from '@ratrace/content';
