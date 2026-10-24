import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { onThisMachine, projectNamed } from './webLife';

test('the whole life runs offline: a page given a project is found, and only this machine is asked', () => {
  expect(projectNamed({ EXPO_PUBLIC_PROJECT_ROOT: '/apps/mobile' })).toBeNull();
  expect(projectNamed({ EXPO_PUBLIC_SUPABASE_URL: '', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: undefined })).toBeNull();
  expect(projectNamed({ EXPO_PUBLIC_SUPABASE_URL: 'https://abcdefghij.supabase.co' })).toBe('EXPO_PUBLIC_SUPABASE_URL');
  expect(projectNamed({ EXPO_PUBLIC_SUPABASE_URL: 'u', EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'k' })).toBe('EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  expect(onThisMachine('http://localhost:8091/scene')).toBe(true);
  expect(onThisMachine('http://127.0.0.1:8093/ready')).toBe(true);
  expect(onThisMachine('https://abcdefghij.supabase.co/auth/v1/token')).toBe(false);
  const script = readFileSync(new URL('./web-life.ts', import.meta.url), 'utf8');
  expect(script).toContain('const named = projectNamed(env);');
  expect(script).toContain("const fromAppWeb = asked.filter((line) => line.startsWith(`${APP_WEB_PORT}:`));");
});
