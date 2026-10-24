import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { KEPT_LAYER } from './keptLayer.web';

test('a box whose Next web animation keeps its last frame (`both`: the paper thrown onto the table) keeps its own layer on the web, as Chrome keeps the Next web\'s', () => {
  expect(KEPT_LAYER).toEqual({ willChange: 'transform' });
  const globals = readFileSync(join(__dirname, '../../../web/src/app/globals.css'), 'utf8');
  expect(globals).toContain('--animate-paper: paper 0.8s steps(12, end) both;');
  const news = readFileSync(join(__dirname, '../game/screens/News.tsx'), 'utf8');
  expect(news).toContain('<Animated.View style={[paper, KEPT_LAYER]}>');
});
