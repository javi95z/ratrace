import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { FOCUS_ACTIONS } from '@ratrace/engine';
import { describe, expect, it } from 'vitest';
import { atLeast, knownOrders, ORDERS_SINCE, rulesKnow } from './rules';

const held = fileURLToPath(new URL('../../../../supabase/functions/_shared/game/', import.meta.url));
const bundles = readdirSync(held)
  .map((file) => /^v(\d+\.\d+\.\d+)-\d+\.\d+\.\d+\.js$/.exec(file))
  .filter((found): found is RegExpExecArray => found !== null)
  .map((found) => ({ engine: found[1], source: readFileSync(held + found[0], 'utf8') }));
const named = (key: string) => key.replace(/^focus:/, '');
const holds = (source: string, name: string) => source.includes(`"${name}"`) || source.includes(`'${name}'`);

describe('what the rules of each version know', () => {
  it('is what the rules bundles still played hold: an order is in a bundle from the version listed on', () => {
    expect(bundles.length).toBeGreaterThan(3);
    for (const { engine, source } of bundles) {
      for (const key of Object.keys(ORDERS_SINCE)) expect(holds(source, named(key)), `${key} in ${engine}`).toBe(rulesKnow(engine, key));
    }
  });

  it('lists every use of focus and every order the oldest rules still played do not know', () => {
    const oldest = [...bundles].sort((a, b) => (atLeast(a.engine, b.engine) ? 1 : -1))[0];
    const engineTypes = readFileSync(fileURLToPath(new URL('../../../../packages/engine/src/types.ts', import.meta.url)), 'utf8');
    const union = /export type Order =([\s\S]*?);\n/.exec(engineTypes)?.[1] ?? '';
    const types = [...union.matchAll(/type: '([a-zA-Z]+)'/g)].map((found) => found[1]);
    expect(types.length).toBeGreaterThan(10);
    const keys = [...types.filter((type) => type !== 'focus'), ...FOCUS_ACTIONS.map((action) => `focus:${action}`)];
    const unlisted = keys.filter((key) => !holds(oldest.source, named(key)) && ORDERS_SINCE[key] === undefined);
    expect(unlisted).toEqual([]);
  });

  it('leaves out of a round what older rules would refuse', () => {
    const orders = [{ type: 'focus', action: 'overtime' }, { type: 'focus', action: 'careerMove' }, { type: 'pensionOut' }, { type: 'setLifestyle' }] as const;
    expect(knownOrders('0.38.0', orders).map((order) => order.type + ('action' in order ? `:${order.action}` : ''))).toEqual(['focus:overtime', 'setLifestyle']);
    expect(knownOrders('0.40.0', orders)).toHaveLength(4);
  });
});
