import {
  assetYieldBp,
  cashflow,
  debtRateBp,
  effectiveTax,
  focusLeft,
  headlineHeld,
  homeOf,
  indexed,
  netWorth,
  previewCard,
  quoteItem,
  quoteMove,
  quoteProperty,
  realNetWorth,
  scoreBreakdown,
} from '@ratrace/engine';
import type { CardDef, Content, Effects, GameEvent, GameState, Headline, RoundPreview } from '@ratrace/engine';
import type { ContentText, Locale, Names } from '@ratrace/content';
import { padEnd, padStart } from './format';
import type { Format } from './format';
import type { Ui } from './strings';

/** Everything a screen needs to turn a state into lines of text. */
export interface Pen {
  content: Content;
  text: ContentText;
  names: Names;
  locale: Locale;
  ui: Ui;
  fmt: Format;
}

const RULE = '═'.repeat(64);
const THIN = '─'.repeat(64);
const START_AGE = 22;

export const ageAt = (pen: Pen, round: number) => START_AGE + round * pen.content.yearsPerRound;

export function header(pen: Pen, state: GameState): string[] {
  const { ui, names, content } = pen;
  const left = ` ${ui.age} ${ageAt(pen, state.round)} · ${ui.round(state.round + 1, content.rounds)} · ${names.cities[state.player.cityId]}`;
  return [RULE, `${padEnd(left, 44)}${padStart(`${ui.seed} ${state.seed}`, 20)}`, RULE];
}

function headline(pen: Pen, h: Headline): string {
  const lines = pen.text.headlines;
  switch (h.topic) {
    case 'regime':
      return lines.regime[h.regime];
    case 'crypto':
      return lines.crypto[h.phase];
    case 'rates':
      return lines.rates[h.trend];
    case 'inflation':
      return lines.inflation[h.trend];
    case 'property':
      return lines.property[h.trend].replace('{city}', pen.names.cities[h.cityId]);
  }
}

export function news(pen: Pen, state: GameState): string[] {
  const { ui, fmt, text, content } = pen;
  const world = state.timeline[state.round];
  const lines = [` ${ui.news}`];
  for (const h of world.news) lines.push(`  · ${headline(pen, h)}`);
  if (state.round > 0) {
    const before = state.timeline[state.round - 1];
    const marks = before.news.map((h) => `${headlineHeld(content, h, before, world) ? '✓' : '✗'} ${headline(pen, h)}`);
    const held = marks.filter((m) => m.startsWith('✓')).length;
    lines.push(`  ${ui.lastNews(held, marks.length)}`);
    for (const mark of marks) lines.push(`    ${mark}`);
  }
  lines.push(
    `  ${ui.rates} ${fmt.rate(world.policyRateBp)}   ${ui.inflation} ${fmt.rate(world.inflationBp)}   ` +
      `${ui.economy}: ${text.regimes[world.regime]}   ${ui.crypto}: ${text.cryptoPhases[world.cryptoPhase]}`,
  );
  return lines;
}

