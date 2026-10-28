import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  badgeArt,
  badges,
  cardArt,
  CHALLENGE_ART,
  CHALLENGE_DEBT,
  CHALLENGE_RULES,
  cityArt,
  cityIcon,
  content,
  CONTENT_VERSION,
  FAMILY_ART,
  focusArt,
  insuranceArt,
  itemArt,
  lifestyleArt,
  lives,
  portraitArt,
  propertyArt,
  rentTierArt,
  ruleArt,
  skillArt,
  START_AGE,
  textFor,
} from '@ratrace/content';
import type { ChallengeRule } from '@ratrace/content';
import { STUDY_OF } from '@ratrace/engine';
import type { ItemDef } from '@ratrace/engine';
import { NUMBERS, WORDS } from './catalogWords';
import type { CatalogLocale } from './catalogWords';
import { namedRivals, ui } from './strings';

/**
 * Writes the catalogue: everything the game holds, with its picture and its numbers, read straight
 * from the content and the game's own text in one language. Run it again whenever the content changes:
 *
 *   pnpm catalog                 # docs/catalogo.md, in Spanish
 *   pnpm catalog --locale=ru     # docs/catalog.ru.md, in Russian
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
/** Where each language's catalogue is written. */
export const CATALOG_FILES: Record<CatalogLocale, string> = { es: 'docs/catalogo.md', ru: 'docs/catalog.ru.md' };

/** Where each sprite was cut to. The manifest says: a sprite is not always in the folder its name suggests. */
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'art/clean/manifest.json'), 'utf8')) as { sprites: Record<string, { file: string }> };
/** A sprite as an image in the page, at the size it was drawn. */
const img = (sprite: string, alt = ''): string => `<img src="../art/clean/${manifest.sprites[sprite].file}" alt="${alt}">`;
const cell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (head: string[], rows: string[][]): string =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)].join('\n');
/** A heading's anchor, as GitHub makes it: lower case, punctuation dropped, spaces to hyphens. */
const anchor = (heading: string): string => `[${heading}](#${heading.toLowerCase().replace(/[^\p{L}\p{N} -]/gu, '').replace(/ /g, '-')})`;

