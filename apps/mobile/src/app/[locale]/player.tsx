import { PlayerProfile } from '../../game/screens/PlayerProfile';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

export default function PlayerRoute() {
  return (
    <InLanguage>
      <PlayerProfile />
    </InLanguage>
  );
}
