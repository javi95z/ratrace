'use client';

// The kit, one section to a page, for the phone app's parity check (apps/mobile/src/app/kit.tsx shows the
// same sections in the same order, with the same words). On the expo branch only; never linked, never in the sitemap.
import { use, useState, type ReactNode } from 'react';
import type { RatLook } from '@ratrace/core/game/avatar';
import { Bar, Bare, Button, KeyFigure, Panel, Row, Segmented, Stat, Tag, TickerBadge, TILE, Toggle, Well } from '@/ui/kit';
import { Sheet, Tabs, Toast } from '@/ui/overlay';
import { Picker } from '@/ui/Picker';
import { RatAvatar } from '@/ui/RatAvatar';
import { Sprite } from '@/ui/Sprite';
import { FIELD } from '@/game/screens/Rankings';
import { MotionTwo } from './motion';

const KIT_SECTIONS = ['buttons', 'surfaces', 'stats', 'bars', 'choices', 'lists', 'sheet-gold', 'sheet-wine', 'tabs', 'art', 'text-es', 'text-ru', 'type', 'dots', 'motion-2', 'forms'] as const;
type Section = (typeof KIT_SECTIONS)[number];

const LOOK: RatLook = { colour: 'teal', body: 'grey', face: 'grin', outfit: 'suit', hat: 'crown', eyes: 'round', backdrop: 'stars' };
const VARIANTS = ['primary', 'secondary', 'danger', 'quiet'] as const;
const noop = () => {};
const SIZES = [11, 12, 14, 15, 16, 17, 19, 28] as const;

const ES = { pixel: 'Año nuevo: 12.346 $', read: 'Pagas el alquiler y te quedan 1.234 $ para el mes.' };
const RU = { pixel: 'Новый год: 12 346 $', read: 'Вы платите аренду, и на месяц остаётся 1 234 $.' };

/** The room code's field, as Room.tsx writes it. */
const ROOM_FIELD = 'pixel frame sunk min-h-11 w-full bg-night-900 px-3 text-[22px] tracking-[0.3em] text-cream placeholder:text-ink-500';
/** The web's `:focus-visible` look, held still with no focus: the outline globals.css gives it. */
const FOCUSED = { outline: '3px solid var(--color-gold-200)', outlineOffset: 3, position: 'relative', zIndex: 1 } as const;

/** The web's pressed look, held still: the `active:translate-y-[2px]` of a pressable, copied. */
const Pressed = ({ children }: { children: ReactNode }) => <div style={{ transform: 'translateY(2px)' }}>{children}</div>;

