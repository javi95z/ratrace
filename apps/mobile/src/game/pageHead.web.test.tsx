// @vitest-environment jsdom
import { messagesFor } from '@ratrace/i18n';
import { LOCALES } from '@ratrace/i18n/locales';
import { cleanup, render } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { inFront, params } from '../testing/fakes';
import { PageHead } from './pageHead';
import { PAGES } from './pageList';
import { headTagsOf, type HeadTag, type MetaWords } from './pageMeta';
import { SITE_URL } from './site';

/*
 * The web export's page head: what a route tells the document, in the language of the page's address and from that language's own words, tag for
 * tag what `headTagsOf` lists. React moves the tags into the document's head; here that is jsdom's.
 */

afterEach(cleanup);
beforeEach(() => {
  params.locale = 'en';
});

/** The tags in the document's head, read back as `headTagsOf` lists them. */
function inTheHead(): HeadTag[] {
  return [...document.head.querySelectorAll('title, meta, link')].map((element) => {
    const attributes = Object.fromEntries([...element.attributes].map((one) => [one.name === 'hreflang' ? 'hrefLang' : one.name, one.value]));
    return element.tagName === 'TITLE' ? { tag: 'title', text: element.textContent ?? '' } : ({ tag: element.tagName.toLowerCase(), ...attributes } as HeadTag);
  });
}

describe('PageHead', () => {
  it.each(LOCALES)('puts in the head, in %s, the tags of the page of that address, with that language\'s words', (locale) => {
    params.locale = locale;
    for (const page of PAGES) {
      render(<PageHead page={page} />);
      expect(inTheHead(), `${locale} ${page}`).toEqual(headTagsOf(locale, page, messagesFor(locale).meta as MetaWords, SITE_URL));
      cleanup();
      expect(inTheHead(), 'a page that goes takes its tags with it').toEqual([]);
    }
  });

  it('writes the title of /es/rankings as the Next web does, and its canonical address', () => {
    params.locale = 'es';
    render(<PageHead page="rankings" />);
    expect(document.title).toBe('Rankings · The Rat Race');
    expect(inTheHead()).toContainEqual({ tag: 'link', rel: 'canonical', href: new URL('/es/rankings', SITE_URL).href });
    expect(inTheHead().filter((tag) => tag.tag === 'link' && tag.rel === 'alternate').map((tag) => (tag as { hrefLang: string }).hrefLang)).toEqual(['en', 'es', 'ru', 'x-default']);
  });

  it('says nothing while its page is not the one in front, as the stack keeps the pages a player came through', () => {
    inFront.is = false;
    render(<PageHead page="new" />);
    expect(inTheHead()).toEqual([]);
  });

  it('takes its tags away when its page stops being the one in front, and writes them again when it is', () => {
    const { rerender } = render(<PageHead page="new" />);
    expect(document.title).toBe('Choose a life · The Rat Race');
    inFront.is = false;
    rerender(<PageHead page="new" />);
    expect(inTheHead()).toEqual([]);
    inFront.is = true;
    rerender(<PageHead page="new" />);
    expect(document.title).toBe('Choose a life · The Rat Race');
    expect(inTheHead()).toHaveLength(headTagsOf('en', 'new', messagesFor('en').meta as MetaWords, SITE_URL).length);
  });

  it('says nothing at an address with no language of the game\'s: that page is the router\'s page of nothing', () => {
    params.locale = 'de';
    render(<PageHead page="play" />);
    expect(inTheHead()).toEqual([]);
  });

  it('is on every route, named as the route is: a page tells the document its own, not another\'s', () => {
    const routes = join(dirname(fileURLToPath(import.meta.url)), '../app/[locale]');
    const files = readdirSync(routes).filter((file) => file.endsWith('.tsx'));
    expect(files).toHaveLength(PAGES.length);
    for (const file of files) {
      const name = file.replace(/\.tsx$/, '');
      expect(readFileSync(join(routes, file), 'utf8'), file).toContain(`<PageHead page="${name === 'index' ? '' : name}" />`);
    }
  });
});
