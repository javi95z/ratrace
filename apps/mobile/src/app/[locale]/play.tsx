import { Play } from '../../game/screens/Play';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

export default function PlayRoute() {
  return (
    <InLanguage>
      <Play />
    </InLanguage>
  );
}