function Body({ section }: { section: Section }): ReactNode {
  const [choice, setChoice] = useState<'low' | 'mid' | 'high'>('mid');
  const [tab, setTab] = useState<'cash' | 'stocks' | 'debts'>('stocks');
  const [city, setCity] = useState<string | null>('madrid');
  switch (section) {
    case 'buttons':
      return (
        <>
          <div className="flex flex-wrap gap-2">
            {VARIANTS.map((v) => <Button key={v} variant={v}>Go</Button>)}
          </div>
          <div className="flex flex-wrap gap-2">
            {VARIANTS.map((v) => <Pressed key={v}><Button variant={v}>Held</Button></Pressed>)}
          </div>
          <div className="flex flex-wrap gap-2">
            {VARIANTS.map((v) => <Button key={v} variant={v} disabled>Off</Button>)}
          </div>
          <Button variant="primary" wide>Start a new life</Button>
        </>
      );
    case 'surfaces':
      return (
        <>
          <div className="grid grid-cols-3 gap-2">
            {['icon.cash', 'icon.bond', 'icon.crypto'].map((id) => (
              <button key={id} type="button" className={TILE}>
                <Bare><Sprite id={id} /></Bare>
                <span>1.200 $</span>
              </button>
            ))}
          </div>
          <Panel title="Savings">
            <p>Money put aside for a rainy day.</p>
          </Panel>
          <Panel>
            <p>A panel without a title.</p>
          </Panel>
          <div className="flex flex-wrap gap-2">
            <Tag tone="good">+120 $</Tag>
            <Tag tone="bad">-80 $</Tag>
            <Tag tone="plain">Rent</Tag>
          </div>
          <div className="flex gap-2">
            <Well><Sprite id="icon.city" /></Well>
          </div>
        </>
      );
    case 'stats':
      return (
        <>
          {[300, 360].map((width) => (
            <div key={width} className="@container flex flex-col gap-3" style={{ width }}>
              <Stat icon="icon.cash" value="12.346 $" label="Cash" />
              <Stat icon="icon.calendar" value="Year 3" label="Round" tone="good" onOpen={noop} />
              <Stat icon="icon.crypto" value="-450 $" label="Cashflow" tone="bad" />
            </div>
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
          <div className="flex flex-wrap gap-2">
            <TickerBadge ticker="BND" kind="bond" />
            <TickerBadge ticker="IDX" kind="equity" />
            <TickerBadge ticker="BTC" kind="crypto" />
            <TickerBadge ticker="AU" kind="gold" />
            <TickerBadge ticker="AAPL" kind="equity" logo="logo.apple" />
          </div>
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
          <div>
            <Row left="Salary" right="+2.400 $" sub="Every month" />
            <Row left="Rent" right="-900 $" />
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <KeyFigure>12.346 $</KeyFigure>
            <KeyFigure tone="teal">+8 %</KeyFigure>
            <KeyFigure tone="wine">-3 %</KeyFigure>
            <KeyFigure tone="cream">42</KeyFigure>
          </div>
        </>
      );
    case 'sheet-gold':
    case 'sheet-wine':
      return (
        <Sheet open onClose={noop} title={section === 'sheet-gold' ? 'A promotion' : 'A crash'} closeLabel="Close" tone={section === 'sheet-gold' ? 'gold' : 'wine'}>
          <p className="mb-3">{section === 'sheet-gold' ? 'Your salary rises by 400 $ a month.' : 'Your shares lose a third of their value.'}</p>
          <Button variant="primary" wide>Go on</Button>
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
          <Toast message="Not enough cash" onDone={noop} ms={1_000_000_000} />
        </>
      );
    case 'art':
      return (
        <>
          <div className="flex flex-wrap items-end gap-3">
            <Sprite id="icon.cash" scale={1} />
            <Sprite id="icon.cash" scale={2} />
            <Sprite id="icon.cash" scale={3} />
            <Sprite id="item.watch_casio" scale={1} silhouette />
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <RatAvatar look={LOOK} size="sm" />
            <RatAvatar look={LOOK} size="md" />
            <RatAvatar look={LOOK} size="lg" />
          </div>
        </>
      );
    case 'text-es':
    case 'text-ru': {
      const words = section === 'text-es' ? ES : RU;
      return (
        <>
          <p className="pixel text-[28px]">{words.pixel}</p>
          <p className="pixel text-[17px]">{words.pixel}</p>
          <p>{words.read}</p>
          <p className="text-[12px] text-ink-200">{words.read}</p>
        </>
      );
    }
    case 'type':
      // Each size in a box of its own, so where its letters stand can be measured on its own.
      return (
        <div className="grid grid-cols-2 gap-x-3">
          {SIZES.map((size) => (
            <div key={size} className="contents">
              <div className="h-10"><p className="pixel" style={{ fontSize: size }}>Hx 0</p></div>
              <div className="h-10"><p style={{ fontSize: size }}>Hx 0</p></div>
            </div>
          ))}
        </div>
      );
    case 'dots':
      return null;
    case 'motion-2':
      return <MotionTwo />;
    case 'forms':
      // Empty, with a placeholder, filled, focused (held: the `:focus-visible` ring), a friend's code, a room's code.
      return (
        <>
          <label className="flex flex-col gap-1 text-[13px] text-ink-200">
            {'Name'}
            <input defaultValue="" maxLength={16} autoComplete="off" autoCapitalize="off" spellCheck={false} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-ink-200">
            {'Name'}
            <input defaultValue="" placeholder="Your name" maxLength={16} autoComplete="off" autoCapitalize="off" spellCheck={false} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-ink-200">
            {'Name'}
            <input defaultValue="Ratty_99" maxLength={16} autoComplete="off" autoCapitalize="off" spellCheck={false} className={FIELD} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-ink-200">
            {'Name'}
            <input defaultValue="Ratty_99" maxLength={16} autoComplete="off" autoCapitalize="off" spellCheck={false} className={FIELD} style={FOCUSED} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-ink-200">
            {'Friend code'}
            <input defaultValue="AB12CD34" maxLength={12} autoComplete="off" autoCapitalize="characters" spellCheck={false} className={`${FIELD} uppercase tracking-[0.12em]`} />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-ink-200">
            {'Code'}
            <input defaultValue="K7Q2XM" maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} className={ROOM_FIELD} placeholder="······" />
          </label>
          <label className="flex flex-col gap-1 text-[13px] text-ink-200">
            {'Code'}
            <input defaultValue="" maxLength={6} autoComplete="off" autoCapitalize="characters" spellCheck={false} className={ROOM_FIELD} placeholder="······" />
          </label>
        </>
      );
  }
}

export default function KitPage({ searchParams }: { searchParams: Promise<{ section?: string }> }) {
  const { section } = use(searchParams);
  const shown: Section = (KIT_SECTIONS as readonly string[]).includes(section ?? '') ? (section as Section) : 'buttons';
  return (
    <main className="mx-auto flex w-full max-w-md flex-col gap-4 px-3 pt-4">
      <h1 className="pixel text-[19px] text-gold-500">{shown}</h1>
      <Body section={shown} />
    </main>
  );
}
