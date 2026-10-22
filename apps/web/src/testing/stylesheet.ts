import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { compile } from 'tailwindcss';

/** The game's stylesheet, as Tailwind reads it. */
const GLOBALS = join(__dirname, '../app/globals.css');

/**
 * The utilities the game's own stylesheet builds for these classes, as Tailwind writes them: each rule's class and its declarations, in the order
 * the stylesheet has them (they are all of one layer and one weight, so of two that set a property the later wins).
 */
export async function rulesOf(classes: string): Promise<Array<{ selector: string; declarations: Array<[string, string]> }>> {
  const require = createRequire(GLOBALS);
  const compiler = await compile(readFileSync(GLOBALS, 'utf8'), {
    base: '.',
    loadStylesheet: async (id: string) => {
      const path = require.resolve(id === 'tailwindcss' ? 'tailwindcss/index.css' : id);
      return { path, base: path, content: readFileSync(path, 'utf8') };
    },
  });
  const built = compiler.build(classes.split(/\s+/).filter(Boolean));
  const layer = built.slice(built.indexOf('@layer utilities {'));
  return [...layer.matchAll(/\n {2}(\.[^\n{]+)\{\n([^}]*)\n {2}\}/g)].map(([, selector, body]) => ({
    selector: selector.trim(),
    declarations: body
      .split(';\n')
      .map((declaration) => [declaration.slice(0, declaration.indexOf(':')).trim(), declaration.slice(declaration.indexOf(':') + 1).trim().replace(/;$/, '').replace(/\s+/g, ' ')] as [string, string])
      .filter(([name]) => name !== ''),
  }));
}

/**
 * The style the browser gives an element of these classes, as far as the game's own stylesheet says it: its utilities applied in the order the
 * stylesheet writes them, and a frame's own variables (its outline, edges, ring and glow) put in, each to what the element sets it to or to its
 * fallback. The colours of the palette are left as their names (`var(--color-gold-900)`).
 */
export async function styleOf(classes: string): Promise<Map<string, string>> {
  const style = new Map<string, string>();
  for (const rule of await rulesOf(classes)) for (const [name, value] of rule.declarations) style.set(name, value);
  const put = (value: string) => value.replace(/var\((--(?:frame|glow|hi|lo|ring)), ((?:[^()]|\([^()]*\))*)\)/g, (_, name: string, fallback: string) => style.get(name) ?? fallback);
  for (const [name, value] of style) style.set(name, put(value));
  return style;
}
