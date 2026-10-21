import { balanceArt, familyArt, homeLifeArt, homeName, insuranceArt, itemArt, lifestyleArt, propertyArt, rentTierIcon } from '@ratrace/content';
import { cashflow, homeOf, netWorth, quoteItem, quoteLiving, quoteOwnedProperty, taxAnnual } from '@ratrace/engine';
import type { GameView, InsuranceKind, LifestyleTier, OwnedItem, RentTier } from '@ratrace/engine';
import { ageAt, insuranceCover } from '@ratrace/core/game/present';
import { useRouter } from 'expo-router';
import { createContext, memo, useCallback, useContext, useState, type ReactNode } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { sheetsGone } from '../../ui/back';
import { Framed } from '../../ui/Frame';
import { GOLD } from '../../ui/frames';
import { Bare, Button, Notice, Panel, pressDown, Raised, Row, Tag, usePress } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { spriteBox } from '../../ui/sprites';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, TOUCH, type ColorToken } from '../../ui/theme';
import { useGame, useInRoom, useSaving, useSettings, useT, useWords } from '../context';
import { BalanceSheet, shrunkTo } from './Balance';
import type { BalanceLine } from './Balance';
import { PAY_DROP } from './CareerPreview';
import { bannerSize } from './Challenge';
import { HealthCoverNote } from './HealthCover';
import { useShown } from './Hud';
import { ItemCost } from './ItemCost';
import { ItemUses } from './ItemUses';
import { RivalsBoard, webLine } from './Rivals';
import { realStatus, StatusNote } from './StatusNote';
// A stand-in until the lanes are merged: Task 14's `WorkPanel` (./Work) takes its place (see WorkPanelStub.tsx).
import { WorkPanel } from './WorkPanelStub';

/*
 * The web's Profile.tsx, on the phone. What the phone leaves out: the desk's side column (the profile is always the sheet the portrait opens, as on a
 * web phone), and a life in a room (`useInRoom` is false: the way out is always there).
 */

const INSURANCES: InsuranceKind[] = ['health', 'home', 'life'];

/**
 * What the profile has open from the start, where a scene says so (the phone's initial state, as the Hud's `open` and Finance's `FinanceOpened`; the web's
 * scene page presses what opens it): one of the things owned, by its id, or a line of the balance sheet.
 */
export const ProfileOpened = createContext<{ item?: string; line?: BalanceLine }>({});

/** The web's `mt-1 border-t-2 border-night-900 pt-2` on the line that sums up the lines above it. */
const TOTAL: ViewStyle = { marginTop: 4, borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 8 };

/** A figure of a line in a colour (the web's `<span className="text-…">` in a Row's pixel cell). */
const Figure = ({ tone, children }: { tone: ColorToken; children: string }) => (
  <PixelText size={15} tone={tone} style={{ textAlign: 'right' }}>
    {children}
  </PixelText>
);

/** The mark of a row that opens (the web's `ml-1.5 text-[11px] text-ink-300` ▸, inline after the figure, in its pixel cell's letter spacing). */
const More = ({ top }: { top: number }) => (
  <View aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ marginLeft: 6, marginTop: top }}>
    <PixelText size={11} tone="ink-300" style={{ letterSpacing: 15 * 0.03 }}>
      {'▸'}
    </PixelText>
  </View>
);

/**
 * The right side of a row that opens: its figure and the mark, on one baseline, in the line of the Row's pixel cell (15, a line of 1.1), as the web's
 * inline spans are. `size` is the figure's (the net worth's is 19, in the cell's letter spacing).
 */
function Opening({ size = 15, tone = 'cream', children }: { size?: number; tone?: ColorToken; children: string }) {
  const { locale } = useSettings();
  const line = webLine([['pixel', 15, 15 * 1.1], ['pixel', size, size * 1.1], ['pixel', 11, 11 * 1.1]], locale);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', height: line.height }}>
      <PixelText size={size} tone={tone} style={{ marginTop: line.tops[1], textAlign: 'right', ...(size === 15 ? null : { letterSpacing: 15 * 0.03 }) }}>
        {children}
      </PixelText>
      <More top={line.tops[2]} />
    </View>
  );
}

