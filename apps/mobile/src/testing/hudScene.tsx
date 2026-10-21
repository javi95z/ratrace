import type { ReactNode } from 'react';
import { View } from 'react-native';
import { useGame } from '../game/context';
import { CrisisBar } from '../game/screens/Crisis';
import { Hud } from '../game/screens/Hud';
import type { HudOpen } from '../game/screens/Hud';
import { StickyScreen } from '../ui/Sticky';

/*
 * The Hud as Play will mount it (Task 9 ports Play itself): the part that scrolls away as the `StickyScreen`'s lead, the part that sticks as
 * its header, and under them, where the page scrolls, the strip of a crisis in the stages the Hud is compact in. Nothing of the stage itself:
 * a scene of the Hud (`hud-*`) compares the Hud alone, and the web's shot hides its page's stage (`WEB_ONLY` in scripts/sceneShots.ts).
 * The column has no room of its own on top, as the web's page has none (its Hud opens with the skyline's `mt-3`), and leaves the web's
 * `mt-2` between the portrait's row, the figures and the strip. `children` is what a scene shows of a stage under them (the page's 8 apart).
 */

/** Nothing happens on a press that only the real screen answers (the profile, on the portrait). */
const nothing = (): void => {};

/** What a scene of the Hud has open: a sheet of the Hud's own, or the whole of the crisis, from its strip. */
export type HudSceneOpen = HudOpen | 'crisis';

export function HudScene({ open, onProfile = nothing, children }: { open?: HudSceneOpen; onProfile?: () => void; children?: ReactNode }) {
  const hud = open === 'crisis' ? undefined : open;
  const playing = useGame((s) => s.status === 'playing' && s.view !== null);
  // As Play: the skyline opens and closes a round; in between, the room goes to the cards and the finances.
  const compact = useGame((s) => s.stage !== 'news' && s.stage !== 'resolve');
  if (!playing) return null;
  return (
    <StickyScreen
      contentStyle={{ paddingTop: 0, gap: 8 }}
      lead={<Hud part="lead" compact={compact} onProfile={onProfile} open={hud} />}
      header={<Hud part="header" compact={compact} open={hud} />}
    >
      {compact ? <HudCrisis open={open === 'crisis'} /> : null}
      {children}
    </StickyScreen>
  );
}

/** The strip of the crisis the round is lived in, if there is one, in its place. */
function HudCrisis({ open }: { open: boolean }) {
  const crisis = useGame((s) => (s.view ? (s.view.timeline[s.view.round]?.crisis ?? null) : null));
  // Its place is there with no crisis too, as Play keeps it (the web's empty `mt-2` box): what a scene draws under it stands where the stage would.
  return crisis ? <CrisisBar crisis={crisis} compact open={open} /> : <View />;
}
