import { useLocalSearchParams } from 'expo-router';
import { Room } from '../../game/screens/Room';
import { InLanguage } from '../../game/screens/InLanguage';

/** Each page once in each language of the game, for the web export. */
export { generateStaticParams } from '../../game/pages';

/**
 * The games with others, opened with a game's code by the invitation's link, the web's `/<locale>/room?code=K7Q2XM`, and on the phone by the app's own,
 * `theratrace://room?code=K7Q2XM`, which `+native-intent` makes that page in the phone's language. The invitation the app shares is the web's link,
 * which opens the web's game, even on a phone with the app.
 */
export default function RoomRoute() {
  const { code } = useLocalSearchParams<{ code?: string }>();
  return (
    <InLanguage>
      <Room code={typeof code === 'string' ? code : undefined} />
    </InLanguage>
  );
}
