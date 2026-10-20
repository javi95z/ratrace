import type { DebtParams, EvasionRules, LifeRules, PropertyTypeDef, ScoringParams, WorldRules } from '@ratrace/engine';
import { usd } from './money';

/**
 * Property scales from the reference flat of each city, the cheapest first. Status is for living
 * in one, and among homes a dearer one is always the grander one.
 *
 * Five kinds cannot be lived in: they are bought to let. The dearer ones let for a little more than
 * a home of the same price, which is all that makes up for being of no other use; at 10 to 25
 * percent over a city's rent a let pays its mortgage with a little to spare, and much more would
 * mean nobody ever let a flat. A parking space lets for a little less than a home: its small price
 * already puts a player on borrowed property rounds before a studio could, and with a rent
 * premium on top it was the best buy in the game.
 *
 * Each city also sells one thing to let that only it has, and the cheap ones among them, like the
 * parking space, let for no more than a home. A whole block of flats is not for sale where land is
 * the dearest of all. How much each kind lets for in each city is the city's to say (`propertyRentPct`).
 */
export const propertyTypes: PropertyTypeDef[] = [
  { id: 'kiosk', pricePct: 8, status: 0, rentalOnly: true, rentPct: 95, cities: ['moscow'] },
  { id: 'market_stall', pricePct: 10, status: 0, rentalOnly: true, rentPct: 95, cities: ['bangkok'] },
  { id: 'parking', pricePct: 12, status: 0, rentalOnly: true, rentPct: 90 },
  { id: 'hawker_stall', pricePct: 15, status: 0, rentalOnly: true, rentPct: 100, cities: ['singapore'] },
  { id: 'rooftop', pricePct: 20, status: 0, rentalOnly: true, rentPct: 100, cities: ['mexico_city'] },
  { id: 'billboard', pricePct: 25, status: 0, rentalOnly: true, rentPct: 105, cities: ['new_york'] },
  { id: 'yacht_berth', pricePct: 30, status: 0, rentalOnly: true, rentPct: 105, cities: ['dubai'] },
  { id: 'studio', pricePct: 60, status: 8 },
  { id: 'tourist_flat', pricePct: 70, status: 0, rentalOnly: true, rentPct: 130, cities: ['madrid'] },
  { id: 'vault', pricePct: 90, status: 0, rentalOnly: true, rentPct: 100, cities: ['zurich'] },
  { id: 'flat', pricePct: 100, status: 14, spareRoom: true },
  { id: 'student_house', pricePct: 110, status: 0, rentalOnly: true, rentPct: 120, cities: ['london'] },
  { id: 'loft', pricePct: 125, status: 18, spareRoom: true },
  { id: 'shop', pricePct: 130, status: 0, rentalOnly: true, rentPct: 125 },
  { id: 'townhouse', pricePct: 150, status: 21, spareRoom: true },
  { id: 'capsule_hotel', pricePct: 180, status: 0, rentalOnly: true, rentPct: 120, cities: ['tokyo'] },
  { id: 'house', pricePct: 180, status: 24, spareRoom: true },
  { id: 'office', pricePct: 220, status: 0, rentalOnly: true, rentPct: 115 },
  { id: 'duplex', pricePct: 250, status: 31, spareRoom: true },
  { id: 'warehouse', pricePct: 300, status: 0, rentalOnly: true, rentPct: 120 },
  { id: 'chalet', pricePct: 320, status: 37, spareRoom: true },
  { id: 'penthouse', pricePct: 400, status: 42, spareRoom: true },
  { id: 'estate', pricePct: 550, status: 50, spareRoom: true },
  { id: 'villa', pricePct: 800, status: 60, spareRoom: true },
  { id: 'block', pricePct: 900, status: 0, rentalOnly: true, rentPct: 110, notIn: ['singapore', 'zurich'] },
  { id: 'mansion', pricePct: 1500, status: 80, spareRoom: true },
];

