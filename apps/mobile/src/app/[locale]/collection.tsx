import { Collection } from '../../game/screens/Collection';
import { PageHead } from '../../game/pageHead';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

export default function CollectionRoute() {
  return (
    <InLanguage>
      <PageHead page="collection" />
      <Collection />
    </InLanguage>
  );
}
