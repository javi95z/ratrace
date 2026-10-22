/** A whole life is under a hundred kilobytes of choices. Anything much larger is not a game. */
export const MAX_BODY = 200_000;

export const json = (status: number, body: unknown): Response => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

/**
 * The body of a request as text, read no further than `most` characters could take: null if it goes
 * on past that. A body sent in chunks says nothing of its size beforehand, so it is measured as it
 * comes, and the rest is never read.
 */
async function textUpTo(req: Request, most: number): Promise<string | null> {
  if (req.body === null) return '';
  // A character of the text (a unit of UTF-16) is at most three bytes of UTF-8.
  const limit = most * 3;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, at);
    at += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}

/**
 * Reads the body of a request as JSON. The size is checked from the header first, so a body that
 * announces itself as too large is refused unread; then as it is read, and again once read. A
 * function that takes only small bodies says how small.
 * Returns the value, or the response that refuses it.
 */
export async function readJson(req: Request, most: number = MAX_BODY): Promise<{ value: unknown } | { refusal: Response }> {
  if (req.method !== 'POST') return { refusal: json(405, { error: 'method-not-allowed' }) };
  if (Number(req.headers.get('content-length') ?? 0) > most) return { refusal: json(413, { error: 'too-large' }) };
  const text = await textUpTo(req, most);
  if (text === null || text.length > most) return { refusal: json(413, { error: 'too-large' }) };
  try {
    return { value: JSON.parse(text) };
  } catch {
    return { refusal: json(400, { error: 'bad-request', field: 'body' }) };
  }
}
