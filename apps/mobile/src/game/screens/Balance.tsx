import { assetKind, assetLogo, debtArt, homeName, itemArt, propertyArt } from '@ratrace/content';
import { assetYieldBp, cashflowLines, debtRateBp, depositRateBp, homeOf, netWorth, quoteOwnedProperty, realNetWorth } from '@ratrace/engine';
import type { GameView } from '@ratrace/engine';
import { ageAt, debtLabel } from '@ratrace/core/game/present';
import { memo, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { Bare, Notice, Panel, Row, Tag, TickerBadge, usePress } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { Sprite } from '../../ui/Sprite';
import { spriteBox, type Size } from '../../ui/sprites';
import { PixelText, ReadText, SNUG } from '../../ui/text';
import { COLORS, TOUCH, type ColorToken } from '../../ui/theme';
import { useGame, useT, useWords } from '../context';
import { WorthGraph } from './WorthGraph';

/*
 * The web's Balance.tsx, on the phone. What the phone leaves out: the name of another player of a room who lent the player money (`usePeerName`): a life
 * on the phone is never in a room, and owes no one in one. One line is in words of the phone's own: the net worth after inflation, which the web asks of a
 * key no longer in the messages (`end.realNetWorth`, so the web shows the key itself); the phone never shows a key, and says it (`phone.realNetWorth`).
 */

/** The lines of the balance sheet. Each opens what it is made of. */
export type BalanceLine = 'cash' | 'savings' | 'pension' | 'investments' | 'homes' | 'businesses' | 'things' | 'debts' | 'netWorth';

/** The groups the market files investments under, in its order, with the name each has there. */
const KINDS = [
  ['fund', 'funds'],
  ['bond', 'bonds'],
  ['stock', 'stocks'],
  ['crypto', 'crypto'],
  ['gold', 'gold'],
] as const;

const About = ({ children }: { children: string }) => <ReadText size={14} lineHeight={14 * SNUG}>{children}</ReadText>;
const Note = ({ children }: { children: string }) => <ReadText size={12} lineHeight={12 * SNUG} tone="ink-300">{children}</ReadText>;
const Empty = ({ children }: { children: string }) => (
  <Notice bg="night-700" tone="ink-300" size={14}>
    {children}
  </Notice>
);
/** A figure of a line in a colour (the web's `<span className="text-…">` in a Row's pixel cell). */
const Figure = ({ tone, children }: { tone: ColorToken; children: string }) => (
  <PixelText size={15} tone={tone} style={{ textAlign: 'right' }}>
    {children}
  </PixelText>
);
/** A gain in green, a loss in red, with its sign. */
const Gain = ({ cents, text }: { cents: number; text: string }) => <Figure tone={cents < 0 ? 'wine-300' : 'teal-300'}>{text}</Figure>;

/**
 * The box a picture of a thing is drawn into, where it must shrink to stand in `room` (the web's `max-h-full max-w-full object-contain`): none where it
 * fits at its own size. Chrome lays a shrunk image on whole CSS pixels: so are its sides here.
 */
export function shrunkTo(id: string, fallback: Size, room: Size): Size | undefined {
  const art = spriteBox(id, 1, 1, fallback);
  if (art.w <= room.w && art.h <= room.h) return undefined;
  const scale = Math.min(room.w / art.w, room.h / art.h);
  return { w: Math.round(art.w * scale), h: Math.round(art.h * scale) };
}

const THING_ROOM: Size = { w: 40, h: 40 };

/**
 * One thing owned, in the list of them: its picture, its name and what it would fetch, opening its own sheet. Drawn again only when one of those
 * changes (`onItem` is the profile's, the same for every drawing).
 */
const Thing = memo(function Thing({ itemId, name, worth, onItem }: { itemId: string; name: string; worth: string; onItem(itemId: string): void }) {
  const press = usePress({ onPress: () => onItem(itemId) });
  const art = itemArt(itemId);
  return (
    <View role="listitem">
      <Pressable accessibilityRole="button" onPress={press}>
        <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
          <Bare style={{ width: 40, height: 40, overflow: 'hidden' }}>
            <Sprite id={art} fallback={{ w: 64, h: 64 }} size={shrunkTo(art, { w: 64, h: 64 }, THING_ROOM)} />
          </Bare>
          <View style={{ flex: 1, minWidth: 0 }}>
            <ReadText numberOfLines={1}>{name}</ReadText>
          </View>
          <PixelText style={{ flexShrink: 0 }}>{worth}</PixelText>
        </Framed>
      </Pressable>
    </View>
  );
});

/**
 * One line of the balance sheet, opened: what it is, and everything it is made of. To be read:
 * buying, selling and repaying are done in the finances. `onItem` opens one thing of those owned. Closed (`open` false), it stays drawn
 * while it leaves, and says when it has gone (`onGone`): a thing opened from it opens then.
 */
export function BalanceSheet({ line, shown, open = true, onClose, onGone, onItem }: { line: BalanceLine; shown: GameView; open?: boolean; onClose(): void; onGone?: () => void; onItem(itemId: string): void }) {
  const t = useT('balance');
  const profile = useT('profile');
  const common = useT('common');
  const market = useT('finance.market');
  const estate = useT('finance.property');
  const debtText = useT('finance.debt');
  const end = useT('end');
  const phone = useT('phone');
  const words = useWords();
  const { content, text, names, fmt } = words;
  const history = useGame((s) => s.history);
  const p = shown.player;
  const world = shown.timeline[shown.round];
  const flows = cashflowLines(content, shown);
  const perYear = (cents: number) => common('perYear', { amount: fmt.money(cents) });

  let body: ReactNode;
  switch (line) {
    case 'cash':
      body = (
        <>
          <About>{t('cash.about')}</About>
          <Panel>
            <Row left={profile('cash')} right={fmt.money(p.cash)} />
          </Panel>
          <Note>{t('cash.note')}</Note>
        </>
      );
      break;

    case 'savings':
      body = (
        <>
          <About>{t('savings.about')}</About>
          <Panel>
            <Row left={t('balance')} right={fmt.money(p.deposit)} />
            <Row left={t('savings.rate')} right={t('rate', { rate: fmt.rate(depositRateBp(content, world)) })} />
            <Row left={t('savings.earns')} right={<Gain cents={flows.interest} text={perYear(flows.interest)} />} />
          </Panel>
          <Note>{t('savings.note')}</Note>
        </>
      );
      break;

    case 'pension':
      body = (
        <>
          <About>{t('pension.about')}</About>
          <Panel>
            <Row left={t('balance')} right={fmt.money(p.pension)} />
            {/* The web's `font-sans text-[13px]` inside the Row's pixel cell: the reading face, at the size the pixel text's adjustment makes it. */}
            <Row left={t('pension.follows')} right={<PixelText style={{ textAlign: 'right' }} after={[{ text: names.assets[content.pensionAssetId].name, read: 13 }]}>{''}</PixelText>} />
            <Row left={t('pension.unlocks')} right={common('age', { age: ageAt(content, content.rounds) })} />
          </Panel>
          <Note>{t('pension.note')}</Note>
        </>
      );
      break;

    case 'investments': {
      const held = content.assets.filter((asset) => Object.hasOwn(p.positions, asset.id) && p.positions[asset.id].value > 0);
      body = (
        <>
          <About>{t('investments.about')}</About>
          {held.length === 0 ? <Empty>{t('investments.none')}</Empty> : null}
          {KINDS.map(([kind, name]) => {
            const group = held.filter((asset) => assetKind(asset) === kind);
            if (group.length === 0) return null;
            return (
              <Panel key={kind} title={market(name)} label={market(name)}>
                <View role="list" style={{ gap: 8 }}>
                  {group.map((asset) => {
                    const position = p.positions[asset.id];
                    const gain = position.value - position.basis;
                    const pays = assetYieldBp(asset, world);
                    return (
                      <View role="listitem" key={asset.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TickerBadge ticker={names.assets[asset.id].ticker} kind={asset.class} logo={assetLogo[asset.id]} />
                        <View style={{ flex: 1, minWidth: 0 }}>
                          <ReadText numberOfLines={1}>{names.assets[asset.id].name}</ReadText>
                          <ReadText size={12} tone={gain < 0 ? 'wine-300' : 'teal-300'} after={pays > 0 ? [{ text: ` · ${market('yield', { rate: fmt.rate(pays) })}`, tone: 'ink-300' }] : undefined}>
                            {t(gain < 0 ? 'investments.loss' : 'investments.gain', { amount: fmt.money(Math.abs(gain)) })}
                          </ReadText>
                        </View>
                        <PixelText style={{ flexShrink: 0 }}>{fmt.money(position.value)}</PixelText>
                      </View>
                    );
                  })}
                </View>
              </Panel>
            );
          })}
          <Note>{t('investments.note')}</Note>
        </>
      );
      break;
    }

    case 'homes': {
      const home = homeOf(p, content);
      body = (
        <>
          <About>{t('homes.about')}</About>
          {p.properties.length === 0 ? <Empty>{estate('ownedNone')}</Empty> : null}
          <View role="list" style={{ gap: 8 }}>
            {p.properties.map((property) => {
              const quote = quoteOwnedProperty(content, shown, property.id);
              if (!quote) return null;
              return (
                <View role="listitem" key={property.id}>
                  <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], padding: 8, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <Bare>
                      <Sprite id={propertyArt(property.typeId, property.cityId)} fallback={{ w: 128, h: 128 }} />
                    </Bare>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <PixelText size={16}>{homeName(text, property.typeId, property.cityId)}</PixelText>
                      <ReadText size={12} tone="ink-300">
                        {`${names.cities[property.cityId]} · ${property.rented ? estate('rented') : home?.id === property.id ? estate('livedIn') : estate('empty')}`}
                      </ReadText>
                      <Row style={{ paddingVertical: 2 }} left={estate('worth')} right={<Figure tone="gold-500">{fmt.money(quote.value)}</Figure>} />
                      {quote.mortgage ? <Row style={{ paddingVertical: 2 }} left={estate('owed')} right={<Figure tone="wine-300">{fmt.money(quote.mortgage.principal)}</Figure>} /> : null}
                      {quote.rented ? <Row style={{ paddingVertical: 2 }} left={estate('rent')} right={<Figure tone="teal-300">{fmt.signed(quote.rentAnnual)}</Figure>} /> : null}
                    </View>
                  </Framed>
                </View>
              );
            })}
          </View>
          <Note>{t('homes.note')}</Note>
        </>
      );
      break;
    }

    case 'businesses':
      body = (
        <>
          <About>{t('businesses.about')}</About>
          {p.businesses.length === 0 ? <Empty>{profile('nothing')}</Empty> : null}
          <View role="list" style={{ gap: 6 }}>
            {p.businesses.map((business) => (
              <View role="listitem" key={business.id}>
                <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], minHeight: TOUCH, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Bare style={{ width: 36, height: 36 }}>
                    <Sprite id="icon.business" />
                  </Bare>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <ReadText numberOfLines={1}>{text.businessTypes[business.typeId].name}</ReadText>
                  </View>
                  <PixelText style={{ flexShrink: 0 }}>{fmt.money(business.capital)}</PixelText>
                </Framed>
              </View>
            ))}
          </View>
          <Note>{t('businesses.note')}</Note>
        </>
      );
      break;

    case 'things': {
      const owned = [...p.life.items].sort((a, b) => b.value - a.value);
      body = (
        <>
          <About>{t('things.about')}</About>
          {owned.length === 0 ? <Empty>{profile('nothing')}</Empty> : null}
          <View role="list" style={{ gap: 6 }}>
            {owned.map((item) => (
              <Thing key={item.itemId} itemId={item.itemId} name={names.items[item.itemId]} worth={item.value > 0 ? fmt.money(item.value) : t('things.noValue')} onItem={onItem} />
            ))}
          </View>
          <Note>{t('things.note')}</Note>
        </>
      );
      break;
    }

    case 'debts':
      body = (
        <>
          <About>{t('debts.about')}</About>
          {p.debts.length === 0 ? <Empty>{debtText('none')}</Empty> : null}
          <View role="list" style={{ gap: 8 }}>
            {p.debts.map((debt) => (
              <View role="listitem" key={debt.id}>
                <Framed kind="frame" style={{ backgroundColor: COLORS['night-700'], paddingHorizontal: 12, paddingVertical: 8 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0, flexShrink: 1 }}>
                      <Bare style={{ width: 32, height: 32 }}>
                        <Sprite id={debtArt(debt)} />
                      </Bare>
                      <View style={{ flexShrink: 1, minWidth: 0 }}>
                        <PixelText size={16}>{debtLabel(words, debt, p.properties)}</PixelText>
                      </View>
                    </View>
                    <PixelText tone="wine-300" style={{ flexShrink: 0 }}>{fmt.money(debt.principal)}</PixelText>
                  </View>
                  <View style={{ marginTop: 4, flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                    <Tag tone="bad">{t('rate', { rate: fmt.rate(debtRateBp(debt, content, world, p)) })}</Tag>
                    <Tag>{debtText('left', { rounds: debt.kind === 'creditCard' ? 0 : debt.roundsLeft })}</Tag>
                  </View>
                </Framed>
              </View>
            ))}
          </View>
          {p.debts.length > 0 ? (
            <Panel>
              <Row left={t('debts.yearly')} right={<Figure tone="wine-300">{perYear(flows.debt)}</Figure>} />
            </Panel>
          ) : null}
          <Note>{t('debts.note')}</Note>
        </>
      );
      break;

    case 'netWorth':
      body = (
        <>
          <About>{t('netWorth.about')}</About>
          <Panel>
            <Row left={profile('netWorth')} right={<Figure tone="gold-500">{fmt.money(netWorth(p))}</Figure>} />
            <Row left={phone('realNetWorth')} sub={t('netWorth.realHint')} right={fmt.money(realNetWorth(shown))} />
          </Panel>
          {history.length > 1 ? (
            <Panel>
              <WorthGraph history={history} label={end('graph')} />
              <ReadText size={12} tone="ink-300" style={{ marginTop: 8, textAlign: 'center' }}>{end('graph')}</ReadText>
            </Panel>
          ) : null}
        </>
      );
      break;
  }

  return (
    <Sheet open={open} onClose={onClose} onGone={onGone} title={t(`${line}.title`)} closeLabel={common('close')}>
      <View style={{ gap: 12 }}>{body}</View>
    </Sheet>
  );
}