/** A line of the profile that opens what stands behind it, tall enough for a thumb (the web's `flex min-h-11 w-full flex-col justify-center`). */
function Opener({ onOpen, children }: { onOpen(): void; children: ReactNode }) {
  const press = usePress({ onPress: onOpen });
  return (
    <Pressable accessibilityRole="button" onPress={press} style={{ minHeight: TOUCH, justifyContent: 'center' }}>
      {children}
    </Pressable>
  );
}

/**
 * Who is at home, as wide as the panel (the web's `!h-auto !w-full` picture in its `frame sunk` box: the picture covers the box's sunk edge, as the
 * web's covers its inset shadow). Drawn once the width is known, at the height the art's shape gives it (`bannerSize`).
 */
function Household({ id }: { id: string }) {
  const art = spriteBox(id, 1, 1, { w: 288, h: 120 });
  const [width, setWidth] = useState<number | null>(null);
  return (
    <Framed kind="sunk" style={{ marginTop: 4, marginBottom: 8, backgroundColor: COLORS['night-900'], overflow: 'hidden' }}>
      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ width: '100%', aspectRatio: art.w / art.h }}>
        {width === null ? null : <Sprite id={id} fallback={{ w: 288, h: 120 }} size={bannerSize(width, art)} />}
      </View>
    </Framed>
  );
}

/**
 * A line of the balance sheet: its sign, what it is and what it holds, opening what it is made of. Drawn again only when what it shows changes (`onOpen`
 * is the profile's, the same for every drawing).
 */
const BalanceRow = memo(function BalanceRow({ line, label, amount, tone, onOpen }: { line: Exclude<BalanceLine, 'netWorth'>; label: string; amount: string; tone?: ColorToken; onOpen(line: BalanceLine): void }) {
  const press = usePress({ onPress: () => onOpen(line) });
  return (
    <Pressable accessibilityRole="button" onPress={press} style={{ minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Bare style={{ width: 32, height: 32 }}>
        <Sprite id={balanceArt[line]} />
      </Bare>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Row left={label} right={<Opening tone={tone}>{amount}</Opening>} />
      </View>
    </Pressable>
  );
});

/** The net worth, under a rule, in a pixel 17 in the line of the Row's reading 15 (the web's `pixel text-[17px]` span). */
function NetWorthLabel({ children }: { children: string }) {
  const { locale } = useSettings();
  const line = webLine([['read', 15, 15 * 1.45], ['pixel', 17, 17 * 1.1]], locale);
  return (
    <View style={{ height: line.height }}>
      <PixelText size={17} numberOfLines={1} style={{ marginTop: line.tops[1] }}>
        {children}
      </PixelText>
    </View>
  );
}

/**
 * One thing owned, as a square of the grid: its picture, shrunk to the square where it is wider (the web's `max-w-full object-contain`), opening its own
 * sheet. Drawn again only when what it shows changes. `cell` is the side of the square, once the grid is measured.
 */
const OwnedTile = memo(function OwnedTile({ itemId, name, cell, onOpen }: { itemId: string; name: string; cell: number | null; onOpen(itemId: string): void }) {
  const press = usePress({ onPress: () => onOpen(itemId) });
  const art = itemArt(itemId);
  return (
    <View role="listitem" style={{ flex: 1, minWidth: 0 }}>
      <Pressable accessibilityRole="button" accessibilityLabel={name} onPress={press}>
        <Bare style={{ width: '100%', aspectRatio: 1, overflow: 'hidden' }}>
          {cell === null ? null : <Sprite id={art} fallback={{ w: 64, h: 64 }} size={shrunkTo(art, { w: 64, h: 64 }, { w: cell, h: Number.POSITIVE_INFINITY })} />}
        </Bare>
      </Pressable>
    </View>
  );
});

/** The things owned, four to a row (the web's `grid grid-cols-4 gap-2`): a short last row leaves its columns empty. */
function OwnedGrid({ items, onOpen }: { items: readonly OwnedItem[]; onOpen(itemId: string): void }) {
  const { names } = useWords();
  const [width, setWidth] = useState<number | null>(null);
  const cell = width === null ? null : (width - 3 * 8) / 4;
  const rows: OwnedItem[][] = [];
  for (let i = 0; i < items.length; i += 4) rows.push(items.slice(i, i + 4));
  return (
    <View role="list" onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ gap: 8 }}>
      {rows.map((row, r) => (
        <View key={r} style={{ flexDirection: 'row', gap: 8 }}>
          {row.map((owned) => (
            <OwnedTile key={owned.itemId} itemId={owned.itemId} name={names.items[owned.itemId]} cell={cell} onOpen={onOpen} />
          ))}
          {Array.from({ length: 4 - row.length }, (_, i) => (
            <View key={`empty-${i}`} style={{ flex: 1, minWidth: 0 }} />
          ))}
        </View>
      ))}
    </View>
  );
}

