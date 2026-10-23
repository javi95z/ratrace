// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { MESSAGES } from '@ratrace/i18n';
import { afterEach, expect, test } from 'vitest';
import { LEGAL_SECTION, useOwnT } from './ownWords.web';
import { WordsProvider } from './words';

afterEach(cleanup);

const en = MESSAGES.en;

function Said({ keys }: { keys: readonly string[] }) {
  const own = useOwnT();
  return (
    <>
      {keys.map((key) => (
        <p key={key}>{own(key)}</p>
      ))}
    </>
  );
}

test('on the web the app says what the Next web says of a browser, where the phone says its own words (`phone.*`): reload the page, this browser, another tab', () => {
  const page = render(
    <WordsProvider locale="en">
      <Said keys={['lostNewer', 'lostWaiting', 'movedGone', 'notSaved', 'moved']} />
    </WordsProvider>,
  );
  expect([...page.container.querySelectorAll('p')].map((p) => p.textContent)).toEqual([en.home.lostNewer, en.home.lostWaiting, en.home.movedGone, en.common.notSaved, en.play.moved]);
  for (const words of [en.phone.lostNewer, en.phone.notSaved, en.phone.moved]) expect(page.container.textContent).not.toContain(words);
});

test('a word of the phone\'s with no counterpart on the Next web is the phone\'s still (5b\'s to settle)', () => {
  const page = render(
    <WordsProvider locale="en">
      <Said keys={['shareFailed']} />
    </WordsProvider>,
  );
  expect(page.container.textContent).toBe(en.phone.shareFailed);
});

test('the legal notice on the web is the Next web\'s words, section for section', () => {
  expect(LEGAL_SECTION).toBe('legal');
  for (const key of Object.keys(en.phone.legal)) expect(Object.keys(en.legal), key).toContain(key);
});
