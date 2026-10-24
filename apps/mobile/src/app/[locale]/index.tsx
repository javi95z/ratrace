import { Home } from '../../game/screens/Home';
import { PageHead } from '../../game/pageHead';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

export default function HomeRoute() {
  return (
    <InLanguage>
      <PageHead page="" />
      <Home />
    </InLanguage>
  );
}
