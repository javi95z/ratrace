import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  badgeArt, badges, cardArt, cityArt, cityIcon, content, CONTENT_VERSION, FAMILY_ART, focusArt, insuranceArt, itemArt, lifestyleArt,
  lives, portraitArt, propertyArt, rentTierArt, START_AGE, textFor,
} from '@ratrace/content';
import type { ItemDef } from '@ratrace/engine';

/**
 * Writes docs/catalogo.md: everything the game holds, with its picture and its numbers, read
 * straight from the content. Run it again whenever the content changes:
 *
 *   pnpm catalog
 */
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT = path.join(ROOT, 'docs/catalogo.md');
const { text, names } = textFor('es');

/** Where each sprite was cut to. The manifest says: a sprite is not always in the folder its name suggests. */
const manifest = JSON.parse(readFileSync(path.join(ROOT, 'art/clean/manifest.json'), 'utf8')) as { sprites: Record<string, { file: string }> };
/** A sprite as an image in the page, at the size it was drawn. */
const img = (sprite: string, alt = ''): string => `<img src="../art/clean/${manifest.sprites[sprite].file}" alt="${alt}">`;

// Spanish leaves four-digit numbers ungrouped; German groups them the same way and always.
const whole = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
const usd = (cents: number): string => `${whole.format(Math.round(cents / 100))} $`;
const pct = (bp: number): string => `${(bp / 100).toLocaleString('es-ES', { maximumFractionDigits: 2 })} %`;
const signed = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
const cell = (value: string): string => value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
const table = (head: string[], rows: string[][]): string =>
  [`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`, ...rows.map((row) => `| ${row.map(cell).join(' | ')} |`)].join('\n');

const out: string[] = [];
/** Each piece is a block of its own: a blank line after every one. */
const say = (...blocks: string[]) => out.push(...blocks.flatMap((block) => [block, '']));

const itemsByLadder = new Map<string, ItemDef[]>();
for (const item of content.items) itemsByLadder.set(item.ladder, [...(itemsByLadder.get(item.ladder) ?? []), item]);

say(
  '# Catálogo del juego',
  `Todo lo que hay en The Rat Race, con su dibujo y sus números. Generado desde \`packages/content\` (contenido ${CONTENT_VERSION}) con \`pnpm catalog\`: no lo edites a mano.`,
  'Los precios son en dólares del inicio de la partida; en el juego suben con la inflación.',
);
say(
  table(
    ['Qué', 'Cuántos'],
    [
      ['[Vidas](#vidas)', `${lives.length}`],
      ['[Carreras](#carreras)', `${content.careers.length}`],
      ['[Ciudades](#ciudades)', `${content.cities.length}`],
      ['[Objetos](#objetos)', `${content.items.length}, de ellos ${itemsByLadder.get('car')?.length ?? 0} coches`],
      ['[Inmuebles](#inmuebles)', `${content.propertyTypes.length}`],
      ['[Inversiones](#inversiones)', `${content.assets.length}`],
      ['[Modo de vida, alquiler, seguros y foco](#modo-de-vida-alquiler-seguros-y-foco)', '4 + 2 + 4 + 3'],
      ['[Cartas](#cartas)', `${content.cards.length}`],
      ['[Crisis](#crisis)', `${content.crises.length}`],
      ['[Insignias](#insignias)', `${badges.length}`],
    ],
  ),
);

// ---------------------------------------------------------------------------------------------
say('## Vidas', 'Cada vida se dibuja a los 22, 32, 45 y 58 años.');
for (const life of lives) {
  const start = life.start;
  const from = start.life;
  const written = text.lives[life.id];
  const job = from?.career ? `${text.careers[from.career.id].levels[from.career.level]} (${text.careers[from.career.id].name})` : 'Sin trabajo';
  const extras: string[] = [];
  for (const debt of start.debts) extras.push(`${text.debts[debt.kind]} de ${usd(debt.principal)} al ${pct(debt.fixedRateBp)}`);
  for (const home of from?.properties ?? []) extras.push(`${text.propertyTypes[home.typeId]} en propiedad`);
  for (const held of from?.holdings ?? []) extras.push(`${usd(held.value)} en ${names.assets[held.assetId].name}`);
  for (const entry of from?.recurring ?? []) extras.push(`${entry.kind === 'passive' ? 'Ingreso' : 'Gasto'} fijo de ${usd(entry.annual)} al año`);
  say(
    `### ${written.name}`,
    ([22, 32, 45, 58] as const).map((age) => img(portraitArt(life.id, age), `${written.name} a los ${age}`)).join(' '),
    table(
      ['', ''],
      [
        ['Empieza en', `${names.cities[start.cityId]}, con ${usd(start.cash)}`],
        ['Trabajo', job],
        ['Experiencia · Finanzas · Foco', `${from?.careerSkill ?? 0} · ${from?.financeSkill ?? 0}/3 · ${from?.focus ?? 3}`],
        ['Modo de vida', `${text.lifestyleTiers[start.lifestyleTier]}${from?.minLifestyleTier ? ` (no puede bajar de ${text.lifestyleTiers[from.minLifestyleTier]})` : ''}`],
        ['Empieza con', extras.length > 0 ? extras.join('; ') : 'Nada más'],
        ['Ventaja', written.perk],
        ['Desventaja', written.handicap],
        ['Se desbloquea', written.unlock],
      ],
    ),
  );
}

