import type { BusinessRules } from '@ratrace/engine';
import { usd } from './money';

/**
 * Five kinds of business. Each makes a yield on the capital at work in it, which is all of a small
 * one and less of each dollar as it outgrows the size its kind is made for: a bar does not become a
 * chain by leaving the till closed. The economy moves the profit, more for what people give up
 * first, and a round bad enough is a loss that comes out of the business.
 *
 * A business takes a point of its owner's focus every round. A manager runs it instead for a share
 * of what it makes, and then it is the passive income the way out of the rat race is counted in.
 */
export const business: BusinessRules = {
  types: [
    // The player's own trade for their own clients: cheap to start, quick to pay, and never large. Only a trade that
    // can be sold on its own takes clients of its own: code, the law, money, selling, teaching, care, a kitchen. Not an
    // influencer's: their audience is their own business already.
    {
      id: 'services', minCapital: usd(2_000), yieldBp: 2_200, scale: usd(30_000), cyclePct: { boom: 15, slowdown: -15, recession: -40 }, managerPct: 50, minFinanceSkill: 0, failPct: 10, onlyOne: true,
      careers: ['tech', 'law', 'finance', 'sales', 'education', 'healthcare', 'medicine', 'hospitality'],
    },
    { id: 'shop', minCapital: usd(5_000), yieldBp: 2_000, scale: usd(80_000), cyclePct: { boom: 25, expansion: 5, slowdown: -25, recession: -70 }, managerPct: 40, minFinanceSkill: 2, failPct: 20 },
    // The best margins and the wildest swings.
    { id: 'app', minCapital: usd(3_000), yieldBp: 2_600, scale: usd(120_000), cyclePct: { boom: 40, slowdown: -30, recession: -90, recovery: 10 }, managerPct: 45, minFinanceSkill: 2, failPct: 30 },
    // The first thing people stop paying for: a recession is a loss.
    { id: 'bar', minCapital: usd(30_000), yieldBp: 1_500, scale: usd(200_000), cyclePct: { boom: 30, expansion: 10, slowdown: -35, recession: -130, recovery: -10 }, managerPct: 35, minFinanceSkill: 2, failPct: 25 },
    // Dear, dull and steady, with a manager who costs little: the one to own without running.
    { id: 'franchise', minCapital: usd(80_000), yieldBp: 1_100, scale: usd(600_000), cyclePct: { boom: 10, slowdown: -10, recession: -40 }, managerPct: 20, minFinanceSkill: 2, failPct: 12 },
  ],
  maxBusinesses: 3,
  payouts: [0, 50, 100],
  neglectProfitPct: 50,
  neglectDecayBp: 800,
  // Sold from the tab a business fetches what is in it at best: a premium is something a buyer brings, through a card.
  salePct: { boom: 100, expansion: 95, recovery: 90, slowdown: 85, recession: 70 },
  // A new business finds its customers slowly: half of what it will make, then three quarters.
  rampPct: [50, 75],
  // Many do not see their second round: an app most of all, a trade of one's own least. Someone who
  // knows how to run things fails less, and a failure is sold for parts.
  managementFailOffPct: 5,
  failRecoverPct: 40,
};
