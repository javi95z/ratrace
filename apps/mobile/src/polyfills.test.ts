import { createHash } from 'node:crypto';
import { afterAll, describe, expect, it, vi } from 'vitest';

/*
 * The phone's JavaScript has no WebCrypto. The account's client hashes the proof of each trip to Google with `crypto.subtle.digest('SHA-256')`
 * (PKCE), and without it falls back to sending the proof itself. The polyfill gives it expo-crypto's digest, which answers as WebCrypto's does.
 */

/** expo-crypto, as the phone has it: its digest by the algorithm's WebCrypto name, into an ArrayBuffer. */
vi.mock('expo-crypto', () => ({
  getRandomValues: (array: Uint8Array) => array,
  randomUUID: () => '00000000-0000-4000-8000-000000000000',
  CryptoDigestAlgorithm: { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA384: 'SHA-384', SHA512: 'SHA-512', MD2: 'MD2', MD4: 'MD4', MD5: 'MD5' },
  digest: async (algorithm: string, data: ArrayBufferView | ArrayBuffer) => {
    const bytes = ArrayBuffer.isView(data) ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : new Uint8Array(data);
    const out = createHash(algorithm.replace('-', '').toLowerCase()).update(bytes).digest();
    return out.buffer.slice(out.byteOffset, out.byteOffset + out.byteLength);
  },
}));
vi.mock('expo-localization', () => ({ getCalendars: () => [{ timeZone: 'UTC' }] }));

// The phone's JavaScript, as the app starts: no WebCrypto at all. (Node's own would make the start's test below pass whatever the polyfill did.)
vi.stubGlobal('crypto', {});
afterAll(() => vi.unstubAllGlobals());

const { installCrypto } = await import('./polyfills');
const hex = (buffer: ArrayBuffer) => Buffer.from(buffer).toString('hex');

describe('WebCrypto\'s digest on the phone', () => {
  it('hashes SHA-256 as WebCrypto does, into an ArrayBuffer: the standard\'s vectors', async () => {
    const phone: { crypto?: Crypto } = {};
    installCrypto(phone);
    const subtle = phone.crypto!.subtle;
    const abc = await subtle.digest('SHA-256', new TextEncoder().encode('abc'));
    expect(abc).toBeInstanceOf(ArrayBuffer);
    expect(hex(abc)).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
    expect(hex(await subtle.digest({ name: 'SHA-256' }, new Uint8Array()))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    // A view on part of a larger buffer is hashed for its own bytes only.
    const larger = new TextEncoder().encode('xxabcxx');
    expect(hex(await subtle.digest('SHA-256', larger.subarray(2, 5)))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('refuses an algorithm it has not got, as WebCrypto does', async () => {
    const phone: { crypto?: Crypto } = {};
    installCrypto(phone);
    await expect(phone.crypto!.subtle.digest('SHA-3', new Uint8Array())).rejects.toThrow(/SHA-3/);
  });

  it('gives the random values and ids too, and leaves alone what the phone already has', () => {
    const phone: { crypto?: Crypto } = {};
    installCrypto(phone);
    expect(typeof phone.crypto!.getRandomValues).toBe('function');
    expect(phone.crypto!.randomUUID()).toBe('00000000-0000-4000-8000-000000000000');
    const own = { getRandomValues: () => null, randomUUID: () => 'own', subtle: { digest: () => 'own' } };
    const full = { crypto: own as unknown as Crypto };
    installCrypto(full);
    expect(full.crypto).toBe(own);
    expect(full.crypto.subtle).toBe(own.subtle);
  });

  it('is put in place when the app starts', async () => {
    expect(globalThis.crypto.randomUUID()).toBe('00000000-0000-4000-8000-000000000000');
    expect(hex(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('makes only the digests WebCrypto makes, though expo-crypto makes more', async () => {
    const phone: { crypto?: Crypto } = {};
    installCrypto(phone);
    for (const name of ['SHA-1', 'SHA-256', 'SHA-384', 'SHA-512']) await expect(phone.crypto!.subtle.digest(name, new Uint8Array())).resolves.toBeInstanceOf(ArrayBuffer);
    for (const name of ['MD5', 'MD4', 'MD2']) await expect(phone.crypto!.subtle.digest(name, new Uint8Array())).rejects.toThrow(name);
  });
});
