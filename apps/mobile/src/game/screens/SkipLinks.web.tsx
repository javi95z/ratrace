import { useState } from 'react';
import { Pressable, View, type ViewStyle } from 'react-native';
import { Framed } from '../../ui/Frame';
import { PixelText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useT } from '../context';

/*
 * The web's twin of `SkipLinks.tsx`: the skip links of a life (docs/keyboard.md, the Next web's Play), out of the layout until the keyboard reaches
 * them, each leading the focus to a part of the page.
 */

/** CSS react-native-web passes through that React Native's types do not name: `position: fixed`. */
const css = (style: Record<string, unknown>): ViewStyle => style as ViewStyle;

/** A skip link: a gold button that leads the focus to a part of the page (`id`), drawn only while it, or another of them, has the focus. */
function SkipLink({ target, label, onFocus, onBlur }: { target: string; label: string; onFocus(): void; onBlur(): void }) {
  return (
    <Pressable
      accessibilityRole="link"
      onFocus={onFocus}
      onBlur={onBlur}
      onPress={() => {
        // The address is left as it is (no `#`): the router would take a new hash for a page to open.
        const to = document.getElementById(target);
        to?.focus();
        to?.scrollIntoView?.({ block: 'nearest' });
      }}
    >
      <Framed kind="raised" style={{ backgroundColor: COLORS['gold-500'], paddingHorizontal: 12, paddingVertical: 8 }}>
        <PixelText tone="ink-900">{label}</PixelText>
      </Framed>
    </Pressable>
  );
}

/**
 * The skip links of a life (the Next web's Play), in its order: the round, and at desk width the profile, the news and (in the finances) the orders;
 * the round's actions where there are any.
 */
export function SkipLinks({ desk = false, finance, actions }: { desk?: boolean; finance: boolean; actions: boolean }) {
  const t = useT('keyboard.skip');
  const [focused, setFocused] = useState(0);
  const on = () => setFocused((n) => n + 1);
  const off = () => setFocused((n) => Math.max(0, n - 1));
  const links: Array<[string, string]> = [
    ['round-stage', t('stage')],
    ...(desk ? ([['player-profile', t('profile')], ['round-news', t('news')]] as Array<[string, string]>) : []),
    ...(desk && finance ? ([['round-orders', t('orders')]] as Array<[string, string]>) : []),
    ...(actions ? ([['round-actions', t('actions')]] as Array<[string, string]>) : []),
  ];
  return (
    // The web's `.skip-links`: fixed 12 from the top left, over everything, lifted out of sight until one of them has the focus (`:focus-within`).
    <View
      role="navigation"
      aria-label={t('stage')}
      style={css({ position: 'fixed', left: 12, top: 12, zIndex: 80, flexDirection: 'row', gap: 8, transform: focused > 0 ? 'translateY(0)' : 'translateY(-180%)' })}
    >
      {links.map(([target, label]) => (
        <SkipLink key={target} target={target} label={label} onFocus={on} onBlur={off} />
      ))}
    </View>
  );
}
