import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { deleteAccount } from '../../../supabase/functions/_shared/deletion.ts';
import type { DeletionDeps } from '../../../supabase/functions/_shared/deletion.ts';
import { LIMITS } from '../../../supabase/functions/_shared/rate.ts';

const A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

/** The project as the function sees it, answering as told, and remembering what it was asked. */
function deps(over: Partial<DeletionDeps> = {}) {
  const asked: string[] = [];
  const all: DeletionDeps = {
    allow: async (user) => (asked.push(`count ${user}`), true),
    remove: async (user) => void asked.push(`remove ${user}`),
    ...over,
  };
  return { all, asked };
}

describe('deleting an account', () => {
  it('removes the player who asks, once they have said so in as many words, and says it is done', async () => {
    const { all, asked } = deps();
    expect(await deleteAccount(all, A, { confirm: true })).toEqual({ status: 200, body: { deleted: true } });
    expect(asked).toEqual([`count ${A}`, `remove ${A}`]);
  });

  it('removes nobody for a request that does not say so, whatever else it carries, and counts nothing for it', async () => {
    for (const body of [null, 'yes', [], {}, { confirm: 'true' }, { confirm: 1 }, { confirm: false }, { userId: A }]) {
      const { all, asked } = deps();
      expect(await deleteAccount(all, A, body), JSON.stringify(body)).toEqual({ status: 400, body: { error: 'bad-request', field: 'confirm' } });
      expect(asked).toEqual([]);
    }
  });

  it('removes whoever the token says is asking, never a player the body names', async () => {
    const { all, asked } = deps();
    await deleteAccount(all, A, { confirm: true, userId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });
    expect(asked).toEqual([`count ${A}`, `remove ${A}`]);
  });

  it('holds a player to a limit, and removes nothing past it', async () => {
    const { all, asked } = deps({ allow: async () => false });
    expect(await deleteAccount(all, A, { confirm: true })).toEqual({ status: 429, body: { error: 'too-many' } });
    expect(asked).toEqual([]);
    const [atMost, perSeconds] = LIMITS['delete-account'];
    // A few tries an hour: one that works is the last, and one that failed may be tried again soon after.
    expect(atMost).toBeGreaterThanOrEqual(3);
    expect(perSeconds).toBeLessThanOrEqual(3600);
  });

  it('fails, and says nothing is done, when the account cannot be removed: the function answers 500 and notes it', async () => {
    const { all } = deps({
      remove: async () => {
        throw new Error('the auth server is away');
      },
    });
    await expect(deleteAccount(all, A, { confirm: true })).rejects.toThrow('the auth server is away');
  });
});

describe('the function behind it', () => {
  const source = readFileSync(new URL('../../../supabase/functions/delete-account/index.ts', import.meta.url), 'utf8');

  it('is for a signed-in player, watched, and takes who is asking from the token', () => {
    expect(source).toMatch(/withSupabase\(\s*\{ auth: 'user' \}/);
    expect(source).toContain("watched(\n      'delete-account'");
    expect(source).toContain('ctx.userClaims?.id');
    expect(source).toContain("allowed(db, user, 'delete-account')");
    expect(source).toContain('auth.admin.deleteUser');
  });

  it('is named among the functions: in the project\'s file, and among those deployed', () => {
    expect(readFileSync(new URL('../../../supabase/config.toml', import.meta.url), 'utf8')).toMatch(/\[functions\.delete-account\]\nverify_jwt = true/);
    const deploy = (JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as { scripts: Record<string, string> }).scripts['online:deploy'];
    expect(deploy).toMatch(/for f in [^;]*\bdelete-account\b/);
  });
});