// ---------------------------------------------------------------------------------------------
say('## Carreras', 'El sueldo es un porcentaje del sueldo medio de la ciudad donde vives. Se asciende al llegar a la experiencia que pide el puesto siguiente.');
for (const career of content.careers) {
  say(
    `### ${text.careers[career.id].name}`,
    [
      `Horas extra: +${career.overtimePct} % de sueldo esa ronda.`,
      career.focus ? `Deja tiempo libre: +${career.focus} de foco cada ronda.` : '',
      career.cyclePct ? `El sueldo sigue a la economía: ${Object.entries(career.cyclePct).map(([regime, share]) => `${text.regimes[regime as keyof typeof text.regimes] ?? regime} ${signed(share)} %`).join(', ')}.` : '',
      career.fade ? `Oficio de jóvenes: desde los ${START_AGE + career.fade.fromRound * content.yearsPerRound} años, ${career.fade.pctPerRound} % menos de sueldo cada ronda, hasta un ${career.fade.maxPct} % menos.` : '',
    ].filter(Boolean).join(' '),
    table(
      ['Puesto', 'Sueldo', 'Experiencia', 'Estatus'],
      career.levels.map((level, i) => [text.careers[career.id].levels[i], `${level.salaryPct} % del sueldo medio`, `${level.minSkill}`, signed(level.status)]),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
say(
  '## Ciudades',
  'Cada ciudad tiene su perfil de noche y de día, y un icono.',
  `Mudarse cuesta el ${content.life.moveCostPct} % del coste de vida anual del destino y 1 de foco; con pareja, un ${content.life.movePartnerPct} % más, y un ${content.life.moveChildPct} % más por cada hijo. Quien se muda por su cuenta llega ${content.life.moveRungsLost} puesto por debajo, hasta su siguiente ascenso, y su pareja pasa ${content.life.partnerSettlingRounds * content.yearsPerRound} años sin sueldo. Un traslado ofrecido por una carta no cuesta nada de eso.`,
);
for (const city of content.cities) {
  say(
    `### ${img(cityIcon(city.id))} ${names.cities[city.id]}`,
    `${text.cities[city.id].tagline}`,
    `${img(cityArt(city.id), `${names.cities[city.id]} de noche`)} ${img(cityArt(city.id, 'day'), `${names.cities[city.id]} de día`)}`,
    table(
      ['', ''],
      [
        ['Sueldo medio', `${usd(city.medianSalaryAnnual)} al año`],
        ['Coste de vida', `${usd(city.livingCostAnnual)} al año`],
        ['Piso de referencia', usd(city.flatPrice)],
        ['Alquiler que rinde un inmueble', `${pct(city.rentYieldBp)} de su valor al año`],
        ['Impuesto sobre la renta', city.tax.incomeRatesBp.map((rate) => pct(rate)).join(' · ')],
        ['Impuesto sobre ganancias', pct(city.tax.capitalGainsBp)],
        ['Estatus por vivir aquí', signed(city.prestige)],
        ['Carreras que paga mejor', Object.entries(city.careerPayPct ?? {}).map(([career, share]) => `${text.careers[career].name} +${share - 100} %`).join(' · ')],
      ],
    ),
  );
}

// ---------------------------------------------------------------------------------------------
say(
  '## Objetos',
  'Dentro de una misma gama, la mejor cosa da su estatus entero y las demás un cuarto.',
  '«Sirve para» es lo que da además del estatus. Dentro de una gama solo cuenta lo mejor que se tenga; entre gamas, se suma. Con coche se abre además una opción mejor en la carta del encargo por cuenta propia, y siendo socio de algo, en la de trabajar por tu cuenta.',
  `Los objetos de ${content.life.agingLadders.map((ladder) => text.ladders[ladder].toLowerCase()).join(' y ')} pierden estatus al envejecer, al mismo ritmo que pierden valor, hasta quedarse en el ${content.life.agingFloorPct} % de lo que daban nuevos.`,
  '«Reventa» es lo que vale el día que se compra, sobre su precio, y lo que cambia cada ronda aparte de la inflación.',
  `A plazos se vende lo que dura y cuesta ${usd(content.life.itemFinanceMinPrice)} o más: un ${content.life.itemFinanceDownPct} % de entrada y el resto como préstamo personal, dentro del límite de préstamos. Si se vende, la deuda sigue.`,
);
/** What an item is good for beyond its status, in words. */
function uses(item: ItemDef): string {
  const perks = item.perks ?? {};
  const out: string[] = [];
  if (perks.moveCostOffPct) out.push(`Mudarse cuesta un ${perks.moveCostOffPct} % menos`);
  if (perks.studySkill) out.push(`+${perks.studySkill} de experiencia al estudiar`);
  if (perks.salaryPct) out.push(`+${perks.salaryPct} % de sueldo`);
  if (perks.jobHuntPct) out.push(`+${perks.jobHuntPct} puntos al buscar trabajo`);
  if (perks.focus) out.push(`+${perks.focus} de foco la ronda siguiente`);
  return out.join('. ');
}

for (const [ladder, items] of itemsByLadder) {
  say(
    `### ${text.ladders[ladder]}`,
    table(
      ['', 'Objeto', 'Precio', 'Mantenimiento', 'Estatus', 'Reventa', 'Sirve para', 'Notas'],
      items.map((item) => {
        const notes: string[] = [];
        if (item.kind === 'membership') notes.push('Cuota mientras lo tengas');
        if (item.kind === 'experience') notes.push(`El estatus dura ${item.boostRounds * content.yearsPerRound} años`);
        if (item.cardOnly) notes.push('Solo lo da una carta');
        if (item.cities) notes.push(`Solo en ${item.cities.map((id) => names.cities[id]).join(', ')}; se pierde al mudarse`);
        return [
          img(itemArt(item.id), names.items[item.id]),
          names.items[item.id],
          usd(item.price),
          item.upkeepAnnual > 0 ? `${usd(item.upkeepAnnual)}/año` : '',
          signed(item.status),
          item.kind === 'durable' && !item.cardOnly ? `${item.resaleStartPct} %, ${signed(item.resaleDriftBp / 100)} % por ronda` : '',
          uses(item),
          notes.join('. '),
        ];
      }),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
const madrid = content.cities[0];
say(
  '## Inmuebles',
  `El precio es un porcentaje del piso de referencia de cada ciudad. Como ejemplo va el precio en ${names.cities[madrid.id]}.`,
  table(
    ['', 'Inmueble', 'Precio', `En ${names.cities[madrid.id]}`, 'Estatus si vives en él', 'Uso', 'Alquiler'],
    [...content.propertyTypes]
      .sort((a, b) => a.pricePct - b.pricePct)
      .map((type) => [
        img(propertyArt(type.id), text.propertyTypes[type.id]),
        text.propertyTypes[type.id],
        `${type.pricePct} % del piso`,
        usd(Math.round((madrid.flatPrice * type.pricePct) / 100)),
        type.rentalOnly ? '' : signed(type.status),
        type.rentalOnly ? 'Solo para alquilar' : 'Para vivir o alquilar',
        `${type.rentPct ?? 100} % de lo que rinde una vivienda`,
      ]),
  ),
  'Quien no tiene casa propia vive de alquiler:',
  table(['', 'Alquiler', 'Gasto de vivienda', 'Estatus'], [0, 1].map((tier) => [img(rentTierArt[tier]), text.rentTiers[tier], `${content.life.rentTierHousingPct[tier]} %`, signed(content.life.rentTierStatus[tier])])),
  `Desde los ${START_AGE + content.life.roomLateRound * content.yearsPerRound} años, la habitación alquilada pasa a dar ${signed(content.life.roomLateStatus)} de estatus.`,
);

// ---------------------------------------------------------------------------------------------
say(
  '## Inversiones',
  'El nivel de finanzas dice qué se puede comprar por cuenta propia. Una carta puede dar algo de un nivel más alto.',
  table(
    ['Inversión', 'Ticker', 'Clase', 'Finanzas', 'Renta', 'Qué es'],
    content.assets.map((asset) => [
      names.assets[asset.id].name,
      names.assets[asset.id].ticker,
      text.assetClasses[asset.class],
      `${asset.minFinanceSkill ?? 0}`,
      asset.class === 'bond' ? 'Cupón según los tipos' : asset.yieldBp > 0 ? `${pct(asset.yieldBp)} al año` : '',
      text.assets[asset.id].blurb,
    ]),
  ),
);

// ---------------------------------------------------------------------------------------------
say(
  '## Modo de vida, alquiler, seguros y foco',
  table(
    ['', 'Modo de vida', 'Coste de vida', 'Estatus'],
    text.lifestyleTiers.map((name, tier) => [img(lifestyleArt[tier]), name, `${content.lifestyleMultiplierPct[tier]} %`, signed(content.life.lifestyleStatus[tier])]),
  ),
  table(
    ['', 'Seguro', 'Prima al año'],
    (Object.keys(insuranceArt) as Array<keyof typeof insuranceArt>).map((kind) => [img(insuranceArt[kind]), text.insurance[kind], `${pct(content.life.insurancePremiumBp[kind])} del coste de vida de la ciudad`]),
  ),
  table(
    ['', 'En qué poner el foco', 'Qué da'],
    [
      [img(focusArt.overtime), text.focusActions.overtime, 'Más sueldo esa ronda, según la carrera'],
      [img(focusArt.studyCareer), text.focusActions.studyCareer, `+${content.life.studySkill} de experiencia, además del +${content.life.workSkill} por trabajar`],
      [img(focusArt.jobHunt), text.focusActions.jobHunt, `${content.life.jobHuntChancePct} % de probabilidad de un +${content.life.jobHuntRaisePct} % de sueldo para siempre`],
    ],
  ),
  `Familia: una pareja añade un ${content.life.partnerCostPct} % del coste de vida, y cada hijo un ${content.life.childCostPct} % durante ${content.life.childRounds * content.yearsPerRound} años.`,
  FAMILY_ART.map((sprite) => img(sprite)).join(' '),
);

// ---------------------------------------------------------------------------------------------
say('## Cartas', `Cada ronda reparte ${content.life.cardsPerRound}. La primera opción de cada carta es la que no cuesta ni compra nada.`);
const categories = [...new Set(content.cards.map((card) => card.category))];
for (const category of categories) {
  const cards = content.cards.filter((card) => card.category === category);
  say(
    `### ${text.categories[category]} (${cards.length})`,
    table(
      ['', 'Carta', 'Opciones'],
      cards.map((card) => {
        const written = text.cards[card.id];
        return [img(cardArt[card.id], written.title), `**${written.title}**<br>${written.body}`, written.options.map((option, i) => `${i + 1}. ${option.label}`).join('<br>')];
      }),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
say(
  '## Crisis',
  `Una partida de cada tres, más o menos (${content.world.crisisChancePct} %), tiene una crisis: unas rondas seguidas en las que el mundo se sale de su curso. Nunca antes de los ${22 + content.world.crisisEarliestRound * content.yearsPerRound} años, y nunca más de una por vida.`,
  'Cada ronda de una crisis cambia primero el mundo en el que se despierta el jugador (economía, tipos, inflación) y luego pesa sobre lo que rinden las inversiones de esa ronda.',
);
const shift = (bp: number | undefined, what: string): string | null => (bp ? `${what} ${bp > 0 ? '+' : '−'}${pct(Math.abs(bp))}` : null);
for (const crisis of content.crises) {
  const written = text.crises[crisis.id];
  say(
    `### ${written.name}`,
    written.intro,
    table(
      ['Año', 'Qué pasa', 'Al llegar', 'Sobre lo que rinde la ronda'],
      crisis.phases.map((phase, i) => [
        `${i + 1}`,
        written.years[i],
        [phase.regime ? text.regimes[phase.regime] : null, phase.cryptoPhase ? `cripto: ${text.cryptoPhases[phase.cryptoPhase]}` : null, shift(phase.rateBp, 'tipos'), shift(phase.inflationBp, 'inflación')].filter(Boolean).join('; '),
        [shift(phase.equityBp, 'bolsa'), shift(phase.propertyBp, 'vivienda'), shift(phase.goldBp, 'oro'), shift(phase.cryptoBp, 'cripto')].filter(Boolean).join('; '),
      ]),
    ),
  );
}

// ---------------------------------------------------------------------------------------------
say('## Insignias');
const groups = [...new Set(badges.map((badge) => badge.group))];
for (const group of groups) {
  say(
    `### ${text.badgeGroups[group]}`,
    table(
      ['', 'Insignia', 'Cómo se consigue'],
      badges.filter((badge) => badge.group === group).map((badge) => [img(badgeArt(badge.id), text.badges[badge.id].name), text.badges[badge.id].name, text.badges[badge.id].how]),
    ),
  );
}

writeFileSync(OUT, `${out.join('\n').trimEnd()}\n`);
console.log(`catalog: ${path.relative(ROOT, OUT)} written, ${out.length} lines`);
