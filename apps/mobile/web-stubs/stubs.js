/**
 * The modules of the libraries the site never runs, each read on the web as a small stand-in of its own from this folder (`metro.config.js`), so the
 * web export does not carry them (`scripts/webSize.ts`: the budget, and `FORBIDDEN`, which holds each out of the bundle). The phone is built as
 * before. A module is named by the end of its resolved path, `/`-separated.
 * @type {readonly { label: string; file: RegExp; stub: string }[]}
 */
module.exports = [
  // Supabase's file storage, which supabase-js builds a client of with every client: the game keeps no file there.
  { label: '@supabase/storage-js', file: /\/@supabase\/storage-js\/dist\/index\.(mjs|cjs|js)$/, stub: 'storage-js.js' },
  // Its auth client's admin API (`auth.admin`), made with every client, which answers only to the project's secret key.
  { label: "@supabase/auth-js's admin API", file: /\/@supabase\/auth-js\/dist\/module\/GoTrueAdminApi\.js$/, stub: 'auth-admin.js' },
  // expo-audio's recorder and playlist: the game only plays its cues (src/ui/audio.web.ts).
  { label: "expo-audio's recorder and playlist", file: /\/expo-audio\/build\/Audio(Recorder|Playlist)\.web\.js$/, stub: 'audio-unused.js' },
  // Reanimated's check that react-native-worklets is of a version it supports, which it runs only in development (`__DEV__`), with semver.
  { label: "Reanimated's worklets version check", file: /\/react-native-reanimated\/scripts\/validate-worklets-version\.js$/, stub: 'validate-worklets-version.js' },
  // Reanimated's layout animations (`FadeIn`, `LinearTransition`…): the game gives no component `entering`, `exiting` or `layout`.
  {
    label: "Reanimated's layout animations",
    file: /\/react-native-reanimated\/lib\/module\/layoutReanimation\/(defaultAnimations|defaultTransitions)\/index\.js$/,
    stub: 'empty.js',
  },
  // And what plays them on a page, the keyframes of each and the stylesheet made of them, which its animated components ask for.
  {
    label: "Reanimated's layout animations on the web",
    file: /\/react-native-reanimated\/lib\/module\/layoutReanimation\/web\/(index|domUtils)\.js$/,
    stub: 'layout-animations-web.js',
  },
  // The gesture handler's buttons, pressables and touchables, old and new: the game drags with `GestureDetector` and `usePanGesture` (and its
  // `ScrollView`) and presses with react-native's own.
  {
    label: "the gesture handler's buttons, pressables and touchables",
    file: /\/react-native-gesture-handler\/lib\/module\/(components\/(touchables\/index|Pressable\/index|GestureButtons)|v3\/components\/(Pressable|Touchable\/Touchable|GestureButtons))\.js$/,
    stub: 'empty.js',
  },
];
