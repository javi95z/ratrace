import { Legal } from '../../game/screens/Legal';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

export default function LegalRoute() {
  return (
    <InLanguage>
      <Legal />
    </InLanguage>
  );
}
