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

/**
 * The server that plays a ranked life would not take this step as it was asked: an order it cannot
 * play. The life is where it was, and the player can change what they asked and try again.
 */
export class Refused extends Error {
  constructor(why = 'the server would not take this step') {
    super(why);
    this.name = 'Refused';
  }
}

export class StaleSession extends Error {
  constructor() {
    super('the saved life has moved on without this session');
    this.name = 'StaleSession';
  }
}

/** A ranked life in progress, as far as whoever must decide about it needs to know it. */
export interface RankedLifeInTheWay {
  gameId: string;
  lifeId: string;
  round: number;
  engineVersion: string;
  contentVersion: string;
}

/**
 * A ranked life could not begin because the player has another in progress, and nobody said it
 * may be ended: on another device, most often. Nothing was changed. The player is asked, and the
 * new life is started again naming this one to be replaced, or this one is taken up instead.
 */
export class RankedInProgress extends Error {
  constructor(readonly life: RankedLifeInTheWay) {
    super('a ranked life is already in progress');
    this.name = 'RankedInProgress';
  }
}
