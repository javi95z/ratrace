import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CELEB_ART,
  assetClassArt,
  assetLogo,
  GOOGLE_LOGO,
  backdropArt,
  businessStageArt,
  MAP_ART,
  milestoneArt,
  RAT_POSES,
  ratArt,
  balanceArt,
  cardArt,
  cardArtOf,
  exAsManArt,
  LIVES_DRAWN_AS_WOMEN,
  careerArt,
  CITY_LIGHTS,
  cityArt,
  cityIcon,
  crestArt,
  DEBT_ART,
  debtArt,
  endingArt,
  ENDINGS,
  FAMILY_ART,
  familyArt,
  focusArt,
  skillArt,
  businessArt,
  CITY_HOME_KINDS,
  CITY_RENTAL_KINDS,
  CITY_HOMES_DRAWN,
  USED_ART,
  PERCENTILE_ART,
  repairArt,
  FRAME_ART,
  frameArt,
  HOME_LIFE_ART,
  homeLifeArt,
  insuranceArt,
  itemArt,
  lifestyleArt,
  loopArt,
  LOOPS,
  LIFE_MILESTONE_ART,
  GUIDE_ART,
  RISK_ART,
  momentArt,
  perkArt,
  PORTRAIT_AGES,
  portraitArt,
  propertyArt,
  rentTierArt,
  rentTierIcon,
  topicArt,
  workArt,
  ruleArt,
  CHALLENGE_ART,
  RETIRED_ART,
  GIFT_ART,
  HANDOVER_ART,
  HEALTH_RISK_ART,
  saleSignArt,
} from './art';
import { content } from './content';
import { lives } from './lives';
import { PEOPLE, personArt } from './people';
import { names } from './names';
import type { Locale } from './names';
import { fillNames, homeName, rawText, textFor } from './text';

const LOCALES: Locale[] = ['en', 'es', 'ru'];
/** Every language the text was translated into, from the English it is written in. */
const TRANSLATED: Locale[] = ['es', 'ru'];

/**
 * Russian words that are written with ё and here are not. The letter is optional in a newspaper
 * and not in this game. Only forms that are never right with е are listed.
 */
const WITHOUT_YO = new RegExp(
  `(?<![а-яё])(?:${[
    'еще', 'ее', 'нее', 'мое', 'твое', 'свое', 'твоем', 'своем', 'партнер[а-я]*', 'ребенок', 'ребенка', 'ребенку', 'ребенком', 'ребенке', 'учеба', 'учебы', 'учебе', 'учебу', 'учебой', 'заем', 'наем',
    'прием', 'приема', 'приему', 'приемом', 'приеме', 'объем[а-я]*', 'счет', 'отчет[а-я]*', 'расчет[а-я]*', 'самолет[а-я]*', 'перелет[а-я]*', 'полет[а-я]*', 'вперед',
    'идешь', 'живешь', 'берешь', 'даешь', 'ждешь', 'придешь', 'уйдешь', 'найдешь', 'начнешь', 'вернешь', 'поймешь', 'продаешь', 'отдаешь', 'сдаешь', 'остаешься', 'вернешься',
    'идет', 'живет', 'дает', 'ждет', 'придет', 'уйдет', 'растет', 'несет', 'ведет', 'продает', 'отдает', 'сдает', 'остается', 'придется', 'удается', 'вернется', 'начнется', 'найдется',
  ].join('|')})(?![а-яё])`,
  'i',
);
const ids = (list: ReadonlyArray<{ id: string }>) => list.map((x) => x.id).sort();
const keys = (record: object) => Object.keys(record).sort();

/** Every string in a value, with the path that leads to it. */
function strings(value: unknown, path = ''): Array<[string, string]> {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value !== 'object' || value === null) return [];
  return Object.entries(value).flatMap(([key, entry]) => strings(entry, path === '' ? key : `${path}.${key}`));
}

/** The shape of a value: its keys, all the way down, without the strings. */
function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape);
  if (typeof value === 'object' && value !== null) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, shape(v)]));
  return typeof value;
}

