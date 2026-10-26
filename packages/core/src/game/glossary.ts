/**
 * The words of the game a newcomer may not know, each explained in a sentence or two (`guide.terms.<term>` in the messages).
 * In the guide's tips a term is marked as a link is in Markdown, `[the words shown](term)`: the same in every language, and
 * nothing to the message format. The words shown are the language's own; the term names which explanation they open.
 */
export const TERMS = [
  'cash',
  'netWorth',
  'flow',
  'passive',
  'status',
  'focus',
  'savings',
  'index',
  'bond',
  'creditCard',
  'margin',
  'mortgage',
  'downPayment',
  'inflation',
] as const;

export type Term = (typeof TERMS)[number];

/** A piece of a marked text: plain words, or the words of a term. */
export interface Piece {
  text: string;
  term?: Term;
}

const MARK = /\[([^\]]+)\]\(([A-Za-z]+)\)/g;
const isTerm = (name: string): name is Term => (TERMS as readonly string[]).includes(name);

/** A text cut into its plain words and its marked terms. A mark of a term the glossary does not have reads as its words. */
export function marked(text: string): Piece[] {
  const pieces: Piece[] = [];
  const add = (piece: Piece) => {
    const last = pieces.at(-1);
    if (piece.term === undefined && last !== undefined && last.term === undefined) last.text += piece.text;
    else if (piece.text !== '') pieces.push(piece);
  };
  let from = 0;
  for (const match of text.matchAll(MARK)) {
    add({ text: text.slice(from, match.index) });
    add(isTerm(match[2]) ? { text: match[1], term: match[2] } : { text: match[1] });
    from = match.index + match[0].length;
  }
  add({ text: text.slice(from) });
  return pieces;
}

/** A marked text as it reads, with no marks. */
export const plain = (text: string): string => marked(text).map((piece) => piece.text).join('');

/** The terms a text marks, each once, in the order they first come. */
export const termsIn = (text: string): Term[] => [...new Set(marked(text).flatMap((piece) => (piece.term === undefined ? [] : [piece.term])))];
