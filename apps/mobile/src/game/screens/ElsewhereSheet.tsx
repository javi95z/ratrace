import { useState } from 'react';
import { View } from 'react-native';
import { Button, Notice } from '../../ui/kit';
import { Sheet } from '../../ui/overlay';
import { ReadText, SNUG } from '../../ui/text';
import { useGame, useT, useWords } from '../context';

/**
 * A player has one ranked life in progress: one on another device is never ended by starting here, it is asked about (the web's sheet, on each page
 * that begins a life: a new one, the week's attempt). It is taken up here (`onTake`), where its rules are this app's, or ended for the life asked for
 * (`onEnd`, with the id of the life it ends), or left as it is. `away` says the server did not answer the taking up; `starting`, that an answer is on
 * its way. A leaf of its own: the page is not drawn again as the question comes and goes. It keeps the life it asked about while it leaves.
 */
export function ElsewhereSheet({ starting, away, onTake, onEnd }: { starting: boolean; away: boolean; onTake(): void; onEnd(gameId: string): void }) {
  const t = useT('newLife');
  const common = useT('common');
  const { content, text } = useWords();
  const elsewhere = useGame((s) => s.elsewhere);
  const clearElsewhere = useGame((s) => s.clearElsewhere);
  const [held, setHeld] = useState(elsewhere);
  if (elsewhere !== null && elsewhere !== held) setHeld(elsewhere);
  const life = elsewhere ?? held;
  return (
    <Sheet open={elsewhere !== null} onClose={clearElsewhere} title={t('elsewhereTitle')} closeLabel={common('close')} back={false}>
      {life ? (
        <>
          <ReadText lineHeight={15 * SNUG} tone="ink-200">
            {t('elsewhereBody', { life: text.lives[life.lifeId]?.name ?? life.lifeId, round: Math.min(life.round + 1, content.rounds), total: content.rounds })}
          </ReadText>
          {life.here ? null : (
            <ReadText size={14} lineHeight={14 * SNUG} tone="ink-200" style={{ marginTop: 8 }}>
              {t('elsewhereOther')}
            </ReadText>
          )}
          {away ? (
            <Notice role="alert" size={13} style={{ marginTop: 12 }}>
              {t('elsewhereAway')}
            </Notice>
          ) : null}
          <View style={{ marginTop: 16, gap: 12 }}>
            {life.here ? (
              <Button variant="primary" wide disabled={starting} onPress={onTake}>
                {t('elsewhereTake')}
              </Button>
            ) : null}
            <Button variant="danger" wide disabled={starting} onPress={() => onEnd(life.gameId)}>
              {t('elsewhereEnd')}
            </Button>
            <Button variant="quiet" wide onPress={clearElsewhere}>
              {common('cancel')}
            </Button>
          </View>
        </>
      ) : null}
    </Sheet>
  );
}
