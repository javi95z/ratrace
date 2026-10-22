// The kit, one section to a page, for the parity check against the web (apps/web/src/app/[locale]/kit/page.tsx shows
// the same sections in the same order, with the same words). Development only, like /dev.
import type { RatLook } from '@ratrace/core/game/avatar';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { Bar, Bare, Button, KeyFigure, Panel, Row, Segmented, pressDown, Stat, Tag, TickerBadge, Tile, Toggle, Well } from '../ui/kit';
import { Sheet, Tabs, Toast } from '../ui/overlay';
import { Screen } from '../ui/Page';
import { Picker } from '../ui/Picker';
import { RatAvatar } from '../ui/RatAvatar';
import { Sprite } from '../ui/Sprite';
import { Language, PixelText, ReadText } from '../ui/text';

type KitMotion = typeof import('../ui/kitMotion');
// Cut out of a release build (`__DEV__` is `false` there, folded before the bundle's files are gathered: ui/devRoutes.test.ts), as the route itself goes home.
const kitMotion: KitMotion | null = __DEV__ ? (require('../ui/kitMotion') as KitMotion) : null;

const KIT_SECTIONS = ['buttons', 'surfaces', 'stats', 'bars', 'choices', 'lists', 'sheet-gold', 'sheet-wine', 'tabs', 'art', 'text-es', 'text-ru', 'type', 'dots', 'motion-2'] as const;
type Section = (typeof KIT_SECTIONS)[number];

const LOOK: RatLook = { colour: 'teal', body: 'grey', face: 'grin', outfit: 'suit', hat: 'crown', eyes: 'round', backdrop: 'stars' };
const VARIANTS = ['primary', 'secondary', 'danger', 'quiet'] as const;
const noop = () => {};
const SIZES = [11, 12, 14, 15, 16, 17, 19, 28] as const;

const ES = { pixel: 'Año nuevo: 12.346 $', read: 'Pagas el alquiler y te quedan 1.234 $ para el mes.' };
const RU = { pixel: 'Новый год: 12 346 $', read: 'Вы платите аренду, и на месяц остаётся 1 234 $.' };

/** The pressed look, held still: a pressable's `pressDown`, as the web page copies `active:translate-y-[2px]`. */
const Pressed = ({ children }: { children: ReactNode }) => <View style={pressDown(true)}>{children}</View>;
const Wrap = ({ children, gap = 8, end = false }: { children: ReactNode; gap?: number; end?: boolean }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap, alignItems: end ? 'flex-end' : 'stretch' }}>{children}</View>
);

