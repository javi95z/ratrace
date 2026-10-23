import { BackHandler } from 'react-native';

/**
 * Listens to the device's own Back (Android's button or gesture) while a screen is in front: `handler` answers whether it took it. Gives back what
 * stops listening. The web's twin (`hardwareBack.web.ts`) listens to nothing: a browser's Back is its history's.
 */
export function onHardwareBack(handler: () => boolean): () => void {
  const listening = BackHandler.addEventListener('hardwareBackPress', handler);
  return () => listening.remove();
}