export function me(pen: Pen, state: GameState): string[] {
  const { ui, fmt, text, names, content } = pen;
  const p = state.player;
  const life = p.life;
  const world = state.timeline[state.round];
  const flow = cashflow(content, state);
  const job = life.career ? `${text.careers[life.career.id].name} (${text.careers[life.career.id].levels[life.career.level]})` : ui.noJob;
  const home = homeOf(p, content);
  const lines = [
    ` ${ui.you}  ${text.lives[life.lifeId]?.name ?? life.lifeId} · ${job}`,
    `  ${ui.cash} ${fmt.money(p.cash)}   ${ui.savings} ${fmt.money(p.deposit)}   ${ui.pension} ${fmt.money(p.pension)}   ` +
      `${ui.netWorth} ${fmt.money(netWorth(p))}   ${ui.status} ${p.statusPoints}`,
    `  ${ui.salary} ${fmt.money(flow.salaryAnnual)}${ui.perYear}   ${ui.passive} ${fmt.money(flow.passiveAnnual)}${ui.perYear}   ` +
      `${ui.expenses} ${fmt.money(flow.expensesAnnual)}${ui.perYear}`,
    `  ${ui.focus} ${focusLeft(p)}/${life.focusBase}   ${ui.careerSkill} ${life.careerSkill}   ${ui.financeSkill} ${life.financeSkill}   ` +
      `${ui.lifestyle}: ${text.lifestyleTiers[p.lifestyleTier]}   ${ui.home}: ${home ? text.propertyTypes[home.typeId] : text.rentTiers[life.rentTier]}`,
  ];
  const family: string[] = [];
  if (life.partner) family.push(ui.partner);
  if (life.children.length > 0) family.push(ui.children(life.children.length));
  const insured = (Object.keys(life.insurance) as Array<keyof typeof life.insurance>).filter((k) => life.insurance[k]).map((k) => text.insurance[k]);
  if (insured.length > 0) family.push(`${ui.insured}: ${insured.join(', ')}`);
  if (life.movingTo !== null) family.push(`${ui.movingTo} ${names.cities[life.movingTo]}`);
  if (family.length > 0) lines.push(`  ${family.join('   ')}`);

  if (p.debts.length > 0) {
    lines.push(`  ${ui.headers.debts}:`);
    p.debts.forEach((d, i) => {
      const term = d.kind === 'creditCard' ? '' : `, ${d.roundsLeft} ${ui.columns.roundsLeft}`;
      lines.push(`    ${i + 1}. ${text.debts[d.kind]}  ${fmt.money(d.principal)}  ${fmt.rate(debtRateBp(d, content, world, p))}${term}`);
    });
  }
  if (p.properties.length > 0) {
    lines.push(`  ${ui.headers.properties}:`);
    p.properties.forEach((x, i) => {
      lines.push(`    ${i + 1}. ${text.propertyTypes[x.typeId]}, ${names.cities[x.cityId]}  ${fmt.money(x.value)}  (${x.rented ? ui.columns.rented : ui.columns.livedIn})`);
    });
  }
  if (life.items.length > 0) {
    lines.push(`  ${ui.headers.items}: ${life.items.map((item) => names.items[item.itemId] + (item.value > 0 ? ` ${fmt.money(item.value)}` : '')).join(', ')}`);
  }
  return lines;
}

export function market(pen: Pen, state: GameState): string[] {
  const { ui, fmt, names, content } = pen;
  const p = state.player;
  const world = state.timeline[state.round];
  const c = ui.columns;
  const lines = [` ${ui.headers.market}`, `  ${padEnd(c.asset, 30)}${padStart(c.change, 14)}${padStart(c.yield, 9)}${padStart(c.held, 14)}`];
  for (const asset of content.assets) {
    const name = `${padEnd(names.assets[asset.id].ticker, 6)} ${names.assets[asset.id].name}`;
    const held = Object.hasOwn(p.positions, asset.id) ? fmt.money(p.positions[asset.id].value) : '';
    const need = asset.minFinanceSkill ?? 0;
    const lock = need > p.life.financeSkill ? `   (${c.needsSkill} ${need})` : '';
    lines.push(`  ${padEnd(name, 30)}${padStart(fmt.change(world.assetReturnBp[asset.id]), 14)}${padStart(fmt.rate(assetYieldBp(asset, world)), 9)}${padStart(held, 14)}${lock}`);
  }
  return lines;
}

export function portfolio(pen: Pen, state: GameState): string[] {
  const { ui, fmt, names, content } = pen;
  const p = state.player;
  const c = ui.columns;
  const lines = [` ${ui.headers.portfolio}`, `  ${ui.cash} ${fmt.money(p.cash)}   ${ui.savings} ${fmt.money(p.deposit)}   ${ui.pension} ${fmt.money(p.pension)}`];
  for (const asset of content.assets) {
    if (!Object.hasOwn(p.positions, asset.id)) continue;
    const held = p.positions[asset.id];
    lines.push(`  ${padEnd(names.assets[asset.id].name, 24)}${padStart(fmt.money(held.value), 14)}   ${c.gain} ${fmt.signed(held.value - held.basis)}`);
  }
  if (Object.keys(p.positions).length === 0) lines.push(`  (${ui.empty})`);
  return lines;
}

