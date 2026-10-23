// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { canShareFile, canShareLink, shareFile, shareLink, usePictureShare } from './sharing.web';

/*
 * The web export's twin of sharing.ts: the browser's own share sheet and downloads. jsdom has neither, so each test gives the navigator what the
 * browser it describes would have.
 */

const has = (what: Record<string, unknown>) => Object.assign(navigator, what);
const board = { text: null as string | null };
beforeEach(() => {
  board.text = null;
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn(async (text: string) => void (board.text = text)) }, configurable: true });
});
afterEach(() => {
  delete (navigator as { share?: unknown }).share;
  delete (navigator as { canShare?: unknown }).canShare;
  delete (navigator as { clipboard?: unknown }).clipboard;
  vi.useRealTimers();
  vi.restoreAllMocks();
});
const aborted = () => new DOMException('turned down', 'AbortError');

describe('a link to a game', () => {
  it('can be shared only where the browser has a share sheet, asked when it is needed', () => {
    expect(canShareLink()).toBe(false);
    has({ share: vi.fn() });
    expect(canShareLink()).toBe(true);
  });

  it('goes to the browser\'s share sheet with its title, its words and the link', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => undefined);
    has({ share });
    await expect(shareLink('Games', 'Join my game ABC', 'https://x.test/en/room?code=ABC')).resolves.toBe(true);
    expect(share).toHaveBeenCalledWith({ title: 'Games', text: 'Join my game ABC', url: 'https://x.test/en/room?code=ABC' });
    expect(board.text).toBeNull();
  });

  it('is not shared, and says so, where the player turns the sheet down; any other failure is for the screen to see', async () => {
    has({ share: vi.fn().mockRejectedValueOnce(aborted()).mockRejectedValueOnce(new Error('no sheet')) });
    await expect(shareLink('t', 'x', 'https://x.test')).resolves.toBe(false);
    await expect(shareLink('t', 'x', 'https://x.test')).rejects.toThrow('no sheet');
  });

  it('goes to the clipboard where the browser has no share sheet', async () => {
    await expect(shareLink('Games', 'Join my game ABC', 'https://x.test/en/room?code=ABC')).resolves.toBe(true);
    expect(board.text).toBe('https://x.test/en/room?code=ABC');
  });

  it('is not shared where there is neither a sheet nor a clipboard that takes it', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockRejectedValue(new Error('refused')) }, configurable: true });
    await expect(shareLink('t', 'x', 'https://x.test')).resolves.toBe(false);
  });
});

describe('a picture', () => {
  const file = () => new File(['png'], 'card.png', { type: 'image/png' });

  it('can be shared as a file only where the browser says it can share that file', () => {
    expect(canShareFile(file())).toBe(false);
    has({ share: vi.fn() });
    expect(canShareFile(file())).toBe(false);
    has({ canShare: () => false });
    expect(canShareFile(file())).toBe(false);
    has({ canShare: (data: ShareData) => (data.files?.length ?? 0) === 1 });
    expect(canShareFile(file())).toBe(true);
  });

  it('is handed to the share sheet as a file, with its title and words; a sheet turned down says no', async () => {
    const share = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(aborted());
    has({ share });
    const one = file();
    await expect(shareFile(one, 'Title', 'Words')).resolves.toBe(true);
    expect(share).toHaveBeenCalledWith({ files: [one], title: 'Title', text: 'Words' });
    await expect(shareFile(one, 'Title', 'Words')).resolves.toBe(false);
  });

  it('is the share sheet of the game\'s context: bytes made a file, handed over with the invitation, where the browser can share it', async () => {
    const share = vi.fn<(data: ShareData) => Promise<void>>(async () => undefined);
    has({ share, canShare: () => true });
    const sheet = usePictureShare();
    await expect(sheet.available()).resolves.toBe(true);
    await expect(sheet.send(Uint8Array.of(137, 80, 78, 71), 'card.png', 'Nurse', 'Come and play')).resolves.toBe(true);
    const data = share.mock.calls[0][0];
    expect([data.title, data.text, data.files?.[0].name, data.files?.[0].type, data.files?.[0].size]).toEqual(['Nurse', 'Come and play', 'card.png', 'image/png', 4]);
  });

  it('says there is no share sheet where the browser has none, and sends nothing where it cannot share the file', async () => {
    const sheet = usePictureShare();
    await expect(sheet.available()).resolves.toBe(false);
    await expect(sheet.send(Uint8Array.of(1), 'card.png', 'Nurse', 'Come and play')).resolves.toBe(false);
  });

  it('is saved as a file by a link to its object, clicked, and let go of a moment later so that the download is not lost', async () => {
    vi.useFakeTimers();
    const made: string[] = [];
    URL.createObjectURL = vi.fn(() => (made.push('blob:saved'), 'blob:saved'));
    URL.revokeObjectURL = vi.fn();
    const clicked: Array<[string | null, string | null]> = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push([this.getAttribute('href'), this.getAttribute('download')]);
    });
    await expect(usePictureShare().save(Uint8Array.of(1, 2), 'card.png')).resolves.toBe('saved');
    expect(clicked).toEqual([['blob:saved', 'card.png']]);
    expect(document.querySelector('a[download]')).toBeNull();
    // Not at once: Safari and Firefox begin the download after the click.
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
    vi.advanceTimersByTime(5000);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:saved');
    vi.useRealTimers();
  });
});
