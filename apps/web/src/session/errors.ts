/**
 * The stored life is no longer the one a session is playing: another tab played it on, finished
 * it, replaced it or abandoned it. Nothing was changed; the stored life should be opened again.
 *
 * It lives apart from the sessions that throw it, so that the round store can recognise it
 * without knowing which kind of session it is talking to.
 */
/**
 * The server that plays a ranked life could not take a step just now: there is no connection, it
 * is busy, or it is away. Nothing was changed here. The same step can be asked for again, and if
 * the server did take it the first time, it answers what it answered then.
 */
export class Unreachable extends Error {
  constructor(why = 'the server could not be reached') {
    super(why);
    this.name = 'Unreachable';
  }
}

export class StaleSession extends Error {
  constructor() {
    super('the saved life has moved on without this session');
    this.name = 'StaleSession';
  }
}