function Body({ section }: { section: Section }): ReactNode {
  const [choice, setChoice] = useState<'low' | 'mid' | 'high'>('mid');
  const [tab, setTab] = useState<'cash' | 'stocks' | 'debts'>('stocks');
  const [city, setCity] = useState<string | null>('madrid');
  switch (section) {
    case 'buttons':
      return (
        <>
          <Wrap>{VARIANTS.map((v) => <Button key={v} variant={v} onPress={noop}>Go</Button>)}</Wrap>
          <Wrap>{VARIANTS.map((v) => <Pressed key={v}><Button variant={v} onPress={noop}>Held</Button></Pressed>)}</Wrap>
          <Wrap>{VARIANTS.map((v) => <Button key={v} variant={v} disabled onPress={noop}>Off</Button>)}</Wrap>
          <Button variant="primary" wide onPress={noop}>Start a new life</Button>
        </>
      );
    case 'surfaces':
      return (
        <>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {['icon.cash', 'icon.bond', 'icon.crypto'].map((id) => (
              <View key={id} style={{ flex: 1 }}>
                <Tile onPress={noop}>
                  <Bare><Sprite id={id} /></Bare>
                  <ReadText>1.200 $</ReadText>
                </Tile>
              </View>
            ))}
          </View>
          <Panel title="Savings">
            <ReadText>Money put aside for a rainy day.</ReadText>
          </Panel>
          <Panel>
            <ReadText>A panel without a title.</ReadText>
          </Panel>
          <Wrap>
            <Tag tone="good">+120 $</Tag>
            <Tag tone="bad">-80 $</Tag>
            <Tag tone="plain">Rent</Tag>
          </Wrap>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Well><Sprite id="icon.city" /></Well>
          </View>
        </>
      );
    case 'stats':
      return (
        <>
          {[300, 360].map((width) => (
            <View key={width} style={{ width, gap: 12 }}>
              <Stat icon="icon.cash" value="12.346 $" label="Cash" />
              <Stat icon="icon.calendar" value="Year 3" label="Round" tone="good" onOpen={noop} />
              <Stat icon="icon.crypto" value="-450 $" label="Cashflow" tone="bad" />
            </View>
          ))}
        </>
      );
    case 'bars':
      return (
        <>
          <Bar value={7} max={16} label="Gold" />
          <Bar value={10} max={16} label="Gold, door" door />
          <Bar value={16} max={16} label="Teal, open" tone="teal" door />
          <Bar value={0} max={16} label="Teal, empty" tone="teal" />
          <Wrap>
            <TickerBadge ticker="BND" kind="bond" />
            <TickerBadge ticker="IDX" kind="equity" />
            <TickerBadge ticker="BTC" kind="crypto" />
            <TickerBadge ticker="AU" kind="gold" />
            <TickerBadge ticker="AAPL" kind="equity" logo="logo.apple" />
          </Wrap>
        </>
      );
    case 'choices':
      return (
        <>
          <Segmented<'low' | 'mid' | 'high'>
            label="Risk"
            value={choice}
            onChange={setChoice}
            options={[
              { value: 'low', label: 'Low', hint: '2 %' },
              { value: 'mid', label: 'Mid', hint: '5 %' },
              { value: 'high', label: 'High', hint: '9 %', disabled: true },
            ]}
          />
          <Toggle on onChange={noop} label="Sound" hint="Clicks and coins" />
          <Toggle on={false} onChange={noop} label="Calendar" icon="icon.calendar" />
        </>
      );
    case 'lists':
      return (
        <>
          <View>
            <Row left="Salary" right="+2.400 $" sub="Every month" />
            <Row left="Rent" right="-900 $" />
          </View>
          <Wrap gap={16} end>
            <KeyFigure>12.346 $</KeyFigure>
            <KeyFigure tone="teal">+8 %</KeyFigure>
            <KeyFigure tone="wine">-3 %</KeyFigure>
            <KeyFigure tone="cream">42</KeyFigure>
          </Wrap>
        </>
      );
    case 'sheet-gold':
    case 'sheet-wine':
      return (
        <Sheet open onClose={noop} title={section === 'sheet-gold' ? 'A promotion' : 'A crash'} closeLabel="Close" tone={section === 'sheet-gold' ? 'gold' : 'wine'}>
          <ReadText style={{ marginBottom: 12 }}>{section === 'sheet-gold' ? 'Your salary rises by 400 $ a month.' : 'Your shares lose a third of their value.'}</ReadText>
          <Button variant="primary" wide onPress={noop}>Go on</Button>
        </Sheet>
      );
    case 'tabs':
      return (
        <>
          <Tabs<'cash' | 'stocks' | 'debts'> label="Finance" value={tab} onChange={setTab} tabs={[{ id: 'cash', label: 'Cash' }, { id: 'stocks', label: 'Stocks' }, { id: 'debts', label: 'Debts' }]} />
          <Picker<string | null>
            label="City"
            value={city}
            onChange={setCity}
            closeLabel="Close"
            options={[
              { value: 'madrid', label: 'Madrid', icon: 'icon.city_madrid' },
              { value: 'tokyo', label: 'Tokyo', icon: 'icon.city_tokyo' },
            ]}
          />
        </>
      );
    case 'art':
      return (
        <>
          <Wrap gap={12} end>
            <Sprite id="icon.cash" scale={1} />
            <Sprite id="icon.cash" scale={2} />
            <Sprite id="icon.cash" scale={3} />
            <Sprite id="item.watch_casio" scale={1} silhouette />
          </Wrap>
          <Wrap gap={12} end>
            <RatAvatar look={LOOK} size="sm" />
            <RatAvatar look={LOOK} size="md" />
            <RatAvatar look={LOOK} size="lg" />
          </Wrap>
        </>
      );
    case 'text-es':
    case 'text-ru': {
      const words = section === 'text-es' ? ES : RU;
      // In its own language, as the web shows it at /es/kit and /ru/kit.
      return (
        <Language.Provider value={section === 'text-es' ? 'es' : 'ru'}>
          <PixelText size={28}>{words.pixel}</PixelText>
          <PixelText size={17}>{words.pixel}</PixelText>
          <ReadText>{words.read}</ReadText>
          <ReadText size={12} tone="ink-200">{words.read}</ReadText>
        </Language.Provider>
      );
    }
    case 'type':
      // Each size in a box of its own, so where its letters stand can be measured on its own.
      return (
        <View>
          {SIZES.map((size) => (
            <View key={size} style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1, height: 40 }}><PixelText size={size}>Hx 0</PixelText></View>
              <View style={{ flex: 1, height: 40 }}><ReadText size={size}>Hx 0</ReadText></View>
            </View>
          ))}
        </View>
      );
    case 'dots':
      return null;
    case 'motion-2':
      return kitMotion ? <kitMotion.MotionTwo /> : null;
  }
}

export default function KitRoute() {
  const { section } = useLocalSearchParams<{ section?: string }>();
  if (!__DEV__) return <Redirect href="/" />;
  const shown: Section = (KIT_SECTIONS as readonly string[]).includes(section ?? '') ? (section as Section) : 'buttons';
  return (
    // The Toast is fixed to the screen, as the web's is to the viewport: over the page, not in its column.
    <Screen contentStyle={{ gap: 16 }} fixed={shown === 'tabs' ? <Toast message="Not enough cash" onDone={noop} ms={1_000_000_000} /> : undefined}>
      <PixelText size={19} tone="gold-500">{shown}</PixelText>
      <Body section={shown} />
    </Screen>
  );
}