export const debt: DebtParams = {
  // Borrowing from a broker to buy more: cheap money, half of the holding at most, and sold out from under you at three quarters.
  marginSpreadBp: 300,
  marginMaxPct: 50,
  marginCallPct: 75,
  marginMinFinanceSkill: 3,
  personalLoanSpreadBp: 500,
  mortgageSpreadBp: 150,
  creditCardRateBp: 2_200,
  mortgageTermRounds: 12,
  personalLoanTermRounds: 3,
  // A mortgage can be switched between fixed and variable: a percent of what is owed to take a fixed
  // rate, two to break one, and not again for three rounds.
  switchFeePct: { toFixed: 1, toVariable: 2 },
  switchRestRounds: 3,
  mortgageMaxLtvBp: 8_000,
  personalLoanMaxIncomePct: 100,
  bankruptcyIncomeMultiple: 3,
  bankruptcyLockRounds: 3,
  fireSaleDiscountBp: 3_000,
  bankruptcyStatusPenalty: 25,
};

export const scoring: ScoringParams = {
  wealthBreakpoints: [
    [0, 0],
    [usd(10_000), 100],
    [usd(100_000), 200],
    [usd(1_000_000), 300],
    [usd(10_000_000), 400],
    [usd(100_000_000), 500],
  ],
  escapeBase: 125,
  escapePerRoundLeft: 3,
};

