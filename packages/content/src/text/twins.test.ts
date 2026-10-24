import { expect, test } from 'vitest';
import * as everyLanguage from './index';
import * as loadedLanguages from './index.web';

/*
 * The app's web reads the content's text through `index.web.ts` (Metro picks it), over the languages loaded so far; the phone, the Next web and the
 * tools through `index.ts`. The package's index re-exports `./text` by name, so both must give every name it takes, and nothing more.
 */
test('the web twin of the text exports the same names as the text every other reader has', () => {
  expect(Object.keys(loadedLanguages).sort()).toEqual(Object.keys(everyLanguage).sort());
  expect(Object.keys(everyLanguage).sort()).toEqual(['fillNames', 'homeName', 'rawText', 'textFor']);
});
