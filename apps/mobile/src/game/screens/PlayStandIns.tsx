import type { AssetDef, GameView } from '@ratrace/engine';
import type { ReactNode } from 'react';
import { View } from 'react-native';
import { Sheet } from '../../ui/overlay';
import { ReadText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useT, useWords } from '../context';

/*
 * TEMPORARY, for development: what stands in Play where a part of it will be until the task that ports it. Plainly not the game (a dashed box, a
 * sign of works, the part's name in the game's words), and the round goes on through Play's bar as it will. All in this one file, so that each
 * task deletes its own stand-in here and draws its screen in Play where the stand-in was:
 * - the sheet that buys an asset (`BuySheet`, from the web's Finance.tsx), which a holding of the portfolio opens: Task 13;
 * - the city a card offers to move to (`CityPreview`, which the web's Finance.tsx exports and Cards.tsx opens): Task 14;
 * - the ledger (`StageStandIn` 'resolve'): Task 16;
 * - the end of a life (`EndStandIn`): Task 18.
 * `StandIn` goes with the last of them.
 */

/** The dashed box of a part not ported yet: a sign of works and its name, and whatever keeps the round going in the meantime. */
export function StandIn({ name, children }: { name?: string; children?: ReactNode }) {
  return (
    <View style={{ borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS['ink-500'], padding: 12, gap: 12 }}>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <ReadText size={13} tone="ink-300">{'🚧'}</ReadText>
        {name ? <ReadText size={13} tone="ink-300" style={{ flexShrink: 1 }}>{name}</ReadText> : null}
      </View>
      {children}
    </View>
  );
}

/** A stage a later task brings (Task 16: the ledger): its name, as the stage is called for someone who cannot see it. */
export function StageStandIn({ stage }: { stage: 'resolve' }) {
  const play = useT('play');
  return <StandIn name={play(`stages.${stage}`)} />;
}

/**
 * Task 14 brings the city a card offers to move to, beside the player's own (the web's `CityPreview`, from Finance.tsx: the same comparison as in
 * the finances, nothing to order): until then its sheet, named for the city, with the sign of works in it. `view` is the life it is weighed in.
 */
export function CityPreview({ cityId, onClose }: { cityId: string; view: GameView; onClose(): void }) {
  const common = useT('common');
  const { content, names } = useWords();
  const city = content.cities.find((x) => x.id === cityId);
  if (!city) return null;
  return (
    <Sheet open onClose={onClose} title={names.cities[city.id]} closeLabel={common('close')}>
      <StandIn name={names.cities[city.id]} />
    </Sheet>
  );
}

/** Task 18 brings the end of a life: until then its box, which Play draws above the two ways on from a life that is over. */
export function EndStandIn() {
  return <StandIn />;
}

/**
 * Task 13 brings the sheet that buys an asset, once or every round (the web's `BuySheet`, from Finance.tsx), which a holding of the portfolio opens to buy more
 * of it: until then that sheet, named as the web names it, with the sign of works in it, so that the holding is never a button that does nothing.
 */
export function BuySheet({ asset, onClose }: { asset: AssetDef; onClose(): void }) {
  const amount = useT('finance.amount');
  const common = useT('common');
  const { names } = useWords();
  const title = amount('buy', { name: names.assets[asset.id]?.name ?? asset.id });
  return (
    <Sheet open onClose={onClose} title={title} closeLabel={common('close')}>
      <StandIn name={title} />
    </Sheet>
  );
}
