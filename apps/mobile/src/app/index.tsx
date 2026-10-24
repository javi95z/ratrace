import { Redirect, useLocalSearchParams } from 'expo-router';
import { useSettings } from '../game/context';
import { hrefOf } from '../game/pages';

/**
 * The bare address, `/`: the front door of the language the game is played in, the query it came with kept. On the phone that is the player's choice,
 * else the phone's own (the app's links are made pages of it before they get here: `+native-intent`); on the web the cookie's (NEXT_LOCALE), else the
 * browser's, else English, as the Next web's middleware leads `/`, which a site with that middleware answers before this page is ever drawn.
 */
export default function BareRoute() {
  const { locale } = useSettings();
  const query = useLocalSearchParams<Record<string, string>>();
  const kept = Object.fromEntries(Object.entries(query).filter((one): one is [string, string] => typeof one[1] === 'string'));
  return <Redirect href={hrefOf('', { locale, query: kept })} />;
}
