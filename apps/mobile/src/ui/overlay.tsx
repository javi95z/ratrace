import { useEffect, useRef, type ReactNode } from 'react';
import { AccessibilityInfo, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
 */
export function Sheet({ open, onClose, title, closeLabel, tone, children }: { open: boolean; onClose(): void; title: string; closeLabel: string; back?: boolean; tone?: 'gold' | 'wine'; children: ReactNode }) {
  // Mounted only while open, so every opening plays its rise from the first frame.
  return open ? (
    <SheetPanel onClose={onClose} title={title} closeLabel={closeLabel} tone={tone}>
      {children}
    </SheetPanel>
  ) : null;
}

function SheetPanel({ onClose, title, closeLabel, tone, children }: { onClose(): void; title: string; closeLabel: string; tone?: 'gold' | 'wine'; children: ReactNode }) {
  const inset = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const rise = useRise();
  const close = usePress({ onPress: onClose });

  return (
    <Modal transparent animationType="none" visible statusBarTranslucent navigationBarTranslucent onRequestClose={onClose}>
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
