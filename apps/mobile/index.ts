// The app's entry: the JavaScript is given what the game's packages lack (src/polyfills) before the router loads a
// single screen, whatever order the screens are evaluated in.
import './src/polyfills';
import 'expo-router/entry';
