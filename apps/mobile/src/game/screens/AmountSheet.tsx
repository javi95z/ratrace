import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, Pressable, View } from 'react-native';
import { Framed } from '../../ui/Frame';
import { Button, useOnce, usePress } from '../../ui/kit';
import { KeyboardHint, onKeys, useKeyboardMode } from '../../ui/keyboard';
import { Sheet } from '../../ui/overlay';
import { Slider } from '../../ui/Slider';
import { PixelText, ReadText } from '../../ui/text';
import { COLORS, TOUCH } from '../../ui/theme';
import { useT, useWords } from '../context';

/** A step that gives the slider about two hundred stops, on a round number of dollars. */
export function sliderStep(max: number): number {
  const rough = max / 200;
  for (const step of [100, 500, 1_000, 5_000, 10_000, 50_000, 100_000, 500_000, 1_000_000, 5_000_000, 10_000_000]) {
    if (rough <= step) return step;
  }
  return 50_000_000;
}

interface Props {
  title: string;
  /** The most that can be chosen, in cents. */
  max: number;
  onClose(): void;
  /** Returns true if the amount was taken; the sheet then closes. */
  onConfirm(amount: number): boolean;
  /** Shown above the amount: what is being bought, at what price, and so on. */
  children?: ReactNode;
  /** The amount the sheet opens on, for something that already has one. Zero if absent. */
  start?: number;
  /** Shown under the button: another thing that can be done from here. */
  footer?: ReactNode;
  /** What the chosen amount comes to, under the slider, kept up to date as it moves. */
  preview?: (amount: number) => ReactNode;
}

/** A quarter, a half, all of it: the web's plain `frame-raised` buttons, which do not sink when pressed (no `active:` class). */
function Share({ pct, onPress }: { pct: number; onPress(): void }) {
  const press = usePress({ onPress });
  return (
    <Pressable accessibilityRole="button" onPress={press} style={{ flex: 1 }}>
      <Framed kind="raised" style={{ backgroundColor: COLORS['night-600'], minHeight: TOUCH, alignItems: 'center', justifyContent: 'center' }}>
        <PixelText size={15} tone="ink-200" style={{ textAlign: 'center' }}>{`${pct}%`}</PixelText>
      </Framed>
    </Pressable>
  );
}

/**
 * Picks an amount of money: a slider, chips for a quarter, a half and all of it, and one button. There is no field for an exact amount, as
 * on the web. The amount is read aloud through the slider's own value and its live region (the web's `<output aria-live>`; on iOS, a chip's
 * amount is said as it is pressed), and how much there is through the slider's hint.
 * It is mounted only while it is open, so it always starts from `start`, and gives its amount once each time it is opened. The keyboard's help and
 * shortcut are the web's, for a keyboard.
 */
export function AmountSheet({ title, max, onClose, onConfirm, children, start = 0, footer, preview }: Props) {
  const t = useT('finance.amount');
  const common = useT('common');
  const { fmt } = useWords();
  const [amount, setAmount] = useState(Math.min(start, Math.max(0, max)));
  const step = sliderStep(max);
  const setSafeAmount = (next: number) => setAmount(Math.max(0, Math.min(max, Number.isFinite(next) ? next : 0)));
  // One amount for one opening: a double tap on the button, both presses landing before the sheet has gone, gives it once (a refused one may be tried again).
  const once = useOnce();
  const submit = () => {
    if (amount > 0 && once(() => onConfirm(amount))) onClose();
  };
  const money = fmt.money(amount);
  // A chip sets the amount in one go: on iOS, which has no live region, it is said (the slider says its own value as it moves).
  const choose = (next: number) => {
    setAmount(next);
    if (Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(fmt.money(next));
  };
  const available = t('available', { amount: fmt.money(max) });
  // On the web, Ctrl/⌘ + Enter anywhere in the sheet gives the amount (never for a key held down); the slider's keys are said once a keyboard is in use.
  const keyboard = useKeyboardMode();
  const keys = onKeys((event) => {
    if (!(event.ctrlKey || event.metaKey) || event.key !== 'Enter' || event.repeat || amount <= 0) return false;
    submit();
    return true;
  });

  return (
    <Sheet open onClose={onClose} title={title} closeLabel={common('close')}>
      {children}
      {max <= 0 ? (
        <ReadText tone="ink-300" style={{ paddingVertical: 16, textAlign: 'center' }}>{t('nothing')}</ReadText>
      ) : (
        <View {...keys} style={{ gap: 12 }}>
          {/* The web's `<output aria-live="polite">`: TalkBack hears it change. VoiceOver has no live regions: a chip's amount is said as it is pressed. */}
          <View accessibilityLiveRegion="polite">
            <PixelText size={30} tone="gold-500" style={{ textAlign: 'center' }}>{money}</PixelText>
          </View>
          <Slider value={Math.min(amount, max)} min={0} max={max} step={step} onChange={setSafeAmount} label={t('amount')} valueText={money} hint={available} />
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {[25, 50, 100].map((pct) => (
              <Share key={pct} pct={pct} onPress={() => choose(Math.floor((max * pct) / 100))} />
            ))}
          </View>
          {preview && amount > 0 ? preview(amount) : null}
          <ReadText size={12} tone="ink-300" style={{ textAlign: 'center' }}>{available}</ReadText>
          {keyboard ? <ReadText size={12} tone="ink-300" style={{ textAlign: 'center' }}>{t('keyboardHelp')}</ReadText> : null}
          <Button variant="primary" wide disabled={amount <= 0} hint={<KeyboardHint>{'Ctrl/⌘ ↵'}</KeyboardHint>} onPress={submit}>
            {t('confirm', { amount: money })}
          </Button>
        </View>
      )}
      {footer}
    </Sheet>
  );
}
