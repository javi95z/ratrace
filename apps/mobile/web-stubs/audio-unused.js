/*
 * The web's stand-in for expo-audio's recorder and playlist on a page (AudioRecorder.web.js, AudioPlaylist.web.js, read in their place by
 * metro.config.js): the game only plays its cues (`ui/audio.web.ts`: `createAudioPlayer`, `setAudioModeAsync`), never records nor plays a list.
 */
const unused = (name) =>
  class {
    constructor() {
      throw new Error(`expo-audio's ${name} is not part of the web build (apps/mobile/web-stubs/audio-unused.js)`);
    }
  };

export const AudioRecorderWeb = unused('recorder');
export const AudioPlaylistWeb = unused('playlist');
