import { noteFunctionError } from './errors.ts';
import type { NoteDeps } from './errors.ts';
import { json } from './http.ts';

/**
 * A function's handler, watched: what it throws is answered 500, and every answer of 500 and above
 * is noted among the errors under the function's name, with the word it answered. Noting never
 * changes the answer, and an error that cannot be noted is only written to the function's logs.
 * The handler's context is the one the caller hands in, never the narrower one `depsOf` asks for.
 */
export function watched<C>(name: string, handler: (req: Request, ctx: C) => Promise<Response>, depsOf: (ctx: NoInfer<C>) => NoteDeps): (req: Request, ctx: C) => Promise<Response> {
  const note = async (ctx: C, error: unknown) => {
    try {
      await noteFunctionError(depsOf(ctx), name, error);
    } catch (failure) {
      console.error(`${name}: the error could not be noted:`, failure instanceof Error ? failure.message : failure);
    }
  };
  return async (req, ctx) => {
    let res: Response;
    try {
      res = await handler(req, ctx);
    } catch (error) {
      console.error(`${name} failed:`, error);
      await note(ctx, error);
      return json(500, { error: 'server' });
    }
    if (res.status >= 500) {
      const body = (await res.clone().json().catch(() => null)) as { error?: unknown } | null;
      const word = typeof body?.error === 'string' ? body.error : 'no word';
      await note(ctx, `answered ${res.status}: ${word}`);
    }
    return res;
  };
}