export function shop(pen: Pen, state: GameState): string[] {
  const { ui, fmt, names, text, content } = pen;
  const c = ui.columns;
  const lines = [` ${ui.headers.shop}`];
  let ladder = '';
  content.items.forEach((item, i) => {
    if (item.ladder !== ladder) {
      ladder = item.ladder;
      lines.push(`  ${text.ladders[ladder]}`);
    }
    const quote = quoteItem(content, state, item.id);
    const owned = quote.owned ? `  ✓ ${c.owned}` : '';
    const upkeep = quote.upkeepAnnual > 0 ? `  ${c.upkeep} ${fmt.money(quote.upkeepAnnual)}${ui.perYear}` : '';
    const price = quote.forSale ? fmt.money(quote.price) : c.cardOnly;
    lines.push(`   ${padStart(String(i + 1), 2)}. ${padEnd(names.items[item.id], 28)}${padStart(price, 12)}  ${ui.status} +${item.status}${upkeep}${owned}`);
  });
  return lines;
}

export function homes(pen: Pen, state: GameState): string[] {
  const { ui, fmt, text, names, content } = pen;
  const c = ui.columns;
  const lines = [` ${ui.headers.homes} · ${names.cities[state.player.cityId]}`];
  for (const type of content.propertyTypes) {
    // The tax is paid in cash on top of the down payment, so the cash a purchase takes is the sum of the two.
    const quote = quoteProperty(content, state, type.id);
    lines.push(
      `  ${padEnd(text.propertyTypes[type.id], 16)}${padStart(fmt.money(quote.price), 14)}   ${c.down} ${fmt.money(quote.minDown)}   ` +
        `${c.cashNeeded} ${fmt.money(quote.minDown + quote.purchaseTax)}   ${ui.status} +${type.status}`,
    );
  }
  return lines;
}

export function cities(pen: Pen, state: GameState): string[] {
  const { ui, fmt, names, text, content } = pen;
  const world = state.timeline[state.round];
  const c = ui.columns;
  const lines = [` ${ui.headers.cities}`];
  for (const city of content.cities) {
    const tax = effectiveTax(city, world);
    const move = quoteMove(content, state, city.id).cost;
    lines.push(`  ${names.cities[city.id]}${city.id === state.player.cityId ? ' ●' : ''} — ${text.cities[city.id].tagline}`);
    lines.push(
      `    ${c.medianSalary} ${fmt.money(indexed(city.medianSalaryAnnual, world))}   ${c.living} ${fmt.money(indexed(city.livingCostAnnual, world))}   ` +
        `${c.incomeTax} ${tax.incomeRatesBp.map((r) => fmt.rate(r)).join(' / ')}   ${c.gainsTax} ${fmt.rate(tax.capitalGainsBp)}   ${c.moveCost} ${fmt.money(move)}`,
    );
  }
  return lines;
}

export function round(pen: Pen, preview: RoundPreview): string[] {
  const { ui, fmt, text } = pen;
  const t = ui.taxLines;
  const row = (label: string, amount: number) => `  ${padEnd(label, 34)}${padStart(fmt.signed(amount), 14)}`;
  const lines = [` ${ui.headers.tax}`];
  const income = preview.income;
  for (const [line, amount] of [['salary', income.salary], ['dividends', income.dividends], ['interest', income.interest], ['rent', income.rent], ['otherPassive', income.otherPassive]] as const) {
    if (amount !== 0) lines.push(row(text.ledger[line], amount));
  }
  const out = preview.expenses;
  for (const [line, amount] of [['living', out.living], ['otherExpenses', out.other], ['debtInterest', out.debtInterest], ['debtPrincipal', out.debtPrincipal]] as const) {
    if (amount !== 0) lines.push(row(text.ledger[line], -amount));
  }
  lines.push(row(t.income, -preview.tax.income), row(t.investment, -preview.tax.investment), row(t.property, -preview.tax.property));
  if (preview.purchaseTaxPaid !== 0) lines.push(row(t.purchase, -preview.purchaseTaxPaid));
  lines.push(THIN, `  ${padEnd(ui.cashAfterRound, 34)}${padStart(fmt.money(preview.cashAfter), 14)}`);
  const escape = preview.escape;
  lines.push(`  ${t.escape}: ${fmt.money(escape.passiveAfterTax)} / ${fmt.money(escape.outgoings)} (${escape.passiveAfterTax >= escape.outgoings ? t.escapeYes : t.escapeNo})`);
  return lines;
}

export function orderList(pen: Pen, typed: string[]): string[] {
  const { ui } = pen;
  if (typed.length === 0) return [` ${ui.headers.orders}`, `  ${ui.noOrders}`];
  return [` ${ui.headers.orders}`, ...typed.map((line, i) => `  ${i + 1}. ${line}`)];
}