/**
 * Who the player is: their job and skills, their family, an income statement and a balance sheet.
 * In the finance phase it already counts the orders in the basket, as every other figure does.
 */
export function ProfileBody() {
  const t = useT('profile');
  const hud = useT('hud');
  const { content, text, names, fmt } = useWords();
  const opened = useContext(ProfileOpened);
  const shown = useShown();
  const history = useGame((s) => s.history);
  const p = shown.player;
  const life = p.life;

  const home = homeOf(p, content);
  const household = homeLifeArt({ partner: life.partner, children: life.children.length });
  // One word each: the full names of the insurances do not fit on a line, and the sheet behind the row has them.
  const insured = INSURANCES.filter((kind) => life.insurance[kind]).map((kind) => t(`insuranceShort.${kind}`));
  const flow = cashflow(content, shown);
  const tax = taxAnnual(content, shown);
  const [open, setOpen] = useState<string | null>(opened.item ?? null);
  const [about, setAbout] = useState<About | null>(null);
  const [line, setLine] = useState<BalanceLine | null>(opened.line ?? null);
  // Looked up afresh on every draw: a thing sold or lapsed while its sheet is open closes it.
  const thing = life.items.find((owned) => owned.itemId === open);
  // One of the things owned, opened from the list of them in the balance sheet: the list gives way to it. The same for every drawing (`Thing` is memoised).
  const openThing = useCallback((itemId: string) => {
    setLine(null);
    setOpen(itemId);
  }, []);

  let invested = 0;
  for (const held of Object.values(p.positions)) invested += held.value;
  let homes = 0;
  for (const property of p.properties) homes += property.value;
  let things = 0;
  for (const owned of life.items) things += owned.value;
  let firms = 0;
  for (const business of p.businesses) firms += business.capital;
  let owed = 0;
  for (const debt of p.debts) owed += debt.principal;

  const married = Object.hasOwn(life.flags, 'married');
  const dating = Object.hasOwn(life.flags, 'dating');
  const lines: ReadonlyArray<readonly [Exclude<BalanceLine, 'netWorth' | 'debts'>, string, string]> = [
    ['cash', t('cash'), fmt.money(p.cash)],
    ['savings', t('savings'), fmt.money(p.deposit)],
    ['pension', t('pension'), fmt.money(p.pension)],
    ['investments', t('investments'), fmt.money(invested)],
    ['homes', t('homes'), fmt.money(homes)],
    ...(firms > 0 ? ([['businesses', t('businesses'), fmt.money(firms)]] as const) : []),
    ['things', t('things'), fmt.money(things)],
  ];

  return (
    <View style={{ gap: 12 }}>
      <WorkPanel shown={shown} />

      <Panel title={t('family')}>
        {/* Who is at home, when someone is. */}
        {household ? <Household id={household} /> : null}
        <Row
          left={[
            ...familyArt({ partner: life.partner, married, dating, children: life.children, childRounds: content.life.childRounds }).map((sprite) => <Sprite key={sprite} id={sprite} />),
            // The words follow the picture: seeing someone is not yet living with them, and neither is being married.
            t(life.partner ? (married ? 'married' : 'partner') : dating ? 'dating' : 'single'),
          ]}
          right={life.children.length > 0 ? t('children', { count: life.children.length }) : undefined}
        />
        {/* Each of these opens what it is, what it costs and what it gives. Changing it is done in the finances. */}
        <Opener onOpen={() => setAbout('lifestyle')}>
          <Row left={t('lifestyle')} right={<Opening>{text.lifestyleTiers[p.lifestyleTier]}</Opening>} />
        </Opener>
        <Opener onOpen={() => setAbout('home')}>
          <Row left={t('home')} sub={names.cities[p.cityId]} right={<Opening>{home ? homeName(text, home.typeId, home.cityId) : text.rentTiers[life.rentTier]}</Opening>} />
        </Opener>
        <Opener onOpen={() => setAbout('insurance')}>
          <Row left={t('insurance')} right={<Opening>{insured.length > 0 ? insured.join(' · ') : t('uninsured')}</Opening>} />
        </Opener>
      </Panel>
      {about ? <AboutSheet about={about} shown={shown} onClose={() => setAbout(null)} /> : null}

      <Panel title={t('income')}>
        <Row left={t('salary')} right={<Figure tone="teal-300">{fmt.signed(flow.salaryAnnual)}</Figure>} />
        <Row left={t('passive')} right={<Figure tone="teal-300">{fmt.signed(flow.passiveAnnual)}</Figure>} />
        <Row left={t('expenses')} right={<Figure tone="wine-300">{fmt.signed(-flow.expensesAnnual)}</Figure>} />
        {tax > 0 ? <Row left={hud('wayOut.tax')} right={<Figure tone="wine-300">{fmt.signed(-tax)}</Figure>} /> : null}
      </Panel>

      <Panel title={t('balance')} label={t('balance')}>
        {/* Every line opens what it is made of. */}
        {lines.map(([kind, label, amount]) => (
          <BalanceRow key={kind} line={kind} label={label} amount={amount} onOpen={setLine} />
        ))}
        <BalanceRow line="debts" label={t('debts')} amount={fmt.money(-owed)} tone={owed > 0 ? 'wine-300' : undefined} onOpen={setLine} />
        <Opener onOpen={() => setLine('netWorth')}>
          <Row style={TOTAL} left={<NetWorthLabel>{t('netWorth')}</NetWorthLabel>} right={<Opening size={19} tone="gold-500">{fmt.money(netWorth(p))}</Opening>} />
        </Opener>
      </Panel>
      {/* One of the things owned is opened from the list of them: the list gives way to it. */}
      {line ? <BalanceSheet line={line} shown={shown} onClose={() => setLine(null)} onItem={openThing} /> : null}

      {/* The people the player grew up with, and where the player stands among them. */}
      <RivalsBoard history={history} />

      <Panel title={t('owned')}>
        {life.items.length === 0 ? (
          <ReadText size={14} tone="ink-300">{t('nothing')}</ReadText>
        ) : (
          // A tap opens what the thing is, what it gives and what it is worth. Buying and selling stay in the shop.
          <OwnedGrid items={life.items} onOpen={setOpen} />
        )}
      </Panel>
      {thing ? <OwnedSheet owned={thing} shown={shown} onClose={() => setOpen(null)} /> : null}
    </View>
  );
}

