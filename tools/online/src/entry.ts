/**
 * Everything of the game a server needs, as one module: the engine, and the content of one
 * version. `pnpm online:bundle` turns this into a single file an Edge Function can import.
 */
export { ENGINE_VERSION, finalScore, livedStatus, realNetWorth, replayLog, stateHash } from '@ratrace/engine';
export { content, CONTENT_VERSION, lives } from '@ratrace/content';
