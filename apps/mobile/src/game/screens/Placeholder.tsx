import { useRouter } from 'expo-router';
import { Button, Panel } from '../../ui/kit';
import { Screen } from '../../ui/Page';
import { useT } from '../words';

/** The web's pages after the front door, by their path (apps/web/src/i18n/metadata.ts), each titled by `meta.titles.<page>`. */
export const PAGES = ['new', 'play', 'challenge', 'collection', 'records', 'rankings', 'room', 'player', 'legal'] as const;
export type TitledPage = (typeof PAGES)[number];

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