type About = 'lifestyle' | 'home' | 'insurance';

/** One choice among several, as a line: its picture, its name, what it costs a year and what it gives. */
function Choice({ icon, name, cost, status, on, onLabel, onPick, disabled = false, children }: { icon: string; name: string; cost: string; status?: number; on: boolean; onLabel: string; onPick?: () => void; disabled?: boolean; children?: ReactNode }) {
  const shop = useT('finance.shop');
  const press = usePress({ onPress: () => onPick?.(), disabled });
  const look = (
    <Framed
      kind={on ? 'bevel' : 'frame'}
      tone={on ? GOLD : {}}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 10, paddingVertical: 8, backgroundColor: COLORS[on ? 'night-600' : 'night-700'] }}
    >
      <Bare style={{ width: 36, height: 36 }}>
        <Sprite id={icon} />
      </Bare>
      <View style={{ flex: 1, minWidth: 0 }}>
        {/* The web aligns the two by their baselines; the cost, 15 against the name's 16, stands a point lower at the top. */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
          <View style={{ flexShrink: 1, minWidth: 0 }}>
            <PixelText size={16}>{name}</PixelText>
          </View>
          <View style={{ flexShrink: 0, marginTop: PAY_DROP }}>
            <PixelText size={15} tone="gold-500">{cost}</PixelText>
          </View>
        </View>
        <View style={{ marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {on ? <Tag tone="good">{onLabel}</Tag> : null}
          {status ? <Tag tone={status > 0 ? 'good' : 'bad'}>{status > 0 ? shop('status', { n: status }) : shop('statusDown', { n: -status })}</Tag> : null}
        </View>
        {children}
      </View>
    </Framed>
  );
  // While the finances are open the line is the choice itself; at any other time it is only to be read.
  return (
    <View role="listitem" aria-current={on ? 'true' : undefined} accessibilityState={{ selected: on }}>
      {onPick ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: on, disabled }}
          aria-pressed={on}
          disabled={disabled}
          onPress={press}
          style={({ pressed }) => ({ ...pressDown(pressed && !disabled), opacity: disabled ? 0.5 : 1 })}
        >
          {look}
        </Pressable>
      ) : (
        look
      )}
    </View>
  );
}

