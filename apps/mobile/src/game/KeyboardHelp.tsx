import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '../ui/kit';
import { HAS_KEYBOARD, Keycap, KeyboardHint, KeyboardListener, useKeyboardHelp, type KeyboardContextName } from '../ui/keyboard';
import { Sheet } from '../ui/overlay';
import { ReadText } from '../ui/text';
import { COLORS } from '../ui/theme';
import { useT } from './context';

/*
 * The keyboard's reference, as the Next web's (`KeyboardHelp`, `KeyboardGuide` in apps/web/src/ui/keyboard.tsx): `?` opens it anywhere outside
 * another sheet, and it says only what applies to the screen in front. On the web only (`HAS_KEYBOARD`): a phone has no keyboard to play with.
 */

/** A key and what it does, on a row of its own: the key's cap in a column at least `keys` wide, the words beside it, a rule between rows. */
function KeyRow({ keys, first, width, children }: { keys: string; first: boolean; width: number; children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, ...(first ? null : { borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 8 }) }}>
      <View style={{ minWidth: width }}>
        <Keycap>{keys}</Keycap>
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <ReadText size={13} lineHeight={13 * 1.375} tone="ink-200">{children}</ReadText>
      </View>
    </View>
  );
}

/** The rows of the reference for a screen: the four that always apply, then the screen's own. */
function rowsFor(context: KeyboardContextName, t: (key: string) => string): Array<[string, string]> {
  const rows: Array<[string, string]> = [
    ['Tab', t('help.tab')],
    ['Shift + Tab', t('help.shiftTab')],
    ['Esc', t('help.escape')],
    ['?', t('help.question')],
  ];
  if (context === 'new-life') rows.push(['↑ / ↓ · Home / End', t('help.life')]);
  if (context === 'cards') rows.push(['↑ / ↓ · 1–4', t('help.cards')]);
  if (context === 'finance') {
    rows.push(['← / → · Home / End', t('help.tabs')]);
    rows.push(['[ / ]', t('help.switchTab')]);
    rows.push(['Shift + ← / → · PgUp / PgDn', t('help.amount')]);
  }
  if (context === 'play' || context === 'finance') rows.push(['Ctrl/⌘ + Enter', t('help.primary')]);
  return rows;
}

/** The keyboard on the page, and its reference when asked for: mounted once, inside the game, by the app's root. Nothing on a phone. */
export function KeyboardControls() {
  const t = useT('keyboard');
  const common = useT('common');
  const help = useKeyboardHelp();
  if (!HAS_KEYBOARD) return null;
  return (
    <>
      <KeyboardListener />
      <Sheet open={help.open} onClose={help.close} title={t('title')} closeLabel={common('close')}>
        <ReadText size={14} lineHeight={14 * 1.375} tone="ink-200" style={{ marginBottom: 12 }}>{t('intro')}</ReadText>
        <View style={{ gap: 8 }}>
          {rowsFor(help.context, t).map(([keys, words], i) => (
            <KeyRow key={keys} keys={keys} first={i === 0} width={120}>
              {words}
            </KeyRow>
          ))}
        </View>
      </Sheet>
    </>
  );
}

/** The settings' entry to the keys (the web's `KeyboardGuide`): it unfolds in place, so it never stacks one sheet over another. Nothing on a phone. */
export function KeyboardGuide() {
  const t = useT('keyboard');
  const [open, setOpen] = useState(false);
  if (!HAS_KEYBOARD) return null;
  return (
    <View style={{ borderTopWidth: 2, borderTopColor: COLORS['night-900'], paddingTop: 12 }}>
      <Button variant="secondary" wide expanded={open} hint={<KeyboardHint>?</KeyboardHint>} onPress={() => setOpen((shown) => !shown)}>
        {t('open')}
      </Button>
      {open ? (
        <View style={{ marginTop: 12, gap: 8 }}>
          {rowsFor('general', t).map(([keys, words]) => (
            <KeyRow key={keys} keys={keys} first={false} width={112}>
              {words}
            </KeyRow>
          ))}
        </View>
      ) : null}
    </View>
  );
}
