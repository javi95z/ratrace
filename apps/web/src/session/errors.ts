/**
 * The stored life is no longer the one a session is playing: another tab played it on, finished
 * it, replaced it or abandoned it. Nothing was changed; the stored life should be opened again.
 *
 * It lives apart from the sessions that throw it, so that the round store can recognise it
 * without knowing which kind of session it is talking to.
 */
export class StaleSession extends Error {
  constructor() {
    super('the saved life has moved on without this session');
    this.name = 'StaleSession';
  }
}
