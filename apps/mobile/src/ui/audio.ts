/*
 * The sound's library, as the cues ask for it (`sound.tsx`): on the phone, expo-audio itself, loaded with the app. The web fetches it once the page is
 * idle (`audio.web.ts`).
 */
export { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
