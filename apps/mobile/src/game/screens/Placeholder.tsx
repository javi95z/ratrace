import { useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Panel } from '../../ui/kit';
import { Screen } from '../../ui/Page';
import { useT } from '../words';

/** The web's pages after the front door, by their path (apps/web/src/i18n/metadata.ts), each titled by `meta.titles.<page>`. */
export const PAGES = ['new', 'play', 'challenge', 'collection', 'records', 'rankings', 'room', 'player', 'legal'] as const;
export type TitledPage = (typeof PAGES)[number];

/** True in a development build only (Metro's `__DEV__`). */
const developing = (): boolean => typeof __DEV__ !== 'undefined' && __DEV__;

/** Phase 1's front door: the game's name, and a way to every page. The development page too, while developing. */
export function Home() {
  const t = useT('meta');
  const router = useRouter();
  return (
    <Screen>
      <Panel title={t('title')}>
        <View style={{ gap: 8 }}>
          {PAGES.map((page) => (
            <Button key={page} variant={page === 'new' ? 'primary' : 'secondary'} wide onPress={() => router.push(`/${page}`)}>
              {t(`titles.${page}`)}
            </Button>
          ))}
          {developing() ? (
            <Button variant="quiet" wide onPress={() => router.push('/dev')}>
              dev
            </Button>
          ) : null}
        </View>
      </Panel>
    </Screen>
  );
}

/** A page still to be built: its title, in the web's words for it, and the way back. */
export function Placeholder({ page }: { page: TitledPage }) {
  const t = useT('meta');
  const common = useT('common');
  const router = useRouter();
  return (
    <Screen>
      <Panel title={t(`titles.${page}`)}>
        <Button variant="quiet" wide onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
          {common('back')}
        </Button>
      </Panel>
    </Screen>
  );
}
