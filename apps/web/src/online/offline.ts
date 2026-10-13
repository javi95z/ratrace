import type { Account } from './types';

/** The account of a game with no cloud behind it: nobody is signed in, and nothing can be kept. */
const OFFLINE = { kind: 'offline' } as const;

export const offlineAccount: Account = {
  // The same object every time: whoever watches the state must not see a change where there is none.
  state: () => OFFLINE,
  subscribe: () => () => {},
  start: async () => {},
  keepWithGoogle: async () => false,
  useExistingAccount: async () => false,
  dismissNotice: () => {},
};
