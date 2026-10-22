import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { AccessibilityInfo, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { holdingTurn, sheetAsked, sheetOpened, sheetsShut, subscribeShut } from './back';
import { Framed } from './Frame';
import { CREAM, GOLD, WINE } from './frames';
import { useRise } from './animations';
import { pressDown, usePress } from './kit';
import { PerfDrawn, perfSheet, perfTouched } from './perf';
import { PixelText, ReadText } from './text';
import { COLORS, EXTRA, SHELL_WIDTH, TOUCH } from './theme';

/*
 * What is drawn over everything: the toasts being shown, and the sheets open, kept outside React. The web's toast stands over its sheets (z 60
 * over their 50). On the phone a sheet is a window of its own (a Modal), which nothing of the screen is drawn over: while one is open the toasts
 * are drawn in it, by the sheet on top; with none open, each where its screen put it (its `fixed`).
 */
/** A toast being shown; `drawn` once it has been drawn somewhere (the screen or a sheet): drawn again elsewhere, it is carried over, not said anew. */
type Shown = { readonly id: number; readonly message: string; drawn: boolean };
const top = {
  toasts: [] as readonly Shown[],
  sheets: [] as readonly number[],
  listeners: new Set<() => void>(),
};
let nextId = 1;
const subscribeTop = (listener: () => void) => {
  top.listeners.add(listener);
  return () => void top.listeners.delete(listener);
};
function changeTop(change: () => void): void {
  change();
  top.listeners.forEach((listener) => listener());
}
/** Whether a sheet is open, which the toasts are then drawn in. */
const useSheetOpen = (): boolean => useSyncExternalStore(subscribeTop, () => top.sheets.length > 0, () => false);

/*
 * Sheets in turn. On iOS a Modal is a view controller presented by the one under it, and one cannot present a second while it presents the first
 * (UIKit: "Attempt to present … which is already presenting"): two sheets opened side by side (the moment of leaving the rat race and a legendary
 * badge, by the same step) left the second never shown, and the player never saw it. The web draws both, one over the other. Here one at a time:
 * each sheet that is open takes its turn (`turns`), from when it opens until its Modal has gone. A sheet drawn inside another (`SheetParent`) is
 * presented by that one, and shows at once. Of sheets that open together, the last opened shows first, as the web's last portal is drawn on top;
 * one that opens while another is shown (or still leaving) waits until it has gone.
 */
interface Turn {
  id: number;
  /** The sheet this one is drawn inside, if any. */
  parent: number | null;
  /** Its Modal has been presented (and has not gone yet). */
  shown: boolean;
}
const turns: Turn[] = [];
/** The sheet a sheet is drawn inside: the one that presents it. */
const SheetParent = createContext<number | null>(null);
const within = (id: number, outer: number): boolean => {
  for (let at = turns.find((turn) => turn.id === id)?.parent ?? null; at !== null; at = turns.find((turn) => turn.id === at)?.parent ?? null) if (at === outer) return true;
  return false;
};
/** Whether a sheet that is open may show now: no other sheet but its own (one it is in, or one in it) is shown, and none waiting with it opened after it. */
function hasTurn(id: number): boolean {
  const at = turns.findIndex((turn) => turn.id === id);
  if (at < 0) return false;
  if (turns[at].shown) return true;
  const others = turns.filter((turn, i) => i !== at && !within(id, turn.id) && !within(turn.id, id));
  return !others.some((turn) => turn.shown) && others.every((turn) => turns.indexOf(turn) < at);
}
function takeTurn(id: number, parent: number | null): void {
  if (turns.some((turn) => turn.id === id)) return;
  changeTop(() => void turns.push({ id, parent, shown: false }));
}
function turnShown(id: number): void {
  const turn = turns.find((one) => one.id === id);
  if (turn && !turn.shown) changeTop(() => void (turn.shown = true));
}
function endTurn(id: number): void {
  const at = turns.findIndex((turn) => turn.id === id);
  if (at >= 0) changeTop(() => void turns.splice(at, 1));
}
/**
 * How long a sheet taken away whole while it is shown keeps its turn, by platform: its screen gone from under it (a room started or left), its Modal is
 * still being dismissed on the phone, and no other may be presented until it has gone. An unmounted Modal can say nothing of its dismissal (its
 * `onDismiss` has gone with it), so the turn is held for as long as iOS takes (`DISMISS_MS`), and a moment on Android; react-native-web's is gone at once.
 */
// Android hides a Modal as it is told: not measured (no emulator on the machine of the device checks), a moment is kept all the same.
const ANDROID_GONE_MS = 100;
function endTurnOnceGone(id: number): void {
  const wait = Platform.OS === 'ios' ? DISMISS_MS : Platform.OS === 'android' ? ANDROID_GONE_MS : undefined;
  if (wait === undefined || !turns.some((turn) => turn.id === id && turn.shown)) return endTurn(id);
  const letGo = () => {
    clearTimeout(timer);
    stop();
    endTurn(id);
  };
  const timer = setTimeout(letGo, wait);
  const stop = holdingTurn(letGo);
}

/**
 * A panel that comes up from the bottom over a dimmed page (the web's Sheet): the backdrop closes it,
 * so does Android's Back, and it scrolls when it is taller than 88 % of the screen.
 * `back` is the web's history-back switch and has no effect on native: Back always closes an open sheet.
 * It is modal: a screen reader stays inside it. `tone` lights its frame gold or wine.
 *
 * A sheet that is closed stays mounted, its Modal hidden, until the Modal has dismissed, so that `sheetsGone` (./back)
 * can tell a screen that moves on after closing its sheets when they are gone. Every opening is a panel of its own,
 * so its rise plays from its first frame. `onGone` is told when a sheet that closed has gone, its Modal dismissed: a sheet
 * that gives way to another (a list to one of its things) opens the other then, never while it is still leaving (on iOS
 * a Modal presented while another dismisses can fail, or leave that one half gone).
 */
export function Sheet({ open: asked, onClose, onGone, title, closeLabel, tone, children }: { open: boolean; onClose(): void; onGone?: () => void; title: string; closeLabel: string; back?: boolean; tone?: 'gold' | 'wine'; children: ReactNode }) {
  // Open as its screen asks, unless every sheet is being shut (`closeEverySheet`).
  const shut = useSyncExternalStore(subscribeShut, sheetsShut, () => false);
  const open = asked && !shut;
  const [held, setHeld] = useState({ was: open, opening: open ? 1 : 0, mounted: open });
  let now = held;
  if (open !== held.was) {
    now = { was: open, opening: held.opening + (open ? 1 : 0), mounted: open || held.mounted };
    setHeld(now);
  }
  const opening = now.opening;
  // Its turn among the sheets (`turns`): taken as it opens, before it is drawn, and given up once its Modal has gone, or as it closes unshown.
  const parent = useContext(SheetParent);
  const [id] = useState(() => nextId++);
  useLayoutEffect(() => {
    if (open) takeTurn(id, parent);
  }, [open, id, parent]);
  useLayoutEffect(() => () => endTurnOnceGone(id), [id]);
  const turn = useSyncExternalStore(subscribeTop, () => hasTurn(id), () => false);
  // The latest opening, and who is told when a sheet has gone, as they are when the Modal says it has dismissed.
  const latest = useRef(opening);
  const told = useRef(onGone);
  const closing = useRef(onClose);
  useEffect(() => {
    latest.current = opening;
    told.current = onGone;
    closing.current = onClose;
  });
  // Known, while its screen asks for it, by how it is closed: a notice tapped closes it as the player would (`closeAllSheets`).
  useEffect(() => {
    if (!asked) return;
    return sheetAsked({ close: () => closing.current() });
  }, [asked]);
  // Said by the panel that is leaving; one that was replaced by another opening has nothing left to say.
  const leave = useCallback(() => {
    setHeld((current) => (current.opening === opening ? { ...current, mounted: false } : current));
    if (latest.current === opening) {
      endTurn(id);
      told.current?.();
    }
  }, [opening, id]);
  // Closed while it waited for its turn: never shown, so nothing to wait for.
  const waiting = now.mounted && !turn;
  useEffect(() => {
    if (open || !waiting) return;
    endTurn(id);
    setHeld((current) => ({ ...current, mounted: false }));
    told.current?.();
  }, [open, waiting, id]);
  return now.mounted && turn ? (
    <SheetParent.Provider value={id}>
      <SheetPanel key={opening} open={open} onClose={onClose} onGone={leave} onShown={() => turnShown(id)} title={title} closeLabel={closeLabel} tone={tone}>
        {children}
      </SheetPanel>
    </SheetParent.Provider>
  ) : null;
}

/** Whether the keyboard is up: told as it starts to come and go on iOS, once it has on Android (which tells nothing before). */
function useKeyboardUp(): boolean {
  const [up, setUp] = useState(false);
  useEffect(() => {
    const [show, hide] = Platform.OS === 'ios' ? (['keyboardWillShow', 'keyboardWillHide'] as const) : (['keyboardDidShow', 'keyboardDidHide'] as const);
    const shown = Keyboard.addListener(show, () => setUp(true));
    const hidden = Keyboard.addListener(hide, () => setUp(false));
    return () => {
      shown.remove();
      hidden.remove();
    };
  }, []);
  return up;
}

/**
 * How long a Modal that says nothing of its dismissal is waited for on iOS: one never shown (nothing to wait for), or one taken away whole while it
 * was shown (`endTurnOnceGone`). Measured on the simulator (Task 14, the release build's probe): a sheet's Modal says it has dismissed 16 to 25 ms
 * after it is hidden (six sheets, median 22); 150 is six times the longest, for a slower phone, and a wait nobody notices before the next sheet.
 */
const DISMISS_MS = 150;

function SheetPanel({ open, onClose, onGone, onShown, title, closeLabel, tone, children }: { open: boolean; onClose(): void; onGone(): void; onShown(): void; title: string; closeLabel: string; tone?: 'gold' | 'wine'; children: ReactNode }) {
  const inset = useSafeAreaInsets();
  // Presented: its turn is held until it has gone.
  const shown = useRef(onShown);
  useLayoutEffect(() => {
    shown.current();
    // No sheet opens under the page's keyboard: a field focused on the page (a room's code) would keep it over the sheet on iOS, its buttons under it.
    Keyboard.dismiss();
  }, []);
  const { height } = useWindowDimensions();
  const typing = useKeyboardUp();
  const rise = useRise();
  const close = usePress({ onPress: onClose });

  // On top while it is open, the last opened over the others: the toasts are drawn in it.
  const [me] = useState(() => nextId++);
  useEffect(() => {
    if (!open) return;
    changeTop(() => void (top.sheets = [...top.sheets, me]));
    return () => changeTop(() => void (top.sheets = top.sheets.filter((one) => one !== me)));
  }, [open, me]);
  const onTop = useSyncExternalStore(subscribeTop, () => top.sheets[top.sheets.length - 1] === me, () => false);
  const toasts = useSyncExternalStore(subscribeTop, () => top.toasts, () => top.toasts);

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
    perfSheet('gone', title);
    release.current?.();
    left.current();
  }, [title]);
  // The Modal's own word is `onDismiss` on iOS, which hides it with a moment's work. Where a platform hides a Modal at once and
  // says nothing (Android, the web), it is gone as soon as it is told it is hidden; and a Modal on iOS that was never shown
  // cannot say it has dismissed, so it is let go after a while.
  useEffect(() => {
    if (open) return;
    perfSheet('closing', title);
    if (Platform.OS !== 'ios') {
      dismissed();
      return;
    }
    const timer = setTimeout(dismissed, DISMISS_MS);
    return () => clearTimeout(timer);
  }, [open, dismissed, title]);

  return (
    <Modal transparent animationType="none" visible={open} statusBarTranslucent navigationBarTranslucent onRequestClose={onClose} onDismiss={open ? undefined : dismissed}>
      {/*
       * A sheet with a field (a name, in a room's lobby) rises over the keyboard, on both platforms: a Modal is a window of its own, which neither
       * makes smaller for the keyboard (the page's own scroll does that for a page, Page's `KEYBOARD`), so the sheet's window leaves it its room.
       */}
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <View
          accessibilityViewIsModal
          aria-modal
          onTouchEnd={perfTouched}
          style={{ flex: 1, justifyContent: 'flex-end', alignItems: 'center', paddingTop: inset.top, paddingLeft: inset.left, paddingRight: inset.right }}
        >
          {/* A sheet's window is its own: its touches are the timing probe's too, and it says when it is drawn (EXPO_PUBLIC_PERF=1 builds only). */}
          <PerfDrawn name={`sheet: ${title}`} />
          <Pressable
            testID="sheet-backdrop"
            accessible={false}
            importantForAccessibility="no"
            onPress={onClose}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: EXTRA.backdrop }}
          />
          {/* Shrinking where the keyboard leaves less than its 88 %: it scrolls in what is left above the keyboard, never past the top of the screen. */}
          <Animated.View style={[{ width: '100%', maxWidth: SHELL_WIDTH, flexShrink: 1, minHeight: 0 }, rise]}>
            <Framed
              kind="bevel"
              tone={tone === 'gold' ? GOLD : tone === 'wine' ? WINE : {}}
              style={{ backgroundColor: COLORS['night-800'], maxHeight: height * 0.88, flexShrink: 1, minHeight: 0 }}
            >
              <ScrollView
                // A button tapped in a sheet while one of its fields has the keyboard up is the button's, not a tap that puts the keyboard away (Page's `KEYBOARD`).
                keyboardShouldPersistTaps="handled"
                bounces={false}
                style={{ flexGrow: 0, flexShrink: 1 }}
                // Its foot clears the home indicator, but not over the keyboard, which stands over the indicator.
                contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: typing ? 12 : Math.max(12, inset.bottom) }}
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
          {onTop ? toasts.map((toast) => <ToastBox key={toast.id} shown={toast} />) : null}
        </View>
      </KeyboardAvoidingView>
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
      // A tab tapped while a field of the page has the keyboard up is the tab's (Page's `KEYBOARD`).
      keyboardShouldPersistTaps="handled"
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
 * Whether a sheet is on screen, or still going: one shown, one waiting for its turn, or one taken away whose window is still being dismissed. What
 * stands over the page and not over a sheet (a room's shouts) waits for this to be false, so it is seen.
 */
export const useSheetsShowing = (): boolean => useSyncExternalStore(subscribeTop, () => top.sheets.length > 0 || turns.length > 0, () => false);

/**
 * A short message that shows itself out, announced politely. Fixed to the screen, as the web's `fixed bottom-28`: a
 * screen gives it as its Screen's `fixed`, never inside the column, where it would scroll with the page. While a sheet is open it is drawn
 * over the sheet, in its window, as the web's stands over its sheets (a refusal said of what was asked for in the sheet).
 */
export function Toast({ message, onDone, ms = 2600 }: { message: string | null; onDone(): void; ms?: number }) {
  const done = useRef(onDone);
  const [id] = useState(() => nextId++);
  const overSheet = useSheetOpen();
  // The toast as it is shown, the one object wherever it is drawn: the screen's place and a sheet's.
  const shown = useMemo<Shown | null>(() => (message === null ? null : { id, message, drawn: false }), [id, message]);
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
  // Shown, for a sheet that opens over it to draw it.
  useEffect(() => {
    if (shown === null) return;
    changeTop(() => void (top.toasts = [...top.toasts, shown]));
    return () => changeTop(() => void (top.toasts = top.toasts.filter((one) => one !== shown)));
  }, [shown]);

  if (shown === null || overSheet) return null;
  return <ToastBox shown={shown} />;
}

/**
 * The toast itself, rising into its place 112 over the foot of the screen, taking no press, and said by a screen reader (Android's live region;
 * iOS is told once by `Toast`). Where it is carried over (a sheet opened over it, or closed under it) it stands as it was: no second rise, and
 * not said again.
 */
function ToastBox({ shown }: { shown: Shown }) {
  const [carried] = useState(() => shown.drawn);
  useEffect(() => {
    shown.drawn = true;
  }, [shown]);
  const rise = useRise({ reduced: carried || undefined });
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion={carried ? 'none' : 'polite'}
      aria-live={carried ? 'off' : 'polite'}
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, bottom: 112, zIndex: 60, alignItems: 'center', paddingHorizontal: 16 }}
    >
      <Animated.View style={rise}>
        <Framed kind="frame" style={{ backgroundColor: COLORS['wine-700'], paddingHorizontal: 12, paddingVertical: 8 }}>
          <ReadText size={14} style={{ textAlign: 'center' }}>{shown.message}</ReadText>
        </Framed>
      </Animated.View>
    </View>
  );
}
