import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

/**
 * An answer of the cloud a screen draws, asked each time the screen is shown: as it is first drawn, and again each time it comes back to the front (a
 * screen stays drawn under the ones pushed over it, where the web's page is drawn anew on every visit). `ask` is made once for what it asks (null
 * while there is nobody to ask: nothing is asked, and the last answer stays). An answer is drawn only when it is not `same` as the one drawn: asked
 * again and told the same, the screen is not drawn again. An answer that comes after the screen has gone from the front is dropped; it is asked again
 * when the screen is shown again.
 */
export function useAskedWhenShown<T>(ask: (() => Promise<T>) | null, initial: T, same: (found: T, drawn: T) => boolean = Object.is): T {
  const [answer, setAnswer] = useState(initial);
  const drawn = useRef(initial);
  useFocusEffect(
    useCallback(() => {
      if (ask === null) return;
      let live = true;
      ask().then(
        (found) => {
          if (!live || same(found, drawn.current)) return;
          drawn.current = found;
          setAnswer(found);
        },
        // An ask that fails says nothing: the answer drawn stays, and it is asked again when the screen is shown again.
        () => undefined,
      );
      return () => {
        live = false;
      };
    }, [ask, same]),
  );
  return answer;
}