/** A line under a choice (the web's `mt-1 text-[12px]`), in its colour. */
const ChoiceNote = ({ tone, children }: { tone: ColorToken; children: string }) => (
  <ReadText size={12} tone={tone} style={{ marginTop: 4 }}>
    {children}
  </ReadText>
);

/**
 * How the player lives, where, and what they are insured against: every choice there is, what
 * each costs a year and what it gives, the one in force marked. To be read; the finances change it.
 */
function AboutSheet({ about, shown, onClose }: { about: About; shown: GameView; onClose(): void }) {
  const t = useT('profile');
  const common = useT('common');
  const life = useT('finance.lifestyle');
  const estate = useT('finance.property');
  const { content, text, names, fmt } = useWords();
  const p = shown.player;
  const living = quoteLiving(content, shown);
  const perYear = (cents: number) => common('perYear', { amount: fmt.money(cents) });
  const home = homeOf(p, content);
  // A choice is an order like any other: it can be given only while the finances are open, and it
  // is judged against the life as it is, so choosing what is already so takes the order back.
  const view = useGame((s) => s.view);
  const stage = useGame((s) => s.stage);
  const setOrder = useGame((s) => s.setOrder);
  const now = stage === 'finance' && view ? view.player : null;

  let body: ReactNode;
  if (about === 'lifestyle') {
    body = (
      <>
        <ReadText size={14} lineHeight={14 * SNUG}>{t('aboutLifestyle')}</ReadText>
        <View role="list" style={{ gap: 8 }}>
          {text.lifestyleTiers.map((name, tier) => (
            <Choice
              key={tier}
              icon={lifestyleArt[tier]}
              name={name}
              cost={perYear(living.tiers[tier])}
              status={living.lifestyleStatus[tier]}
              on={tier === p.lifestyleTier}
              onLabel={t('yours')}
              disabled={tier < p.life.minLifestyleTier}
              onPick={now ? () => setOrder((order) => order.type === 'setLifestyle', tier === now.lifestyleTier ? null : { type: 'setLifestyle', tier: tier as LifestyleTier }) : undefined}
            >
              {tier < p.life.minLifestyleTier ? <ChoiceNote tone="wine-300">{life('tierFloor')}</ChoiceNote> : null}
              {tier === 0 && living.worse.frugal ? <ChoiceNote tone="wine-300">{life('frugalLate', { age: ageAt(content, living.worse.frugal.fromRound), n: -living.worse.frugal.status })}</ChoiceNote> : null}
            </Choice>
          ))}
        </View>
      </>
    );
  } else if (about === 'home') {
    const owned = home ? quoteOwnedProperty(content, shown, home.id) : null;
    body =
      home && owned ? (
        <>
          <View style={{ alignItems: 'center' }}>
            <Bare style={{ padding: 4 }}>
              <Sprite id={propertyArt(home.typeId, home.cityId)} fallback={{ w: 128, h: 128 }} />
            </Bare>
          </View>
          <ReadText size={14} lineHeight={14 * SNUG} style={{ textAlign: 'center' }}>{life('ownerNote')}</ReadText>
          <Panel>
            <Row left={homeName(text, home.typeId, home.cityId)} sub={names.cities[home.cityId]} right={owned.status > 0 ? <Tag tone="good">{estate('status', { n: owned.status })}</Tag> : undefined} />
            <Row left={estate('worth')} right={<Figure tone="gold-500">{fmt.money(owned.value)}</Figure>} />
            <Row left={estate('owed')} right={<Figure tone={owned.mortgage ? 'wine-300' : 'cream'}>{fmt.money(owned.mortgage?.principal ?? 0)}</Figure>} />
          </Panel>
        </>
      ) : (
        <>
          <ReadText size={14} lineHeight={14 * SNUG}>{t('aboutRent', { city: names.cities[p.cityId] })}</ReadText>
          <View role="list" style={{ gap: 8 }}>
            {text.rentTiers.map((name, tier) => (
              <Choice
                key={tier}
                icon={rentTierIcon[tier]}
                name={name}
                cost={living.rentTiers ? perYear(living.rentTiers[tier]) : ''}
                status={living.rentStatus[tier]}
                on={tier === p.life.rentTier}
                onLabel={t('yours')}
                onPick={now ? () => setOrder((order) => order.type === 'setRentTier', tier === now.life.rentTier ? null : { type: 'setRentTier', tier: tier as RentTier }) : undefined}
              />
            ))}
          </View>
          {living.worse.room ? (
            <ReadText size={12} tone="wine-300">{life('roomLate', { age: ageAt(content, living.worse.room.fromRound), n: -living.worse.room.status })}</ReadText>
          ) : null}
          <ReadText size={12} tone="ink-300">{t('rentCost')}</ReadText>
        </>
      );
  } else {
    body = (
      <>
        <ReadText size={14} lineHeight={14 * SNUG}>{t('aboutInsurance')}</ReadText>
        <View role="list" style={{ gap: 8 }}>
          {INSURANCES.map((kind) => {
            const cover = insuranceCover(content, kind);
            return (
              <Choice
                key={kind}
                icon={insuranceArt[kind]}
                name={text.insurance[kind]}
                cost={perYear(living.insurance[kind])}
                on={p.life.insurance[kind]}
                onLabel={t('insured')}
                onPick={
                  now && !(kind === 'health' && living.health.refused && !p.life.insurance.health)
                    ? () => setOrder((order) => order.type === 'setInsurance' && order.insurance === kind, !p.life.insurance[kind] === now.life.insurance[kind] ? null : { type: 'setInsurance', insurance: kind, on: !p.life.insurance[kind] })
                    : undefined
                }
              >
                <View role="list" style={{ marginTop: 6, gap: 2 }}>
                  {cover.pays.map(({ cardId, pct }) => (
                    <View role="listitem" key={cardId}>
                      <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{t('pays', { pct, card: text.cards[cardId].title })}</ReadText>
                    </View>
                  ))}
                  {cover.opens.map((cardId) => (
                    <View role="listitem" key={cardId}>
                      <ReadText size={13} lineHeight={13 * SNUG} tone="ink-200">{t('opens', { card: text.cards[cardId].title })}</ReadText>
                    </View>
                  ))}
                </View>
              </Choice>
            );
          })}
        </View>
        <HealthCoverNote living={living} />
      </>
    );
  }

  return (
    <Sheet open onClose={onClose} title={t(about === 'lifestyle' ? 'lifestyle' : about === 'home' ? 'home' : 'insurance')} closeLabel={common('close')}>
      <View style={{ gap: 12 }}>
        {body}
        <ReadText size={12} tone="ink-300" style={{ textAlign: 'center' }}>{now && !(about === 'home' && home) ? t('pickHere') : t('changedIn')}</ReadText>
      </View>
    </Sheet>
  );
}

