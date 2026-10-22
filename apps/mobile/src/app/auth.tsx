import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * `theratrace://auth`, where Google sends the player back to. The browser opened for Google takes that address itself and hands it to the trip that
 * opened it (`online/browser.ts`), which alone exchanges its code, against its own flow. Android may also hand the address to the router: here it
 * only goes back to where the player was (or home, opened by it with nothing before), and nothing of the address is read or exchanged.
 */
export default function AuthRoute() {
  const router = useRouter();
  // Once: drawn again while it leaves (a new `router`), it must not go back a second time, from the screen under it.
  const gone = useRef(false);
  useEffect(() => {
    if (gone.current) return;
    gone.current = true;
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, [router]);
  return null;
}
