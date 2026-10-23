/**
 * The web's twin of `hardwareBack.ts`: a browser has no Back of the device's, only its history's, which the router follows. react-native-web's
 * BackHandler answers nothing and says so in the console (an error each time a screen listens), so nothing is asked of it.
 */
export function onHardwareBack(handler: () => boolean): () => void {
  void handler;
  return () => undefined;
}