/** A line of a thing's sheet, centred (the web's `text-center text-[13px] text-ink-300` and the like). */
const Centred = ({ size, tone = 'cream', children }: { size: number; tone?: ColorToken; children: string }) => (
  <ReadText size={size} tone={tone} style={{ textAlign: 'center' }}>
    {children}
  </ReadText>
);

/** One thing the player owns, looked at closely: what it is, what it gives, what it costs to keep and what it would fetch. */
function OwnedSheet({ owned, shown, onClose }: { owned: OwnedItem; shown: GameView; onClose(): void }) {
  const t = useT('profile');
  const shop = useT('finance.shop');
  const common = useT('common');
  const { content, text, names, fmt } = useWords();
  const setOrder = useGame((state) => state.setOrder);
  const canOrder = useGame((state) => state.stage) === 'finance';
  const item = content.items.find((x) => x.id === owned.itemId);
  if (!item) return null;
  const quote = quoteItem(content, shown, item.id);

  return (
    <Sheet open onClose={onClose} title={names.items[item.id]} closeLabel={common('close')}>
      <View style={{ gap: 12 }}>
        <View style={{ alignItems: 'center' }}>
          <Bare style={{ padding: 8 }}>
            <Sprite id={itemArt(item.id)} scale={2} fallback={{ w: 64, h: 64 }} />
          </Bare>
        </View>
        <PixelText size={13} tone="ink-300" style={{ textAlign: 'center', letterSpacing: 13 * 0.05 }}>{text.ladders[item.ladder].toUpperCase()}</PixelText>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 6 }}>
          <Tag tone={realStatus(quote) > 0 ? 'good' : undefined}>{shop('status', { n: realStatus(quote) })}</Tag>
          {quote.status < quote.statusNew ? <Tag>{shop('statusWas', { n: quote.statusNew })}</Tag> : null}
          {quote.upkeepAnnual > 0 ? <Tag tone="bad">{shop('upkeep', { amount: fmt.money(quote.upkeepAnnual) })}</Tag> : null}
          {quote.ownedUsed ? <Tag>{shop('usedTag')}</Tag> : null}
          {quote.ownedNoInvoice ? <Tag tone="bad">{shop('noInvoiceTag')}</Tag> : null}
        </View>
        <StatusNote quote={quote} owned />
        {quote.ownedUsed ? <Centred size={13} tone="ink-300">{shop('usedOwned', { pct: content.life.used[item.ladder]?.repairChancePct ?? 0 })}</Centred> : null}
        <ItemUses item={item} />
        {quote.ages ? <Centred size={13} tone="ink-300">{shop(quote.status < quote.statusNew ? 'aged' : 'ages')}</Centred> : null}
        {item.kind === 'durable' ? <Centred size={14}>{t('itemWorth', { amount: fmt.money(quote.resale) })}</Centred> : null}
        <ItemCost quote={quote} />
        {owned.roundsLeft !== null ? <Centred size={14} tone="ink-300">{shop('spent', { years: owned.roundsLeft * content.yearsPerRound })}</Centred> : null}
        {quote.local ? <Centred size={13} tone="ink-300">{shop('local', { city: names.cities[shown.player.cityId] })}</Centred> : null}
        {/* Selling or cancelling is an order like any other, given here while the finances are open. Once given, the thing is no longer among the player's: the order is taken back from the basket. */}
        {quote.sellable && canOrder ? (
          <>
            <Button
              variant="danger"
              wide
              onPress={() => {
                if (setOrder((order) => order.type === 'sellItem' && order.itemId === item.id, { type: 'sellItem', itemId: item.id })) onClose();
              }}
            >
              {item.kind === 'membership' ? shop('cancel') : shop('sell', { amount: fmt.money(quote.resale) })}
            </Button>
            <Centred size={12} tone="ink-300">{t('itemUndo')}</Centred>
          </>
        ) : (
          <Centred size={12} tone="ink-300">{t(quote.sellable ? 'itemWhen' : 'itemKept')}</Centred>
        )}
      </View>
    </Sheet>
  );
}