describe.each(LOCALES)('content text: %s', (locale) => {
  const text = rawText(locale);
  const pack = names[locale];

  it('names every city, asset and item, and nothing that does not exist', () => {
    expect(keys(pack.cities)).toEqual(ids(content.cities));
    expect(keys(pack.assets)).toEqual(ids(content.assets));
    expect(keys(pack.items)).toEqual(ids(content.items));
    for (const asset of Object.values(pack.assets)) {
      expect(asset.ticker).toMatch(/^[A-Z0-9]{2,5}$/);
    }
    expect(new Set(Object.values(pack.assets).map((a) => a.ticker)).size).toBe(content.assets.length);
  });

  it('describes every city, asset, career, ladder, home and life, and nothing that does not exist', () => {
    expect(keys(text.cities)).toEqual(ids(content.cities));
    expect(keys(text.assets)).toEqual(ids(content.assets));
    expect(keys(text.careers)).toEqual(ids(content.careers));
    for (const career of content.careers) {
      expect(text.careers[career.id].levels, career.id).toHaveLength(career.levels.length);
    }
    expect(keys(text.ladders)).toEqual([...new Set(content.items.map((item) => item.ladder))].sort());
    expect(keys(text.propertyTypes)).toEqual(ids(content.propertyTypes));
    expect(keys(text.lives)).toEqual(ids(lives));
    expect(keys(text.assetClasses)).toEqual([...new Set(content.assets.map((a) => a.class))].sort());
  });

  it('says what follows every choice the dice do not decide, and leaves the rest to the dice', () => {
    for (const card of content.cards) {
      card.options.forEach((option, i) => {
        const written = text.cards[card.id].options[i];
        const dice = (option.outcomes ?? []).length > 0;
        if (dice) expect(written.after, `${locale} ${card.id} ${i}`).toBeUndefined();
        else {
          expect(written.after?.length ?? 0, `${locale} ${card.id} ${i}`).toBeGreaterThan(12);
          // Short enough to read at a glance under the card.
          expect(written.after?.length ?? 0, `${locale} ${card.id} ${i}`).toBeLessThanOrEqual(90);
          expect(written.after, `${locale} ${card.id} ${i}`).toMatch(/[.!?]$/);
        }
      });
    }
  });

  it('has text for every card, with a label for each option and a line for each outcome', () => {
    expect(keys(text.cards)).toEqual(ids(content.cards));
    expect(keys(text.crises)).toEqual(ids(content.crises));
    for (const crisis of content.crises) expect(text.crises[crisis.id].years, `${locale} ${crisis.id}`).toHaveLength(crisis.phases.length);
    for (const card of content.cards) {
      const written = text.cards[card.id];
      expect(written.options, card.id).toHaveLength(card.options.length);
      card.options.forEach((option, i) => {
        expect(written.options[i].outcomes, `${card.id} option ${i}`).toHaveLength(option.outcomes?.length ?? 0);
      });
    }
  });

  it('has no empty sentence and no stray space', () => {
    for (const [path, sentence] of strings(text)) {
      expect(sentence.trim().length, path).toBeGreaterThan(0);
      expect(sentence, path).toBe(sentence.trim());
      expect(sentence, path).not.toMatch(/ {2}/);
    }
  });

  it('is typeset one way throughout', () => {
    const all = strings(text);
    const broken = (test: (sentence: string) => boolean) => all.filter(([, sentence]) => test(sentence)).map(([path]) => path);
    // Three dots are one character, and a dash is never a spaced hyphen.
    expect(broken((s) => s.includes('...'))).toEqual([]);
    expect(broken((s) => / - /.test(s))).toEqual([]);
    expect(broken((s) => / [,.;:!?](\s|$)/.test(s))).toEqual([]);
    if (locale === 'en') {
      // English: straight apostrophes and quotes, and a percent sign against its number.
      expect(broken((s) => /[‘’“”«»]/.test(s))).toEqual([]);
      expect(broken((s) => /\d %/.test(s))).toEqual([]);
    } else if (locale === 'ru') {
      // Russian: angle quotes, a percent sign against its number, a dash that is a dash, and ё wherever it belongs.
      expect(broken((s) => /["“”‘’']/.test(s))).toEqual([]);
      expect(broken((s) => /\d %/.test(s))).toEqual([]);
      expect(broken((s) => /[¿¡]/.test(s))).toEqual([]);
      expect(broken((s) => /[а-яё] – | -- /i.test(s))).toEqual([]);
      expect(broken((s) => WITHOUT_YO.test(s))).toEqual([]);
      // Written in its own letters: a sentence with words has Cyrillic ones, unless it is a name the name pack fills in.
      expect(broken((s) => /\p{L}/u.test(s.replace(/\{[^{}]*\}/g, '')) && !/[а-яё]/i.test(s))).toEqual([]);
      // And it never tells the player whether they are a man or a woman: no ending offered both ways, no «ты» with a verb in the past.
      expect(broken((s) => /\((?:а|ла|ая|на)\)|[а-яё]\/[а-яё]{1,3}(?![а-яё])/i.test(s) || /(?<![а-яё])ты (?:не )?(?:уже |ещё |так и не |сам[а-я]* )?[а-яё]+(?:л|ла|лся|лась)(?![а-яё])/i.test(s))).toEqual([]);
      // Nor with the short words that agree with «ты» as a verb in the past does: «ты готов», «ты уволен», «ты сама».
      expect(broken((s) => /(?<![а-яё])ты (?:[а-яё]+ ){0,2}(?:готов|должен|рад|уволен|принят|обязан|согласен|уверен|виноват|свободен|женат|богат|беден|здоров|болен|сам|сама|одинок)(?![а-яё])|(?<![а-яё])(?:замужем|женат)(?![а-яё])/i.test(s))).toEqual([]);
      // The names it gives to things are held to the same typesetting as its sentences.
      const named = strings(pack).filter(([, name]) => /["“”‘’']/.test(name) || WITHOUT_YO.test(name)).map(([path]) => path);
      expect(named).toEqual([]);
    } else {
      // Spanish: angle quotes, a space before the percent sign, and a question or an exclamation opened as well as closed.
      expect(broken((s) => /["“”]/.test(s))).toEqual([]);
      expect(broken((s) => /\d%/.test(s))).toEqual([]);
      expect(broken((s) => (s.match(/\?/g)?.length ?? 0) !== (s.match(/¿/g)?.length ?? 0))).toEqual([]);
      expect(broken((s) => (s.match(/!/g)?.length ?? 0) !== (s.match(/¡/g)?.length ?? 0))).toEqual([]);
    }
  });

  it('keeps titles and option labels short enough for a phone', () => {
    // As the player reads them: with every name written out, which may be longer than the placeholder that stands for it.
    for (const card of Object.values(textFor(locale).text.cards)) {
      expect(card.title.length, card.title).toBeLessThanOrEqual(45);
      expect(card.body.length, card.title).toBeLessThanOrEqual(140);
      for (const option of card.options) {
        expect(option.label.length, option.label).toBeLessThanOrEqual(60);
        for (const outcome of option.outcomes) expect(outcome.length, outcome).toBeLessThanOrEqual(90);
      }
    }
  });

  it('fills every name placeholder, and leaves only the ones the interface fills', () => {
    const { text: ready } = textFor(locale);
    for (const [path, sentence] of strings(ready)) {
      const left = sentence.match(/\{[^}]*\}/g) ?? [];
      // The player's own people are named by the interface, from the life's rivals (`{rival:<who>}`).
      expect(left.filter((p) => p !== '{city}' && p !== '{asset}' && !/^\{rival:(classmate|cousin|ex)\}$/.test(p)), path).toEqual([]);
    }
    expect(ready.cards.life_rolex_call.body).toContain(pack.items.watch_rolex);
    expect(ready.cards.inv_hot_tip.body).toContain('Tesla');
  });

  it('refuses a placeholder the name pack does not know', () => {
    expect(() => fillNames('A {item:jetpack} for you', pack)).toThrow('no name for {item:jetpack}');
    expect(() => fillNames('{asset:tulips}', pack)).toThrow('no name for {asset:tulips}');
    expect(fillNames('Move to {city:dubai} with {brand:google}', pack)).toBe(`Move to ${pack.cities.dubai} with Google`);
  });

  it('can be shown with a different name pack', () => {
    const parody = structuredClone(pack);
    parody.items.watch_rolex = 'Rolecks Diver';
    expect(textFor(locale, parody).text.cards.life_rolex_call.body).toContain('Rolecks Diver');
  });
});

describe.each(TRANSLATED)('content text: %s beside the English', (locale) => {
  it('has the same shape, key for key', () => {
    expect(shape(rawText(locale))).toEqual(shape(rawText('en')));
    expect(shape(names[locale])).toEqual(shape(names.en));
  });

  it('uses the same placeholders in the same sentences', () => {
    const placeholders = (sentence: string) => (sentence.match(/\{[^}]*\}/g) ?? []).sort();
    const translated = new Map(strings(rawText(locale)));
    /** Names only one language knows, given there and told in its own words elsewhere: the Spanish Christmas lottery. */
    const ownNames: Record<string, Set<string>> = { es: new Set(['cards.luck_lottery.title']), ru: new Set() };
    for (const [path, sentence] of strings(rawText('en'))) {
      if (ownNames[locale].has(path)) continue;
      expect(placeholders(translated.get(path) ?? ''), path).toEqual(placeholders(sentence));
    }
  });

  it('is really another language: its card text is not a copy of the English', () => {
    /** Words that are the same in English and in this language. */
    const same: Record<string, Set<string>> = {
      es: new Set(['cards.life_ibiza.title', 'cards.life_black_friday.title', 'cards.career_remote_work.options.2.outcomes.1']),
      ru: new Set(),
    };
    const translated = new Map(strings(rawText(locale).cards, 'cards'));
    const copies = strings(rawText('en').cards, 'cards').filter(([path, sentence]) => translated.get(path) === sentence && !same[locale].has(path));
    expect(copies).toEqual([]);
  });
});

describe('content art', () => {
  const path = fileURLToPath(new URL('../../../art/clean/manifest.json', import.meta.url));
  const manifest = JSON.parse(readFileSync(path, 'utf8')) as { sprites: Record<string, unknown> };
  const has = (sprite: string) => Object.hasOwn(manifest.sprites, sprite);

  it('gives every card a scene of its own, and no scene to a card that does not exist', () => {
    expect(keys(cardArt)).toEqual(ids(content.cards));
    expect(new Set(Object.values(cardArt)).size).toBe(content.cards.length);
  });

  it("draws the player's ex as the other sex to the player: a man for a life drawn as a woman, a woman otherwise", () => {
    for (const cardId of Object.keys(exAsManArt)) expect(cardArt[cardId], cardId).toBeDefined();
    expect(cardArtOf('ex_new_car', 'nurse')).toBe('card.ex_new_car_man');
    expect(cardArtOf('ex_new_car', 'engineer')).toBe('card.ex_new_car');
    expect(cardArtOf('ex_new_car', null)).toBe('card.ex_new_car');
    // Every other card is drawn the same for everyone.
    expect(cardArtOf('cousin_wedding', 'nurse')).toBe(cardArt.cousin_wedding);
    for (const lifeId of LIVES_DRAWN_AS_WOMEN) expect(lives.some((life) => life.id === lifeId), lifeId).toBe(true);
  });

  it('points only at sprites that exist', () => {
    const wanted: string[] = [
      ...Object.values(cardArt),
      // The ex as a man, for a player drawn as a woman.
      ...Object.values(exAsManArt),
      // Each of the people who come back, in both moods.
      ...PEOPLE.flatMap((who) => [personArt(who, 'pleased'), personArt(who, 'upset')]),
      ...content.items.map((item) => itemArt(item.id)),
      // Every kind plain, and as each city that sells it draws it.
      ...content.propertyTypes.flatMap((type) => [
        propertyArt(type.id),
        ...content.cities.filter((city) => (type.cities ?? [city.id]).includes(city.id) && !(type.notIn ?? []).includes(city.id)).map((city) => propertyArt(type.id, city.id)),
      ]),
      ...rentTierArt,
      ...content.cities.flatMap((city) => [...CITY_LIGHTS.map((light) => cityArt(city.id, light)), cityIcon(city.id)]),
      ...FAMILY_ART,
      ...Object.values(momentArt),
      ...lives.flatMap((life) => PORTRAIT_AGES.map((age) => portraitArt(life.id, age))),
      ...Object.values(assetClassArt),
      ...lifestyleArt,
      ...rentTierIcon,
      ...Object.values(insuranceArt),
      ...Object.values(focusArt),
      ...Object.values(topicArt),
      // A sign and a workplace at each of three stages for every career; a sign for every use of a thing,
      // every kind of debt and every line of the balance sheet; the frames, the crests and the loops.
      ...content.careers.flatMap((career) => [careerArt(career.id), ...career.levels.map((_, level) => workArt(career.id, level, career.levels.length))]),
      ...Object.values(perkArt),
      ...DEBT_ART,
      ...Object.values(balanceArt),
      ...FRAME_ART,
      ...content.cities.map((city) => crestArt(city.id)),
      ...LOOPS.flatMap((loop) => loopArt(loop)),
      ...ENDINGS.map((ending) => endingArt(ending)),
      ...HOME_LIFE_ART,
      ...Object.values(skillArt),
      ...content.business.types.map((type) => businessArt(type.id)),
      USED_ART,
      PERCENTILE_ART,
      ...['car', 'watch', 'other'].map(repairArt),
      ...Object.values(ruleArt),
      ...Object.values(CHALLENGE_ART),
      ...Object.values(RETIRED_ART),
      GIFT_ART,
      HANDOVER_ART,
      HEALTH_RISK_ART,
      ...content.cities.map((city) => saleSignArt(city.id)),
      ...Object.values(assetLogo).filter((logo): logo is string => logo !== undefined),
      GOOGLE_LOGO,
      // v14: the rat's poses, a backdrop for each city, the milestones, every business at three sizes, and the map.
      ...RAT_POSES.map(ratArt),
      ...content.cities.map((city) => backdropArt(city.id)),
      ...Object.values(milestoneArt),
      ...content.business.types.flatMap((type) => [1, 2, 3].map((n) => businessStageArt(type.id, n === 1 ? 0 : n === 2 ? type.scale / 2 : type.scale, type.scale))),
      MAP_ART,
      // v17: the famous, a portrait each.
      ...CELEB_ART,
      // v21: a life's milestones, the guide and the warnings of a risk.
      ...Object.values(LIFE_MILESTONE_ART),
      ...Object.values(GUIDE_ART),
      ...Object.values(RISK_ART),
    ];
    expect(wanted.filter((sprite) => !has(sprite))).toEqual([]);
    const rungs = content.careers.reduce((sum, career) => sum + career.levels.length, 0);
    // The cards (284), the ex as a man (1) and the faces of the six people who come back, pleased and upset (6 * 2), first.
    expect(wanted.length).toBe(284 + 1 + 6 * 2 + 67 + 5 + 4 + 2 + 3 + 6 + 26 + 15 * 10 + 8 + 10 + 2 + 2 + 6 * 5 + 8 + 6 + 20 * 4 + 6 + (4 + 2 + 4 + 11 + 8) + (11 + rungs) + 5 + 4 + 8 + 4 + 6 + 3 * 4 + 3 + 3 + 7 + 5 + 2 + 3 + 13 + 1 + 4 * 7 + 5 + (8 + 10 + 6 + 15 + 1) + 14 + 2 * 4 + (8 + 2 + 2));
    // Every kind of property plain (26); as each of the ten cities draws its eleven homes and four kinds to let (15 * 10),
    // the block of the eight that sell one (8), and each city's own kind (10). Time with the family and a rest, a sign each: the 2.
    // Five rules of the weekly challenge came later, each with its icon: the last 5.
    // Four cities came later, each with its four skylines, a landmark, a crest and a "for sale" board: the 4 * 7.
    // v21: two loops more, the cheer and the firework (2 * 4); the eight milestones' scenes, the guide's two icons and the two warnings of a risk.
    // A brand mark belongs to an asset the market has.
    for (const assetId of Object.keys(assetLogo)) expect(content.assets.some((asset) => asset.id === assetId), assetId).toBe(true);
    // Nobody is drawn at home with someone who lives alone; a couple, a family and a full house each have their picture.
    expect([[false, 0], [true, 0], [false, 1], [true, 2], [true, 3]].map(([partner, children]) => homeLifeArt({ partner: partner as boolean, children: children as number }))).toEqual([null, 'family.couple', 'family.children', 'family.children', 'family.full_house']);
    // Every career is drawn at its three stages, and a frame is earned by status, plainest first.
    for (const career of content.careers) expect(new Set(career.levels.map((_, level) => workArt(career.id, level, career.levels.length))).size, career.id).toBe(3);
    expect([0, 24, 25, 59, 60, 99, 100, 500].map((status) => frameArt(status))).toEqual(['frame.plain', 'frame.plain', 'frame.bronze', 'frame.bronze', 'frame.silver', 'frame.silver', 'frame.gold', 'frame.gold']);
    expect(debtArt({ kind: 'personalLoan', forItem: 'car_seat_ibiza' })).toBe('icon.debt_instalments');
    expect(debtArt({ kind: 'mortgageVariable' })).toBe('icon.debt_mortgage');
  });

  it('draws who shares a life: the couple, then the youngest child, and a full house as one picture', () => {
    const home = (over: Partial<Parameters<typeof familyArt>[0]>) => familyArt({ partner: false, married: false, dating: false, children: [], childRounds: 9, ...over });
    expect(home({})).toEqual(['icon.single']);
    expect(home({ dating: true })).toEqual(['icon.dating']);
    expect(home({ partner: true })).toEqual(['icon.partner']);
    expect(home({ partner: true, married: true })).toEqual(['icon.married']);
    expect(home({ children: [9] })).toEqual(['icon.single', 'icon.baby']);
    expect(home({ partner: true, children: [5] })).toEqual(['icon.partner', 'icon.child']);
    expect(home({ children: [2] })).toEqual(['icon.single', 'icon.teen']);
    // The youngest is the one shown.
    expect(home({ children: [2, 8] })).toEqual(['icon.single', 'icon.baby']);
    expect(home({ partner: true, married: true, children: [2, 8] })).toEqual(['icon.family_four']);
    for (const sprite of [home({}), home({ partner: true, children: [5] }), home({ partner: true, children: [1, 1] })].flat()) expect(FAMILY_ART).toContain(sprite);
  });

  it('gives each way of living, each insurance, each use of focus and each kind of news a picture', () => {
    expect(lifestyleArt).toHaveLength(content.lifestyleMultiplierPct.length);
    expect(keys(insuranceArt)).toEqual(keys(content.life.insurancePremiumBp));
    expect(keys(focusArt)).toEqual(['askRaise', 'exercise', 'jobHunt', 'networking', 'overtime', 'studyCareer', 'studyFinance', 'studyLanguages', 'studyNegotiation', 'tease', 'careerMove', 'familyTime', 'unwind'].sort());
    expect(keys(skillArt)).toEqual(['career', 'finance', 'health', 'languages', 'management', 'negotiation', 'network']);
    expect(keys(topicArt)).toEqual(['asset', 'crypto', 'government', 'inflation', 'noise', 'property', 'rates', 'regime', 'taxes']);
    // As many filler headlines in every language as the world draws from.
    for (const locale of ['en', 'es', 'ru'] as const) {
      expect(rawText(locale).headlines.noise).toHaveLength(content.world.noiseHeadlines);
      expect(rawText(locale).headlines.government).toHaveLength(content.world.governmentHeadlines);
    }
  });

  it('gives every choice a picture of its own: no two ways of living, insurances or uses of focus share one', () => {
    for (const set of [lifestyleArt, rentTierIcon, Object.values(insuranceArt), Object.values(focusArt), Object.values(topicArt)]) {
      expect(new Set(set).size).toBe(set.length);
    }
  });
});

describe('the homes of each city', () => {
  it('names every kind of home, and every kind to let it sells, in every city, in every language', () => {
    for (const locale of ['en', 'es', 'ru'] as const) {
      const { text } = textFor(locale);
      for (const city of content.cities) {
        const named = text.cityHomes[city.id] ?? {};
        const sold = CITY_RENTAL_KINDS.filter((kind) => !(content.propertyTypes.find((type) => type.id === kind)?.notIn ?? []).includes(city.id));
        expect(Object.keys(named).sort(), `${locale} ${city.id}`).toEqual([...CITY_HOME_KINDS, ...sold].sort());
        for (const kind of [...CITY_HOME_KINDS, ...sold]) expect(homeName(text, kind, city.id), `${locale} ${city.id} ${kind}`).not.toBe(text.propertyTypes[kind]);
      }
      // What only one city sells is named for that city already.
      for (const type of content.propertyTypes) expect(text.propertyTypes[type.id], `${locale} ${type.id}`).toBeTruthy();
    }
    // Every kind a city draws is a kind people live in.
    for (const kind of CITY_HOME_KINDS) expect(content.propertyTypes.find((type) => type.id === kind)?.rentalOnly, kind).not.toBe(true);
    expect(propertyArt('flat', 'madrid')).toBe(CITY_HOMES_DRAWN.includes('madrid') ? 'home.madrid.flat' : 'home.flat');
  });
});
