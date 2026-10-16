import { describe, expect, it } from 'vitest';
import { keyBytes, keysOf } from './notifications';

describe('the weekly notice, on the device', () => {
  it('reads a key written in URL-safe base64', () => {
    expect(Array.from(keyBytes('-_8'))).toEqual([251, 255]);
    expect(Array.from(keyBytes('AQID'))).toEqual([1, 2, 3]);
  });

  it('keeps only a subscription that has both its keys', () => {
    expect(keysOf({ toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } }) })).toEqual({ endpoint: 'https://push.example/1', p256dh: 'p', auth: 'a' });
    expect(keysOf({ toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'p' } }) })).toBeNull();
  });
});
