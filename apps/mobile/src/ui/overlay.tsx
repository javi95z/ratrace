import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sheetOpened } from './back';
import { Framed } from './Frame';
import { CREAM, GOLD, WINE } from './frames';
import { useRise } from './animations';
import { pressDown, usePress } from './kit';
import { PixelText, ReadText } from './text';
import { COLORS, EXTRA, SHELL_WIDTH, TOUCH } from './theme';

/**
 * A panel that comes up from the bottom over a dimmed page (the web's Sheet): the backdrop closes it,
 * so does Android's Back, and it scrolls when it is taller than 88 % of the screen.
 * `back` is the web's history-back switch and has no effect on native: Back always closes an open sheet.
 * It is modal: a screen reader stays inside it. `tone` lights its frame gold or wine.
 *
 * A sheet that is closed stays mounted, its Modal hidden, until the Modal has dismissed, so that `sheetsGone` (./back)
 * can tell a screen that moves on after closing its sheets when they are gone. Every opening is a panel of its own,
 * so its rise plays from its first frame.
 */
export function Sheet({ open, onClose, title, closeLabel, tone, children }: { open: boolean; onClose(): void; title: string; closeLabel: string; back?: boolean; tone?: 'gold' | 'wine'; children: ReactNode }) {
  const [held, setHeld] = useState({ was: open, opening: open ? 1 : 0, mounted: open });
  let now = held;
  if (open !== held.was) {
    now = { was: open, opening: held.opening + (open ? 1 : 0), mounted: open || held.mounted };
    setHeld(now);
  }
  const opening = now.opening;
  // Said by the panel that is leaving; one that was replaced by another opening has nothing left to say.
  const leave = useCallback(() => setHeld((current) => (current.opening === opening ? { ...current, mounted: false } : current)), [opening]);
  return now.mounted ? (
    <SheetPanel key={opening} open={open} onClose={onClose} onGone={leave} title={title} closeLabel={closeLabel} tone={tone}>
      {children}
    </SheetPanel>
  ) : null;
}

/** How long a Modal that says nothing of its dismissal is waited for on iOS: it was never shown, so there is nothing to wait for. */
const DISMISS_MS = 600;

function SheetPanel({ open, onClose, onGone, title, closeLabel, tone, children }: { open: boolean; onClose(): void; onGone(): void; title: string; closeLabel: string; tone?: 'gold' | 'wine'; children: ReactNode }) {
  const inset = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const rise = useRise();
  const close = usePress({ onPress: onClose });

  // Counted from its opening to its dismissal (./back), and let go if its parent takes it away before.
  const release = useRef<(() => void) | null>(null);
  useEffect(() => {
    const counted = sheetOpened();
    release.current = counted;
    return counted;
  }, []);
  const left = useRef(onGone);
  useEffect(() => {
    left.current = onGone;
  });
  const dismissed = useCallback(() => {
    release.current?.();
    left.current();
  }, []);
  // The Modal's own word is `onDismiss` on iOS, which hides it with a moment's work. Where a platform hides a Modal at once and
  // says nothing (Android, the web), it is gone as soon as it is told it is hidden; and a Modal on iOS that was never shown
  // cannot say it has dismissed, so it is let go after a while.
  useEffect(() => {
    if (open) return;
    if (Platform.OS !== 'ios') {
      dismissed();
      return;
    }
    const timer = setTimeout(dismissed, DISMISS_MS);
    return () => clearTimeout(timer);
  }, [open, dismissed]);

  return (
    <Modal transparent animationType="none" visible={open} statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} onDismiss={open ? undefined : dismissed}>
      <View
        accessibilityViewIsModal
        aria-modal
        style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingTop: inset.top, paddingLeft: inset.left, paddingRight: inset.right }}
      >
        <Pressable
          testID="sheet-backdrop"
          accessible={false}
          importantForAccessibility="no"
          onPress={onClose}
          style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: EXTRA.backdrop }}
        />
        <Animated.View style={[{ width: '100%', maxWidth: SHELL_WIDTH }, rise]}>
          <Framed
            kind="bevel"
            tone={tone === 'gold' ? GOLD : tone === 'wine' ? WINE : {}}
            style={{ backgroundColor: COLORS['night-800'], maxHeight: height * 0.88 }}
          >
            <ScrollView
              bounces={false}
              style={{ flexGrow: 0 }}
              contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: Math.max(12, inset.bottom) }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                <View accessibilityRole="header" style={{ flexShrink: 1, paddingTop: 4 }}>
                  <PixelText size={19}>{title}</PixelText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={closeLabel}
                  onPress={close}
                  style={({ pressed }) => ({ ...pressDown(pressed), width: TOUCH, height: TOUCH, marginRight: -8, marginTop: -8, flexShrink: 0, alignItems: 'center', justifyContent: 'center' })}
                >
                  <PixelText size={20} tone="ink-300">{'✕'}</PixelText>
                </Pressable>
              </View>
              {children}
            </ScrollView>
          </Framed>
        </Animated.View>
      </View>
    </Modal>
  );
}

function TabButton({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  const press = usePress({ onPress });
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: on }}
      aria-selected={on}
      onPress={press}
      style={({ pressed }) => ({ ...pressDown(pressed), flexShrink: 0 })}
    >
      <Framed
        kind="raised"
        tone={on ? CREAM : {}}
        style={{
          backgroundColor: COLORS[on ? 'cream' : 'night-700'],
          minHeight: TOUCH,
          paddingHorizontal: 12,
          justifyContent: 'center',
        }}
      >
        <PixelText size={15} tone={on ? 'ink-900' : 'ink-200'}>{label}</PixelText>
      </Framed>
    </Pressable>
  );
}

/** A strip of tabs that scrolls sideways, without an indicator. */
export function Tabs<T extends string>({ label, tabs, value, onChange }: { label?: string; tabs: Array<{ id: T; label: string }>; value: T; onChange(id: T): void }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={label}
      style={{ flexGrow: 0 }}
      contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingVertical: 8 }}
    >
      {tabs.map((tab) => (
        <TabButton key={tab.id} label={tab.label} on={tab.id === value} onPress={() => onChange(tab.id)} />
      ))}
    </ScrollView>
  );
}

/**
 * A short message that shows itself out, announced politely. Fixed to the screen, as the web's `fixed bottom-28`: a
 * screen gives it as its Screen's `fixed`, never inside the column, where it would scroll with the page.
 */
export function Toast({ message, onDone, ms = 2600 }: { message: string | null; onDone(): void; ms?: number }) {
  const rise = useRise();
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  });
  useEffect(() => {
    if (message === null) return;
    // One announcement: iOS has no live region, Android's live region announces by itself.
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility?.(message);
    const timer = setTimeout(() => done.current(), ms);
    return () => clearTimeout(timer);
  }, [message, ms]);

  if (message === null) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      aria-live="polite"
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 112, zIndex: 60, alignItems: 'center', paddingHorizontal: 16 }}
    >
      <Animated.View style={rise}>
        <Framed kind="frame" style={{ backgroundColor: COLORS['wine-700'], paddingHorizontal: 12, paddingVertical: 8 }}>
          <ReadText size={14} style={{ textAlign: 'center' }}>{message}</ReadText>
        </Framed>
      </Animated.View>
    </View>
  );
}