export const life: LifeRules = {
  childCostPct: 22,
  childRounds: 10,
  partnerCostPct: 45,
  // Priced so that a careful player can justify each one: about what the bills it covers cost over a life.
  insurancePremiumBp: { health: 150, home: 60, life: 60 },
  // A rented room costs a little over half the housing share of a rented flat.
  rentTierHousingPct: [55, 100],
  rentTierStatus: [0, 3],
  // Living on less than most people is seen, and it costs standing: saving is not free.
  lifestyleStatus: [-2, 0, 3, 8],
  // A room in a shared flat and counting every coin are how everyone starts, and noticed more each
  // decade after: from 26, from 32 and from 40.
  agedStatus: {
    room: [
      { fromRound: 0, status: 0 },
      { fromRound: 2, status: -3 },
      { fromRound: 5, status: -6 },
      { fromRound: 9, status: -10 },
    ],
    frugal: [
      { fromRound: 0, status: -2 },
      { fromRound: 2, status: -4 },
      { fromRound: 5, status: -7 },
      { fromRound: 9, status: -11 },
    ],
  },
  // The body and the job grow riskier with the years: half as likely again from 40, twice from 50,
  // three times from 56 for the body; work holds until 50.
  riskByAge: {
    health: [
      { fromRound: 0, pct: 100 },
      { fromRound: 9, pct: 150 },
      { fromRound: 14, pct: 200 },
      { fromRound: 17, pct: 300 },
    ],
    job: [
      { fromRound: 0, pct: 100 },
      { fromRound: 14, pct: 150 },
      { fromRound: 17, pct: 200 },
    ],
    // Swindlers call the old more than the young.
    scam: [
      { fromRound: 0, pct: 100 },
      { fromRound: 14, pct: 200 },
      { fromRound: 17, pct: 300 },
    ],
  },
  // Health cover is priced by the age it is taken out at: from 32, from 40, from 50 and from 56.
  healthPremiumByAge: [
    { fromRound: 0, pct: 100 },
    { fromRound: 5, pct: 130 },
    { fromRound: 9, pct: 170 },
    { fromRound: 14, pct: 230 },
    { fromRound: 17, pct: 300 },
  ],
  // From 56 the player may stop working: two points of focus more a round, and the standing of a
  // life of one's own, worth a middle rung of most careers.
  retireFromRound: 17,
  retiredFocus: 2,
  retiredStatus: 8,
  giftTaxPct: 8,
  // A fifth down and the rest on a personal loan, for anything a dealer would write a contract for.
  itemFinanceDownPct: 20,
  itemFinanceMinPrice: usd(5_000),
  lesserItemPct: 25,
  // Of watches, only one is worn at a time: a lesser one counts for a quarter. Clothes are changed every day: half.
  // Of cars, the two best are looked at, the second for a quarter.
  lesserItems: { watch: { pct: 25 }, fashion: { pct: 50 }, car: { pct: 25, counted: 2 } },
  // A chalet, a penthouse, an estate, a villa or a mansion is a standing even let or far away: half of it, the two best.
  estates: { minStatus: 37, pct: 50, counted: 2 },
  // A car and a gadget are worth less to look at as they are worth less to sell: down to a quarter of what they gave new.
  agingLadders: ['car', 'tech'],
  agingFloorPct: 25,
  // A move costs a fifth of a year's living where it goes, and more the further it goes: four percent more every thousand kilometres.
  moveCostPct: 20,
  moveDistancePctPer1000Km: 4,
  // A household is dearer to move, and a move of one's own costs a rung and a partner's pay for a round:
  // the cheap way to another city is to be sent there.
  movePartnerPct: 50,
  moveChildPct: 25,
  moveRungsLost: 1,
  partnerSettlingRounds: 1,
  workSkill: 1,
  studySkill: 1,
  jobHuntChancePct: 20,
  jobHuntRaisePct: 3,
  // A card with only one open option is not a decision: it is not dealt.
  dealOnlyChoices: true,
  // From home a point of focus more, the same pay and the same standing, but fewer openings heard of:
  // a job hunt works less often. Half the day, two points more, two fifths less pay and half the
  // standing, and the trade is learnt only by study.
  workModes: {
    // Home is earned: from the third rung, once the boss trusts the work without seeing it done.
    remote: { focus: 1, payPct: 100, jobStatusPct: 100, workSkill: true, fromLevel: 2, huntOffPct: 8 },
    partTime: { focus: 2, payPct: 60, jobStatusPct: 50, workSkill: false, fromLevel: 0, huntOffPct: 0 },
  },
  // Home from another city keeps the pay of the city the job is in, less a quarter, and at most two and a half times what the city lived in pays.
  remoteAbroad: { payPct: 75, capPct: 250 },
  // Leaving the job for one's own: a business that made three fifths of the pay two rounds running.
  // Run full time it makes three fifths more, frees a point of focus, and its owner is somebody by
  // its size; going back to a job starts a rung lower.
  fullTime: {
    strongPct: 60,
    strongRounds: 2,
    profitPct: 160,
    focus: 1,
    status: [
      [0, 6],
      [usd(100_000), 10],
      [usd(400_000), 14],
      [usd(1_500_000), 18],
    ],
    rungsLost: 1,
  },
  // A lodger pays about a third of what the whole home would let for, and the flat is shared.
  lodger: { rentPct: 30, statusLost: 4 },
  // Home again. With little to show, the family carries you back and puts you up for a while; with
  // more, nobody needs to. Either way old friends open doors, and coming back richer is a triumph.
  homecoming: { helpBelowWorth: usd(50_000), helpPct: 30, networkPoints: 3, status: 4 },
  // Asking the boss: one in three says yes, a good negotiator is told yes far more often. Yes or no, not again for two rounds.
  raise: { chancePct: 30, perNegotiationPct: 15, pct: 4, restRounds: 2 },
  // Prison: status on the way in, and a rung of the career on the way out.
  jail: { statusLost: 20, rungsLost: 1 },
  // Overtime two rounds running costs a point of health, and from the third a third of the time it
  // ends in burnout: two more points and a point of focus the round after. A raise found needs a
  // round's rest before the next search, and each search that fails makes the next one 15 points
  // less likely. Study for the career is worth three points at each rung; the rest is work.
  focusLimits: {
    overtimeTiredFrom: 2,
    overtimeHealthPoints: 1,
    overtimeBurnoutFrom: 3,
    burnoutChancePct: 35,
    burnoutHealthPoints: 2,
    burnoutFocus: 1,
    huntRestRounds: 1,
    huntMissPct: 15,
    huntFloorPct: 5,
    studyPerRung: 3,
  },
  rentOutMinFinanceSkill: 2,
  unstablePayPct: 30,
  cheapMortgageBp: 100,
  teaseStatus: 1,
  teasedStatus: 2,
  familyTimeStatus: 2,
  restHealthPoints: 1,
  cardsPerRound: 3,
  // A car or a watch second hand: about half or two thirds of the price, a couple of rounds old, and
  // now and then a repair. A car loses status with those rounds; a watch holds it, so a watch is
  // dearer second hand and needs a service more often. Over a life the repairs eat a good part of
  // what was saved, so second hand is a choice of when to pay, not a free lunch.
  used: {
    car: { pricePct: 55, ageRounds: 2, repairChancePct: 30, repairPct: 8 },
    watch: { pricePct: 70, ageRounds: 2, repairChancePct: 25, repairPct: 6 },
  },
  // Every skill, money sense too, has the same three levels, each dearer than the last: 3, 8 and 15
  // points. Study gives three a round and living it one; study alone masters a skill in five rounds,
  // so a life masters some of its skills, not all of them. A skill at its top is studied no more.
  skills: {
    levelPoints: [3, 8, 15],
    studyPoints: 3,
    practicePoints: 1,
    investingPoints: 1,
    practiceCareers: {
      negotiation: ['sales', 'law', 'finance'],
      languages: ['hospitality'],
      network: ['sales', 'influencer', 'hospitality', 'public'],
      health: ['healthcare', 'medicine'],
    },
    practiceItems: { health: ['member_gym', 'pet_dog', 'tech_smartwatch'], management: ['edu_coach'], languages: ['edu_language_school'] },
    negotiationHuntRaisePct: 1,
    negotiationPromotionPct: 2,
    negotiationSalePct: 4,
    languagesMoveOffPct: 15,
    // Someone who speaks the language is worth more away from home: a few percent more pay a level.
    languagesAbroadPayPct: 4,
    languagesKeepRungFrom: 2,
    languagesPartnerFrom: 3,
    networkHuntPct: 8,
    networkStatus: 1,
    managementProfitPct: 6,
    managementManagerOffPct: 4,
    managementExtraFrom: 3,
    // From the third rung people are led, and leading them well is paid.
    managementPayPct: 3,
    managementPayFromLevel: 2,
    healthPremiumOffPct: 20,
    healthFocusFrom: 3,
    // Each level takes 15 % off the chance of the misfortunes the skill guards against.
    healthRiskOffPct: 15,
    jobRiskOffPct: 15,
    // A quarter off a swindle for each level of money sense.
    scamRiskOffPct: 25,
  },
};

