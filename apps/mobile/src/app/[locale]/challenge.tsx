import { WeeklyChallenge } from '../../game/screens/Challenge';
import { PageHead } from '../../game/pageHead';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

export default function ChallengeRoute() {
  return (
    <InLanguage>
      <PageHead page="challenge" />
      <WeeklyChallenge />
    </InLanguage>
  );
}
