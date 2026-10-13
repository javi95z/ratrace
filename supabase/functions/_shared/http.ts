/** A whole life is under a hundred kilobytes of choices. Anything much larger is not a game. */
export const MAX_BODY = 200_000;

export const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * Reads the body of a request as JSON. The size is checked from the header first, so a body that
 * announces itself as too large is refused unread, and again once read.
 * Returns the value, or the response that refuses it.
 */
export async function readJson(req: Request): Promise<{ value: unknown } | { refusal: Response }> {
  if (req.method !== 'POST') return { refusal: json(405, { error: 'method-not-allowed' }) };
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY) return { refusal: json(413, { error: 'too-large' }) };
  const text = await req.text();
  if (text.length > MAX_BODY) return { refusal: json(413, { error: 'too-large' }) };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { refusal: json(400, { error: 'bad-request', field: 'body' }) };
  }
}