export const help = (pen: Pen): string[] => [` ${pen.ui.headers.help}`, ...pen.ui.help.map((line) => `  ${line}`)];

/** Short phrases for what an effect does beyond its cash, which the caller shows as an exact figure. */
export function effectPhrases(pen: Pen, state: GameState, effects: Effects | undefined): string[] {
  if (effects === undefined) return [];
  const { ui, fmt, text, names } = pen;
  const e = ui.effects;
  const world = state.timeline[state.round];
  const signed = (n: number) => (n > 0 ? `+${n}` : `−${Math.abs(n)}`);
  const dollars = (amount: number) => fmt.money(indexed(amount, world));
  const out: string[] = [];

  if (effects.salaryModPct) out.push(`${signed(effects.salaryModPct)}% ${e.salaryMod}`);
  if (effects.salaryBoostPct) out.push(`${signed(effects.salaryBoostPct)}% ${e.salaryBoost}`);
  if (effects.careerSkill) out.push(`${signed(effects.careerSkill)} ${e.careerSkill}`);
  if (effects.financeSkill) out.push(`${signed(effects.financeSkill)} ${e.financeSkill}`);
  if (effects.status) out.push(`${signed(effects.status)} ${e.status}`);
  if (effects.focus) out.push(`−${effects.focus} ${e.focus}`);
  for (const entry of effects.recurring ?? []) {
    const years = entry.roundsLeft === null ? null : entry.roundsLeft * pen.content.yearsPerRound;
    out.push(e.yearly(`${entry.kind === 'passive' ? '+' : '−'}${dollars(entry.annual)}`, years));
  }
  if (effects.job?.leave) out.push(e.leaveJob);
  else if (effects.job?.career) out.push(`${e.newCareer} ${text.careers[effects.job.career].name}`);
  else if ((effects.job?.levelDelta ?? 0) > 0) out.push(e.promotion);
  else if ((effects.job?.levelDelta ?? 0) < 0) out.push(e.demotion);
  if (effects.moveCity) out.push(`${e.moveTo} ${names.cities[effects.moveCity]}`);
  if (effects.partner === null) out.push(e.partnerOut);
  else if (effects.partner !== undefined) out.push(e.partnerIn);
  if (effects.children) out.push(e.child(effects.children));
  if (effects.buyItem) out.push(`${e.get} ${names.items[effects.buyItem.itemId]}`);
  if (effects.invest) out.push(e.invest(dollars(effects.invest.amount), names.assets[effects.invest.assetId].name));
  if (effects.pension) out.push(`+${dollars(effects.pension)} ${e.pension}`);
  if (effects.loan) out.push(`${e.loan} ${dollars(effects.loan)}`);
  if (effects.property) out.push(`${e.buyHome} ${text.propertyTypes[effects.property.typeId].toLowerCase()}${effects.property.rented ? ` ${e.toRentOut}` : ''}`);
  if (effects.refinance) out.push(e.refinance[effects.refinance === 'fixed' ? 0 : 1]);
  if (effects.sellHome) out.push(e.sellHome);
  if (effects.homeValue) out.push(`${e.homeValue} ${fmt.signed(indexed(effects.homeValue, world))}`);
  if (effects.lose) out.push(e.lose(effects.lose.pct, effects.lose.what === 'deposit' ? e.savingsWord : text.assetClasses[effects.lose.what].toLowerCase()));
  if (effects.lifestyleFloor !== undefined) out.push(`${e.lifestyleFloor} ${text.lifestyleTiers[effects.lifestyleFloor].toLowerCase()}`);
  return out;
}

const joined = (cash: number, phrases: string[], pen: Pen): string =>
  [...(cash !== 0 ? [pen.fmt.signed(cash)] : []), ...phrases].join(', ') || pen.ui.nothing;