/** The whole catalogue in one language, as markdown. */
export function catalog(locale: CatalogLocale): string {
  const W = WORDS[locale];
  const { usd, pct, pc, signed } = NUMBERS[locale];
  const { text, names } = textFor(locale);
  const messages = JSON.parse(readFileSync(path.join(ROOT, `packages/i18n/messages/${locale}.json`), 'utf8')) as {
    challenge: {
      about: string;
      practiceHint: string;
      rules: Record<ChallengeRule, { name: string; about: string }>;
    };
  };
  const regimeShares = (shares: Record<string, number>): string =>
    Object.entries(shares).map(([regime, share]) => `${text.regimes[regime as keyof typeof text.regimes] ?? regime} ${pc(signed(share))}`).join(', ');
  const fromStart = (round: number): number => START_AGE + round * content.yearsPerRound;

  const out: string[] = [];
  /** Each piece is a block of its own: a blank line after every one. */
  const say = (...blocks: string[]) => out.push(...blocks.flatMap((block) => [block, '']));
  const limits = content.life.focusLimits;
  const S = W.sections;

  const itemsByLadder = new Map<string, ItemDef[]>();
  for (const item of content.items) itemsByLadder.set(item.ladder, [...(itemsByLadder.get(item.ladder) ?? []), item]);

  say(`# ${W.title}`, ...W.intro(CONTENT_VERSION));
  say(
    table(W.toc.head, [
      [anchor(S.lives), `${lives.length}`],
      [anchor(S.challenge), W.toc.rules(CHALLENGE_RULES.length)],
      [anchor(S.careers), `${content.careers.length}`],
      [anchor(S.cities), `${content.cities.length}`],
      [anchor(S.items), W.toc.items(content.items.length, itemsByLadder.get('car')?.length ?? 0)],
      [anchor(S.properties), `${content.propertyTypes.length}`],
      [anchor(S.investments), `${content.assets.length}`],
      [anchor(S.lifestyle), '4 + 2 + 4 + 3'],
      [anchor(S.cards), `${content.cards.length}`],
      [anchor(S.crises), `${content.crises.length}`],
      [anchor(S.badges), `${badges.length}`],
    ]),
  );

  // ---------------------------------------------------------------------------------------------
  say(`## ${S.lives}`, W.lives.ages);
  for (const life of lives) {
    const start = life.start;
    const from = start.life;
    const written = text.lives[life.id];
    const job = from?.career ? `${text.careers[from.career.id].levels[from.career.level]} (${text.careers[from.career.id].name})` : W.lives.noJob;
    const extras: string[] = [];
    for (const debt of start.debts) extras.push(W.lives.debt(text.debts[debt.kind], usd(debt.principal), pct(debt.fixedRateBp)));
    for (const home of from?.properties ?? []) extras.push(W.lives.owned(text.propertyTypes[home.typeId]));
    for (const held of from?.holdings ?? []) extras.push(W.lives.holding(usd(held.value), names.assets[held.assetId].name));
    for (const entry of from?.recurring ?? []) extras.push(W.lives.recurring(entry.kind === 'passive', usd(entry.annual)));
    say(
      `### ${written.name}`,
      ([22, 32, 45, 58] as const).map((age) => img(portraitArt(life.id, age), W.lives.portraitAlt(written.name, age))).join(' '),
      table(
        ['', ''],
        [
          [W.lives.startsIn, W.lives.startsInValue(names.cities[start.cityId], usd(start.cash))],
          [W.lives.job, job],
          [W.lives.skills, `${from?.careerSkill ?? 0} · ${from?.financeSkill ?? 0}/3 · ${from?.focus ?? 3}`],
          [W.lives.lifestyle, `${text.lifestyleTiers[start.lifestyleTier]}${from?.minLifestyleTier ? W.lives.noLower(text.lifestyleTiers[from.minLifestyleTier]) : ''}`],
          [W.lives.startsWith, extras.length > 0 ? extras.join('; ') : W.lives.nothing],
          [W.lives.perk, written.perk],
          [W.lives.handicap, written.handicap],
          [W.lives.unlock, written.unlock],
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------------------------
  say(
    `## ${S.challenge}`,
    img(CHALLENGE_ART.scene, S.challenge),
    messages.challenge.about,
    W.challenge.week,
    messages.challenge.practiceHint,
    table(
      W.challenge.head,
      CHALLENGE_RULES.map((rule) => [img(ruleArt[rule], messages.challenge.rules[rule].name), messages.challenge.rules[rule].name, messages.challenge.rules[rule].about.replace('{amount}', usd(CHALLENGE_DEBT))]),
    ),
  );

  // ---------------------------------------------------------------------------------------------
  say(`## ${S.careers}`, W.careers.about);
  for (const career of content.careers) {
    say(
      `### ${text.careers[career.id].name}`,
      [
        W.careers.overtime(pc(career.overtimePct)),
        career.focus ? W.careers.focus(career.focus) : '',
        career.cyclePct ? W.careers.cycle(regimeShares(career.cyclePct)) : '',
        career.fade ? W.careers.fade(fromStart(career.fade.fromRound), pc(career.fade.pctPerRound), pc(career.fade.maxPct)) : '',
      ].filter(Boolean).join(' '),
      table(
        W.careers.head,
        career.levels.map((level, i) => [text.careers[career.id].levels[i], W.careers.salary(pc(level.salaryPct)), `${level.minSkill}`, signed(level.status)]),
      ),
      // The moves of a career at some of its rungs: a point of focus for some rounds, and a chance at each outcome.
      ...(career.moves?.length
        ? [table(
            W.careers.movesHead,
            career.moves.map((move) => {
              const told = text.careers[career.id].moves?.[move.id];
              const total = move.outcomes.reduce((sum, outcome) => sum + outcome.weight, 0);
              const rungs = [move.fromLevel, move.toLevel].map((level) => text.careers[career.id].levels[level]);
              return [
                `**${told?.name ?? move.id}**<br>${told?.about ?? ''}`,
                rungs[0] === rungs[1] ? rungs[0] : W.careers.rungs(rungs[0], rungs[1]),
                `${move.rounds} · ${move.restRounds}`,
                move.outcomes.map((outcome, i) => `${pc(Math.round((outcome.weight * 100) / total))}: ${told?.outcomes[i] ?? ''}`).join('<br>') + (move.skill && move.pctPerSkillLevel ? `<br>${W.careers.skillBonus(move.pctPerSkillLevel, text.skills[move.skill])}` : ''),
              ];
            }),
          )]
        : []),
    );
  }

  // ---------------------------------------------------------------------------------------------
  const business = content.business;
  say(
    `## ${S.business}`,
    W.business.about({
      neglect: pc(business.neglectProfitPct),
      decay: pct(business.neglectDecayBp),
      max: business.maxBusinesses,
      min: pc(Math.min(...Object.values(business.salePct))),
      top: pc(Math.max(...Object.values(business.salePct))),
    }),
    table(
      W.business.head,
      business.types.map((type) => [
        text.businessTypes[type.id].name,
        usd(type.minCapital),
        W.business.upTo(pct(type.yieldBp)),
        usd(type.scale),
        regimeShares(type.cyclePct),
        W.business.ofProfit(pc(type.managerPct)),
        `${type.minFinanceSkill}`,
      ]),
    ),
  );

  // ---------------------------------------------------------------------------------------------
  say(
    `## ${S.cities}`,
    W.cities.about,
    W.cities.moving({
      cost: pc(content.life.moveCostPct),
      distance: content.life.moveDistancePctPer1000Km ? pc(content.life.moveDistancePctPer1000Km) : null,
      partner: pc(content.life.movePartnerPct),
      child: pc(content.life.moveChildPct),
      rungs: content.life.moveRungsLost,
      years: content.life.partnerSettlingRounds * content.yearsPerRound,
    }),
  );
  for (const city of content.cities) {
    const name = names.cities[city.id];
    say(
      `### ${img(cityIcon(city.id))} ${name}`,
      `${text.cities[city.id].tagline}`,
      `${img(cityArt(city.id), W.cities.night(name))} ${img(cityArt(city.id, 'day'), W.cities.day(name))}`,
      `${img(cityArt(city.id, 'boom'), W.cities.boom(name))} ${img(cityArt(city.id, 'crisis'), W.cities.crisis(name))}`,
      table(
        ['', ''],
        [
          [W.cities.salary, W.cities.perYear(usd(city.medianSalaryAnnual))],
          [W.cities.living, W.cities.perYear(usd(city.livingCostAnnual))],
          [W.cities.flat, usd(city.flatPrice)],
          [W.cities.rentYield, W.cities.rentYieldValue(pct(city.rentYieldBp))],
          [W.cities.incomeTax, city.tax.incomeRatesBp.map((rate) => pct(rate)).join(' · ')],
          [W.cities.gainsTax, pct(city.tax.capitalGainsBp)],
          [W.cities.prestige, signed(city.prestige)],
          [W.cities.pays, Object.entries(city.careerPayPct ?? {}).map(([career, share]) => `${text.careers[career].name} ${pc(`+${share - 100}`)}`).join(' · ')],
        ],
      ),
    );
  }

  // ---------------------------------------------------------------------------------------------
  say(
    `## ${S.items}`,
    [
      W.items.lesser(pc(content.life.lesserItemPct)),
      ...Object.entries(content.life.lesserItems ?? {}).map(([ladder, rule]) =>
        rule.counted !== undefined
          ? W.items.counted(text.ladders[ladder] ?? ladder, rule.counted, pc(rule.pct))
          : W.items.rest(text.ladders[ladder] ?? ladder, rule.pct, pc(rule.pct)),
      ),
    ].join(' '),
    W.items.uses,
    W.items.aging(content.life.agingLadders.map((ladder) => text.ladders[ladder]), pc(content.life.agingFloorPct)),
    W.items.resale,
    W.items.finance(usd(content.life.itemFinanceMinPrice), pc(content.life.itemFinanceDownPct)),
    W.items.used,
    table(
      W.items.usedHead,
      Object.entries(content.life.used).flatMap(([ladder, rule]) =>
        rule ? [[text.ladders[ladder], W.items.usedPrice(pc(rule.pricePct)), `${rule.ageRounds * content.yearsPerRound}`, W.items.usedRepair(pc(rule.repairChancePct), pc(rule.repairPct))]] : [],
      ),
    ),
  );
  /** What an item is good for beyond its status, in words. */
  const uses = (item: ItemDef): string => {
    const perks = item.perks ?? {};
    const out: string[] = [];
    if (perks.moveCostOffPct) out.push(W.items.moveCostOff(pc(perks.moveCostOffPct)));
    if (perks.studySkill) out.push(W.items.studySkill(perks.studySkill));
    if (perks.salaryPct) out.push(W.items.salary(pc(perks.salaryPct)));
    if (perks.jobHuntPct) out.push(W.items.jobHunt(perks.jobHuntPct));
    if (perks.focus) out.push(W.items.focus(perks.focus));
    return out.join('. ');
  };

  for (const [ladder, items] of itemsByLadder) {
    say(
      `### ${text.ladders[ladder]}`,
      table(
        W.items.head,
        items.map((item) => {
          const notes: string[] = [];
          if (item.kind === 'membership') notes.push(W.items.membership);
          if (item.kind === 'experience') notes.push(W.items.experience(item.boostRounds * content.yearsPerRound));
          if (item.cardOnly) notes.push(W.items.cardOnly);
          if (item.cities) notes.push(W.items.onlyIn(item.cities.map((id) => names.cities[id])));
          return [
            img(itemArt(item.id), names.items[item.id]),
            names.items[item.id],
            usd(item.price),
            item.upkeepAnnual > 0 ? W.items.perYear(usd(item.upkeepAnnual)) : '',
            signed(item.status),
            item.kind === 'durable' && !item.cardOnly ? W.items.resaleValue(pc(item.resaleStartPct), pc(signed(item.resaleDriftBp / 100))) : '',
            uses(item),
            notes.join('. '),
          ];
        }),
      ),
    );
  }

  // ---------------------------------------------------------------------------------------------
  const madrid = content.cities[0];
  const estates = content.life.estates;
  const aged = (steps: ReadonlyArray<{ fromRound: number; status: number }>): string[] => steps.map((step) => W.properties.agedStep(fromStart(step.fromRound), signed(step.status)));
  say(
    `## ${S.properties}`,
    W.properties.about(names.cities[madrid.id]),
    ...(estates ? [W.properties.estates(estates.minStatus, pc(estates.pct), estates.counted)] : []),
    table(
      W.properties.head(names.cities[madrid.id]),
      [...content.propertyTypes]
        .sort((a, b) => a.pricePct - b.pricePct)
        .map((type) => [
          img(propertyArt(type.id), text.propertyTypes[type.id]),
          text.propertyTypes[type.id],
          W.properties.price(pc(type.pricePct)),
          usd(Math.round((madrid.flatPrice * type.pricePct) / 100)),
          type.rentalOnly ? '' : signed(type.status),
          type.rentalOnly ? W.properties.rentalOnly : W.properties.liveOrLet,
          W.properties.rent(pc(type.rentPct ?? 100)),
        ]),
    ),
    W.properties.renting,
    table(W.properties.rentHead, [0, 1].map((tier) => [img(rentTierArt[tier]), text.rentTiers[tier], pc(content.life.rentTierHousingPct[tier]), signed(content.life.rentTierStatus[tier])])),
    W.properties.aged(aged(content.life.agedStatus.room), aged(content.life.agedStatus.frugal), { room: text.rentTiers[0], frugal: text.lifestyleTiers[0] }),
  );

  // ---------------------------------------------------------------------------------------------
  say(
    `## ${S.investments}`,
    W.investments.about(content.life.skills.investingPoints, content.life.skills.levelPoints.join(', ')),
    table(
      W.investments.head,
      content.assets.map((asset) => [
        names.assets[asset.id].name,
        names.assets[asset.id].ticker,
        text.assetClasses[asset.class],
        `${asset.minFinanceSkill ?? 0}`,
        asset.class === 'bond' ? W.investments.coupon : asset.yieldBp > 0 ? W.investments.perYear(pct(asset.yieldBp)) : '',
        text.assets[asset.id].blurb,
      ]),
    ),
  );

  const STUDIES = Object.keys(STUDY_OF) as Array<keyof typeof STUDY_OF>;
  const skills = content.life.skills;
  const L = W.lifestyle;
  const practised = (skill: keyof typeof skills.practiceCareers): string => (skills.practiceCareers[skill] ?? []).map((id) => text.careers[id].name).join(', ');

  // ---------------------------------------------------------------------------------------------
  say(
    `## ${S.lifestyle}`,
    table(
      L.head,
      text.lifestyleTiers.map((name, tier) => [img(lifestyleArt[tier]), name, pc(content.lifestyleMultiplierPct[tier]), signed(content.life.lifestyleStatus[tier])]),
    ),
    table(
      L.insuranceHead,
      (Object.keys(insuranceArt) as Array<keyof typeof insuranceArt>).map((kind) => [img(insuranceArt[kind]), text.insurance[kind], L.premium(pct(content.life.insurancePremiumBp[kind]))]),
    ),
    table(
      L.focusHead,
      [
        [img(focusArt.overtime), text.focusActions.overtime, L.overtime({ tiredFrom: limits.overtimeTiredFrom, health: limits.overtimeHealthPoints, burnoutFrom: limits.overtimeBurnoutFrom, chance: pc(limits.burnoutChancePct), burnoutHealth: limits.burnoutHealthPoints, focus: limits.burnoutFocus })],
        [img(focusArt.studyCareer), text.focusActions.studyCareer, L.studyCareer(content.life.studySkill, content.life.workSkill, limits.studyPerRung)],
        [img(focusArt.jobHunt), text.focusActions.jobHunt, L.jobHunt({ chance: pc(content.life.jobHuntChancePct), raise: pc(content.life.jobHuntRaisePct), rest: limits.huntRestRounds, miss: limits.huntMissPct, floor: pc(limits.huntFloorPct) })],
        ...STUDIES.map((action) => [img(focusArt[action]), text.focusActions[action], L.study(skills.studyPoints, text.skills[STUDY_OF[action]])]),
      ],
    ),
    L.skills(skills.levelPoints.join(', '), skills.studyPoints, skills.practicePoints, text.skills.management),
    table(
      L.skillsHead,
      [
        [img(skillArt.negotiation), text.skills.negotiation, L.negotiation(pc(skills.negotiationHuntRaisePct), pc(skills.negotiationPromotionPct), pc(skills.negotiationSalePct)), `${L.negotiationPractice}; ${practised('negotiation')}`],
        [img(skillArt.languages), text.skills.languages, L.languages(pc(skills.languagesMoveOffPct), skills.languagesKeepRungFrom, skills.languagesPartnerFrom), `${L.languagesPractice}; ${practised('languages')}`],
        [img(skillArt.network), text.skills.network, L.network(skills.networkHuntPct, skills.networkStatus), `${L.networkPractice}; ${practised('network')}`],
        [img(skillArt.management), text.skills.management, L.management(pc(skills.managementProfitPct), skills.managementManagerOffPct, skills.managementExtraFrom), L.managementPractice],
        [img(skillArt.health), text.skills.health, L.health(pc(skills.healthPremiumOffPct), skills.healthFocusFrom), `${L.healthPractice}; ${practised('health')}`],
      ],
    ),
    L.family(pc(content.life.partnerCostPct), pc(content.life.childCostPct), content.life.childRounds * content.yearsPerRound),
    FAMILY_ART.map((sprite) => img(sprite)).join(' '),
  );

  // ---------------------------------------------------------------------------------------------
  {
    const e = content.evasion;
    const V = W.evasion;
    say(
      `## ${S.evasion}`,
      V.about,
      table(
        V.head,
        [
          [V.black[0], V.black[1], V.perRound(e.blackPcts.slice(1).map((share) => `${pc(share)}: +${Math.floor((share * e.blackSuspicionPer100) / 100)}`).join(', ')), V.black[2]],
          [...V.shell(pc(e.shellTaxCutPct)), V.perRound(`+${e.shellSuspicion}`), V.shellNotes(e.shellMinFinanceSkill, usd(e.shellFeeAnnual))],
          [V.crypto[0], V.crypto[1], V.cryptoSuspicion(e.cryptoSuspicion, fromStart(e.cryptoReportRound)), V.crypto[2]],
          [...V.invoice(pc(e.noInvoiceDiscountPct)), V.invoiceSuspicion(e.noInvoiceSaleSuspicion), e.noInvoiceLadders.map((ladder) => text.ladders[ladder]).join(V.and)],
        ],
      ),
      V.audit({ decay: e.suspicionDecay, max: pc(e.auditMaxPct), years: e.limitationRounds * content.yearsPerRound, fine: pc(e.auditFinePct), goods: pc(e.auditGoodsPct), status: -e.auditStatus }),
    );
  }

  // ---------------------------------------------------------------------------------------------
  say(`## ${S.cards}`, W.cards.about(content.life.cardsPerRound));
  const categories = [...new Set(content.cards.map((card) => card.category))];
  for (const category of categories) {
    const cards = content.cards.filter((card) => card.category === category);
    say(
      `### ${text.categories[category]} (${cards.length})`,
      table(
        W.cards.head,
        cards.map((card) => {
          const written = text.cards[card.id];
          return [img(cardArt[card.id], written.title), `**${written.title}**<br>${namedRivals(written.body, ui[locale])}`, written.options.map((option, i) => `${i + 1}. ${option.label}`).join('<br>')];
        }),
      ),
    );
  }

  // ---------------------------------------------------------------------------------------------
  const C = W.crises;
  say(`## ${S.crises}`, C.about(pc(content.world.crisisChancePct), fromStart(content.world.crisisEarliestRound)), C.how);
  const shift = (bp: number | undefined, what: string): string | null => (bp ? `${what} ${bp > 0 ? '+' : '−'}${pct(Math.abs(bp))}` : null);
  for (const crisis of content.crises) {
    const written = text.crises[crisis.id];
    say(
      `### ${written.name}`,
      written.intro,
      table(
        C.head,
        crisis.phases.map((phase, i) => [
          `${i + 1}`,
          written.years[i],
          [phase.regime ? text.regimes[phase.regime] : null, phase.cryptoPhase ? C.crypto(text.cryptoPhases[phase.cryptoPhase]) : null, shift(phase.rateBp, C.rates), shift(phase.inflationBp, C.inflation)].filter(Boolean).join('; '),
          [shift(phase.equityBp, C.equity), shift(phase.propertyBp, C.property), shift(phase.goldBp, C.gold), shift(phase.cryptoBp, C.cryptoShift)].filter(Boolean).join('; '),
        ]),
      ),
    );
  }

  // ---------------------------------------------------------------------------------------------
  say(`## ${S.badges}`);
  const groups = [...new Set(badges.map((badge) => badge.group))];
  for (const group of groups) {
    say(
      `### ${text.badgeGroups[group]}`,
      table(
        W.badges.head,
        badges.filter((badge) => badge.group === group).map((badge) => [img(badgeArt(badge.id), text.badges[badge.id].name), text.badges[badge.id].name, text.badges[badge.id].how]),
      ),
    );
  }

  return `${out.join('\n').trimEnd()}\n`;
}

/** The language asked on the command line: `--locale=ru`, Spanish by default. */
export function localeOf(args: readonly string[]): CatalogLocale {
  const asked = args.find((arg) => arg.startsWith('--locale='))?.slice('--locale='.length) ?? 'es';
  if (asked !== 'es' && asked !== 'ru') throw new Error(`catalog: no catalogue in "${asked}" (es, ru)`);
  return asked;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const locale = localeOf(process.argv.slice(2));
  const file = path.join(ROOT, CATALOG_FILES[locale]);
  const written = catalog(locale);
  writeFileSync(file, written);
  console.log(`catalog: ${CATALOG_FILES[locale]} written, ${written.split('\n').length} lines`);
}
