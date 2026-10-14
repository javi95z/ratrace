import type { RoundTally } from './types';

/** The running totals of a round that has not started. */
export function newTally(): RoundTally {
  return { realisedGains: 0, pensionContribution: 0, purchaseTaxPaid: 0, focusActions: [], itemsBought: 0, itemsSold: 0, movingCost: 0, realisedCryptoGains: 0, noInvoiceSold: 0, businessesSold: [] };
}
