import type { ReactNode } from 'react';
import { View } from 'react-native';
import { ReadText } from '../../ui/text';
import { COLORS } from '../../ui/theme';
import { useT } from '../context';

/*
 * TEMPORARY, for development: what stands in Play where a part of it will be until the task that ports it. Plainly not the game (a dashed box, a
 * sign of works, the part's name in the game's words), and the round goes on through Play's bar as it will. All in this one file, so that each
 * task deletes its own stand-in here and draws its screen in Play where the stand-in was:
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

/** Task 18 brings the end of a life: until then its box, which Play draws above the two ways on from a life that is over. */
export function EndStandIn() {
  return <StandIn />;
}