/**
 * The profile in a sheet, with the way back to the front door. While it is shut it reads nothing of the game: its body is the sheet's, which is drawn
 * only while it is open (and while it leaves), so a step of the round draws nothing here (Play keeps the sheet itself from being drawn again).
 */
export function ProfileSheet({ open, onClose }: { open: boolean; onClose(): void }) {
  const t = useT('profile');
  const common = useT('common');
  return (
    <Sheet open={open} onClose={onClose} title={t('title')} closeLabel={common('close')}>
      <ProfileBody />
      <Leave onLeave={onClose} />
    </Sheet>
  );
}

/**
 * The way out of a life in progress. Nothing is lost by taking it. On the phone the sheet it stands in closes first (`onLeave`), and the page moves on
 * once it is gone: a page changed under a sheet that is still leaving is left with it.
 */
export function Leave({ onLeave }: { onLeave?: () => void }) {
  const t = useT('profile');
  const phone = useT('phone');
  const saving = useSaving();
  const router = useRouter();
  // A life in a room is left with the room, from the room's own sheet.
  const inRoom = useInRoom();
  if (inRoom) return null;
  return (
    <View style={{ marginTop: 12 }}>
      <Raised
        role="link"
        bg="night-600"
        style={{ paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' }}
        onPress={() => {
          onLeave?.();
          void sheetsGone().then(() => router.dismissTo('/'));
        }}
      >
        <PixelText size={15} tone="ink-200">{t('leave')}</PixelText>
      </Raised>
      {saving ? (
        <ReadText size={12} tone="ink-300" style={{ marginTop: 6, textAlign: 'center' }}>{t('leaveHint')}</ReadText>
      ) : (
        // The web's words say a browser is not saving: on a phone, the phone's.
        <Notice role="alert" size={13} style={{ marginTop: 8 }}>
          {phone('notSaved')}
        </Notice>
      )}
    </View>
  );
}