/** One card: its text, and for each option what it costs, what it does, its odds, and whether it is open. */
export function card(pen: Pen, state: GameState, def: CardDef, position: number, total: number): string[] {
  const { ui, text } = pen;
  const written = text.cards[def.id];
  const previews = previewCard(pen.content, state, def.id);
  const kind = def.category === 'world' ? `${text.categories.world} · ${ui.worldCard}` : text.categories[def.category];
  const lines = [THIN, ` ${ui.card(position, total)} · ${kind}`, ` ${written.title}`, ` ${written.body}`];
  def.options.forEach((option, i) => {
    const preview = previews[i];
    const fixed = joined(preview.cash, effectPhrases(pen, state, option.effects), pen);
    const hasFixed = preview.cash !== 0 || effectPhrases(pen, state, option.effects).length > 0;
    lines.push(`   ${i + 1}) ${written.options[i].label}${preview.available ? '' : `  [${ui.locked}]`}${hasFixed ? `  — ${fixed}` : ''}`);
    let weight = 0;
    for (const outcome of preview.outcomes) weight += outcome.weight;
    (option.outcomes ?? []).forEach((outcome, k) => {
      const share = (preview.outcomes[k].weight * 100) / weight;
      const chance = share >= 1 ? `${Math.round(share)}%` : `${share.toFixed(share >= 0.1 ? 1 : 3)}%`;
      lines.push(`        ${padStart(chance, 7)}  ${joined(preview.outcomes[k].cash, effectPhrases(pen, state, outcome.effects), pen)}`);
    });
  });
  return lines;
}

/** What happened to one card once it was answered. */
export function cardResult(pen: Pen, event: Extract<GameEvent, { kind: 'card' }>): string[] {
  const { ui, text, fmt } = pen;
  const written = text.cards[event.cardId];
  const lines = [`  ${written.title}: ${ui.youChose.toLowerCase()} “${written.options[event.option].label}”${event.cash !== 0 ? `  ${fmt.signed(event.cash)}` : ''}`];
  if (event.outcome !== null) lines.push(`    → ${written.options[event.option].outcomes[event.outcome]}`);
  return lines;
}

/** The ledger of a round and what else happened in it. */
export function ledger(pen: Pen, events: GameEvent[]): string[] {
  const { ui, text, fmt, names } = pen;
  const lines: string[] = [];
  for (const event of events) {
    switch (event.kind) {
      case 'ledger':
        lines.push(`  ${padEnd(text.ledger[event.line], 34)}${padStart(fmt.signed(event.amount), 14)}`);
        break;
      case 'orderRejected':
        lines.push(`  ${ui.refused}: ${text.reasons[event.reason]}`);
        break;
      case 'promoted':
        lines.push(`  ★ ${ui.promoted}: ${text.careers[event.careerId].levels[event.level]}`);
        break;
      case 'jobHunt':
        lines.push(`  ${event.success ? '★' : '·'} ${ui.jobHunt[event.success ? 0 : 1]}`);
        break;
      case 'financeSkill':
        lines.push(`  ★ ${ui.financeSkillUp} ${event.level}.`);
        break;
      case 'moved':
        lines.push(`  ✈ ${ui.moved} ${names.cities[event.cityId]}.`);
        break;
      case 'escaped':
        lines.push(`  ★★★ ${ui.escaped}`);
        break;
      case 'escapeLost':
        lines.push(`  ▼ ${ui.escapeLost}`);
        break;
      case 'bankrupt':
        lines.push(`  ✖ ${ui.bankrupt}`);
        break;
      case 'card':
        break;
    }
  }
  return lines;
}

export function ending(pen: Pen, state: GameState): string[] {
  const { ui, fmt, content } = pen;
  const p = state.player;
  // The engine's own breakdown: nothing about the score is worked out here.
  const score = scoreBreakdown(content, state);
  return [
    RULE,
    ` ${ui.theEnd} · ${ui.age} ${ageAt(pen, state.round)}`,
    RULE,
    `  ${ui.netWorth}: ${fmt.money(netWorth(p))}`,
    `  ${ui.realNetWorth}: ${fmt.money(realNetWorth(state))}`,
    `  ${p.escapedAtRound === null ? ui.neverEscaped : `${ui.escapedAtAge} ${ageAt(pen, p.escapedAtRound)}.`}`,
    `  ${ui.score}: (${ui.wealthPoints} ${score.wealth} + ${ui.statusPoints} ${score.status}) × ${(score.multiplierPct / 100).toFixed(2)} ${ui.escapeBonus.toLowerCase()} = ${fmt.number(score.total)}`,
    `  ${ui.statusNote}`,
  ];
}

/** An order as the player typed it, tidied. */
export const tidy = (typed: string): string => typed.trim().replace(/\s+/g, ' ');
