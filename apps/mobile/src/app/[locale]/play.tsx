import { Play } from '../../game/screens/Play';
import { PageHead } from '../../game/pageHead';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

export default function PlayRoute() {
  return (
    <InLanguage>
      <PageHead page="play" />
      <Play />
    </InLanguage>
  );
}