export const world: WorldRules = {
  // Four a round: one is often filler that says nothing, to be told from the news that matters.
  headlinesPerRound: 4,
  // Thirty-eight of everyday life, then one about each of the famous (see CELEB_HEADLINES_FROM).
  noiseHeadlines: 52,
  // The government as the paper sees it: busy, expensive, and always about to fix something.
  governmentHeadlines: 40,
  newsTruthPct: 70,
  flatBandBp: 25,
  taxReformChancePct: 8,
  taxReformsPerGame: 2,
  taxReformStepsBp: [-300, -200, 200, 300],
  quietWeight: 30,
  // About one life in three lives through a crisis, and never before 30: by then there is something to lose.
  crisisChancePct: 30,
  crisisEarliestRound: 4,
};

/**
 * Hiding from the tax office. Every way saves tax this round and draws suspicion; the chance of an
 * inspection each round is the suspicion itself, up to sixty in a hundred. An inspection takes back
 * the last four years of what was hidden with half as much again, a share of what was bought
 * without an invoice, and the player's good name. A quarter of the salary under the table is
 * suspected at six points a round, so a few quiet rounds pay and a careless decade does not.
 */
export const evasion: EvasionRules = {
  blackPcts: [0, 25, 50],
  // Hiding pays a little better than it used to: the office notices less, forgets sooner, and fines less.
  blackSuspicionPer100: 18,
  // An offshore company is for someone who knows money well, and costs a salary's worth of fees.
  shellMinFinanceSkill: 3,
  shellFeeAnnual: usd(6_000),
  shellTaxCutPct: 80,
  shellSuspicion: 6,
  // From thirty-eight the exchanges tell the tax office what their customers made.
  cryptoSuspicion: 6,
  cryptoReportRound: 8,
  noInvoiceLadders: ['art', 'watch'],
  noInvoiceDiscountPct: 25,
  noInvoiceSaleSuspicion: 15,
  suspicionDecay: 8,
  auditMaxPct: 60,
  // Inspected with this much hidden, it goes to court as well.
  chargedFromEvaded: usd(80_000),
  auditFinePct: 40,
  auditGoodsPct: 30,
  auditStatus: -8,
  limitationRounds: 2,
};
