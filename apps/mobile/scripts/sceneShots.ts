import { SCENES, screenOf } from '@ratrace/core/testing/scenes';
import type { Scene } from '@ratrace/core/testing/scenes';
import { MESSAGES } from '@ratrace/i18n';
import { TEXT_WITHIN_PT, textSummary, verdictOf } from './kitCompare';
import type { Result } from './kitCompare';

/*
 * What `scene-shots.ts` decides before it opens a browser or a simulator: which scenes, where each is shown on either
 * side, what files come of it, and what the report says of each. Apart, so it can be tested.
 */

/** The folder under `docs/superpowers/reports` that has the scenes' pictures and their numbers: scenes are phase 2's. */
export const SCENES_FOLDER = 'phase-2-parity';
/** The numbers of the scenes shot, in that folder: a line to each. */
export const SCENES_FILE = 'phase-2-parity.json';

/**
 * A scene of the Hud (`hud-*`) is drawn by the web's Play, which is the Hud's only page, and by the phone's Hud alone (Play is Task 9's): what
 * Play draws besides the Hud, the stage of the round (`main#round-stage`: the guide, the news, the finances) and the bar of its next step
 * (`#round-actions`), is taken out of the web's shot (`display: none`: nothing of it is drawn, and none of its text is measured, as hidden
 * text would be), so that the Hud is compared over the page's ground on both sides. Nothing of the Hud is under either, and nothing of it moves.
 */
export const HUD_ONLY = '#round-stage, #round-actions { display: none !important; }';

/**
 * The calendar of a turning round (`play-pageturn`) takes no pointer, so a tap goes through it; and the web's text check, which asks what is on top
 * along each line (`elementFromPoint` in `TEXT_BOXES`), went through it too, and measured a line of the paper under it with the calendar's ink
 * (4.33 pt). In that scene's shot the calendar itself, the child of the layer over the whole screen and not that layer, takes the pointer: a line
 * it covers in part is measured where it shows either side of it, and the lines round it are not covered by it.
 */
export const CALENDAR_COVERS = '[data-motion-only] > * { pointer-events: auto !important; }';

/**
 * The small cards of what a step earned (`celebrate-earned`) are the result of a card's own children, beside its title and the card answered (Cards.tsx,
 * Task 11): in that scene's shot everything of the stage but them is taken out, and the bar of the next step, so the page is the Hud and the cards under
 * it, 12 below its figures (the stage's `pt-3`) and 12 apart (the result's `gap-3`), as the phone draws them beside its Hud.
 */
export const CELEBRATIONS_ONLY = '#round-actions, #round-stage > :not(:has(> [role="status"])), #round-stage > * > :not([role="status"]) { display: none !important; }';

/**
 * The screens of the scenes drawn over the Hud alone (`HUD_ONLY`): the Hud's own, and two whose sheet is a part of Play's stage, compared over the Hud
 * alone (the sheet that moves cash to savings, Finance's, as recorded in Task 10 before Finance was on the phone; a legendary badge, a card's result's:
 * its scene compares the sheet, the result and the finances have scenes of their own), which both sides draw beside the Hud.
 */
export const SHEETS_OVER_THE_HUD: readonly string[] = ['hud', 'amount', 'celebrate'];

/**
 * What the web draws of a scene that the phone does not, hidden in the web's shot so that what is left can be compared: on the challenge page the
 * line that tells a guest to sign in (`challenge.needsAccount`), which the phone does not draw while it has no way to sign in. Each is a rule for
 * the web's page: the line is the only `p` of that frame on the page of a guest. (The link of the picture's sheet that saves its file was hidden in
 * `end-share` until the phone drew its own way to save the picture, to its photos.) And on the scenes of the Hud, and of a sheet drawn over it, everything of Play
 * but the Hud (`HUD_ONLY`); of the badges a step earned, everything of Play but the Hud and the cards (`CELEBRATIONS_ONLY`).
 * And one rule that hides nothing, for the text check alone: the calendar covers what it covers (`CALENDAR_COVERS`).
 */
export const WEB_ONLY: Readonly<Record<string, string>> = {
  'challenge-practice': 'main > p.frame.bg-night-700 { display: none !important; }',
  'play-pageturn': CALENDAR_COVERS,
  ...Object.fromEntries(SCENES.filter((scene) => SHEETS_OVER_THE_HUD.includes(screenOf(scene))).map((scene) => [scene.name, HUD_ONLY])),
  'celebrate-earned': CELEBRATIONS_ONLY,
};

/**
 * Every rule the web's page is given for a scene's shot: what it draws that the phone does not, and nothing else. (Its pages are as tall as the screen
 * under the notch by their own rule since the web's d67284b, `min-h-safe`, which the web's viewport.test holds: the shots' own height rule of Task 6,
 * `VISIBLE_HEIGHT`, which did the same, is gone.)
 */
export const webRules = (scene: Scene): string => WEB_ONLY[scene.name] ?? '';

/** The web's page for a scene, in the scene's language (the web's pages are all under their language). */
export const sceneWebUrl = (scene: Scene, port: number): string => `http://localhost:${port}/${scene.locale}/kit/scene?name=${scene.name}`;

/** The app's route for a scene, as Expo Go is opened on it. */
export const sceneAppRoute = (scene: Scene): string => `scene?name=${scene.name}`;

/** What a scene writes: the web's shot, the app's shot, and the picture of what is unlike in them. */
export const filesOf = (name: string): { web: string; app: string; diff: string } => ({ web: `${name}-web.png`, app: `${name}-app.png`, diff: `${name}-diff.png` });

/** The scenes named, in the order they are listed (not the order they were named in), or all of them. A name that is none stops the run. */
export function chooseScenes(only: readonly string[] | undefined): Scene[] {
  if (only === undefined) return [...SCENES];
  const unknown = only.filter((name) => !SCENES.some((scene) => scene.name === name));
  if (unknown.length > 0) throw new Error(`unknown scene: ${unknown.join(', ')}`);
  return SCENES.filter((scene) => only.includes(scene.name));
}

/*
 * Phase 1's stand-ins are gone: every screen a scene is drawn on is the real one on the app. Until Task 19 a screen the app still drew as a
 * stand-in (`STAND_INS`: the records and the collection were the last) and a stage of Play a later task brought (`STAND_IN_SCENES`: the ledger
 * was the last, in Task 16) were not compared, their numbers saying nothing; both lists were emptied and are retired. A scene is now unjudged only
 * while it waits for a batch pass to shoot it (`PENDING_SHOTS`).
 */

/**
 * The scenes of a screen that is ported and not shot yet. From Task 11 on, a screen's task registers its scenes and does not shoot them (the user's
 * call, 2026-10-21): the batch passes shoot every one of these, compare them and fix what differs, and take each out of this list as it is judged.
 * A scene here is unjudged, as a stand-in's was: no numbers, and nothing that could fail a run or pass for a result. Batch pass 1 shot and judged the
 * thirty-nine of Tasks 11 to 19 and the merge; batch pass 2 the twenty-seven the user's decisions after it changed on both sides (the badges' glow,
 * the balance's net worth after inflation, the buttons a screen sizes, the guide's ring, the picture's sheet with its way to save). After it, the age a
 * life left the rat race is told at the round it got out in everywhere (2026-10-22: the moment said 52 where the HUD said 50, and the end's life line
 * and tale 52 where its figures said 50), on both sides: the escape's moment and the three ends of that life waited to be shot again, and Task 20
 * (the phase's exit) shot and judged them. Phase 3's tasks registered twenty-eight more (the account, the rankings, the player's profile, the game
 * online beside the game alone, the games with others), and its batch pass (Task 14) shot and judged them. None waits.
 * A record a scene had (`ACCEPTED`) stays while it waits where the change does not touch its cause: the pass that shoots it confirms or tightens it.
 */
export const PENDING_SHOTS: ReadonlySet<string> = new Set<string>([]);

/**
 * The scenes with lines in the phone's own words (`phone.*` in the messages, where the web's words tell a phone player something false or impossible:
 * "reload the page"), and those lines, by the web's words for them (the text the comparison finds them by). The two shots cannot agree on such a
 * line, whatever the app does: it is reported (in the line's count) and not judged. Every other line of the scene is judged as any scene's is, and
 * its shape too, and the verdict says `phone words, ...`. (`balance-r6` was one while the web showed a key that was not in the messages,
 * `end.realNetWorth`, and the phone its own words: the key is back, and both say it.)
 */
const web = MESSAGES.en;
export const PHONE_WORDS: Readonly<Record<string, readonly string[]>> = {
  // The notice of a life saved by a newer version: the web says to reload the page, the phone to update the app.
  'home-lost-newer': [web.home.lostNewer],
  // The legal notice tells of an account, a database and cookies, and the app has none: from what it keeps on, every section is the phone's own,
  // and stands where the length of the phone's words above it puts it. The title, the first section (the same words on both) and the way back are
  // judged.
  legal: [web.legal.dataBody, web.legal.whyTitle, web.legal.whyBody, web.legal.whoTitle, web.legal.whoBody, web.legal.deviceTitle, web.legal.deviceBody, web.legal.rightsTitle, web.legal.rightsBody, web.legal.updated],
};

/** Whether a scene has lines in the phone's own words. */
export const hasPhoneWords = (name: string): boolean => name in PHONE_WORDS;

/**
 * Of those, the scenes whose page is other words from some line down (the legal notice: other sections, other paragraphs, other lengths), where every
 * box under them stands where the length of its text puts it. Their shapes are not a layout to judge, so they are held to where they stood (`PAGE_BASELINE`);
 * the lines in the web's words above them are judged; the layout of such a page is judged once, by drawing the phone's page with the web's own words (the
 * parity report says how it was done for `legal`).
 */
export const PHONE_PAGES: readonly string[] = ['legal'];

/**
 * What a scene's two shots are accepted to differ by, for a scene that does and whose residual is explained in the parity report (with its measured cause): a run
 * passes when the scene's numbers stay within the record, and fails on any growth (a pixel more, a hundredth of a point more, a line of text in one shot only). The
 * numbers are those of the last shoot; a residual that grows, or a new one, is a difference to look at, and one that is mended is a record to tighten.
 */
export interface Accepted {
  /** The most shape pixels (what differs and is not text) accepted. */
  shape: number;
  /**
   * The lines of text, by their words (the web's), that may stand further apart than the tolerance (`TEXT_WITHIN_PT`), each with the most it may, in
   * points. Every other line of the scene is held to the tolerance: a residual of one line lets no other drift.
   */
  lines?: Readonly<Record<string, number>>;
  /** The most lines of text found in one shot only. */
  oneSided: number;
  /** What the residual is. */
  reason: string;
  /** The heading (`## ...`) of the parity report that explains it, with its cause. */
  report: string;
}

export const ACCEPTED: Readonly<Record<string, Accepted>> = {
  'home-continue': {
    shape: 1,
    oneSided: 0,
    reason: 'One pixel at the edge of a glyph the text check\'s windows did not cover (the descender of the "y" of "your" in the continue button\'s title); nothing is out of place.',
    report: 'Task 6: the front door, its settings, the week\'s challenge and the legal notice',
  },
  'new-first': {
    shape: 738,
    lines: { '🎲 At random': 2 },
    oneSided: 0,
    reason: 'The dice emoji (Apple Color Emoji sits 2 pt lower on iOS than on macOS Chrome), the arrow of the folded list (macOS\'s system sign against iOS\'s), and whole CSS pixels against device pixels.',
    report: 'Task 7: choosing a new life',
  },
  'new-unlocked': {
    shape: 738,
    lines: { '🎲 At random': 2 },
    oneSided: 0,
    reason: 'The same as new-first: the dice emoji, the arrow of the folded list, and whole CSS pixels against device pixels.',
    report: 'Task 7: choosing a new life',
  },
  'new-locked': {
    shape: 738,
    lines: { '🎲 At random': 2 },
    oneSided: 0,
    reason: 'The same as new-first (the dice emoji, the arrow, whole CSS pixels against device pixels); the rows of the locked lives are clean since the frames\' far strips are laid from the near edge (batch pass 1).',
    report: 'Task 7: choosing a new life',
  },
  'play-news-r1': {
    shape: 1443,
    oneSided: 0,
    reason: 'The paper\'s masthead, centred, stands a device pixel left of the web\'s (a sub-pixel centring), and is not measured as text: the paper\'s rules of the same ink lie within its window, so its glyphs\' edges count as shape.',
    report: 'Task 9: play, round by round, from the news',
  },
  'play-news-r6': {
    shape: 1443,
    oneSided: 0,
    reason: 'The masthead as in play-news-r1 (the bar\'s label, two device pixels higher before, stands within the point since batch pass 1).',
    report: 'Task 9: play, round by round, from the news',
  },
  'play-guide-r1': {
    shape: 3453,
    // Four device pixels: the headline's two lines under the note (the web's text of each is the headline's first forty letters).
    lines: { 'New regulator created to regulate the re': 4 / 3 },
    oneSided: 0,
    reason: 'The masthead as in play-news-r1, and everything under the guide\'s note two device pixels lower: the web paints the note\'s foot at a whole CSS pixel (564.48 to 564), the phone at a device pixel (564.67).',
    report: 'Task 9: play, round by round, from the news',
  },
  'play-pageturn': {
    shape: 3897,
    oneSided: 0,
    reason: 'The torn page, turned, has antialiased edges the other shot draws hard (phase 2\'s exception), all along them now that the lines of the paper it covers are measured only where they show (CALENDAR_COVERS), and the masthead as in play-news-r1.',
    report: 'Task 9: play, round by round, from the news',
  },
  'new-replace': {
    shape: 310,
    oneSided: 0,
    reason: 'The dice emoji under the backdrop (a covered line, not measured as text: its edges count as shape), and whole CSS pixels against device pixels.',
    report: 'Task 7: choosing a new life',
  },
  'play-cards-legendary': {
    shape: 1,
    oneSided: 0,
    reason: 'One pixel of the edge of the band of light over the card\'s picture, held at the same moment on both sides: the motion section\'s own residual (motion-2: one pixel of the glint band\'s edge).',
    report: 'Batch pass 1: every scene shot, compared and judged',
  },
  'finance-buy-stock': {
    shape: 149,
    oneSided: 0,
    reason: 'The price line, antialiased on both sides (phase 2\'s exception: the web\'s svg path and Skia\'s, the same points), its edge pixels in other shares of its teal.',
    report: 'Batch pass 1: every scene shot, compared and judged',
  },
  'finance-taxes': {
    shape: 31,
    oneSided: 0,
    reason: 'The tops of the letters of a line the bar of the next step covers (covered at its middle, so not measured as text) peek over the bar\'s edge a device pixel apart.',
    report: 'Batch pass 1: every scene shot, compared and judged',
  },
  'finance-business': {
    shape: 35,
    oneSided: 0,
    reason: 'The tops of the letters of a line under the bar of the next step, as in finance-taxes.',
    report: 'Batch pass 1: every scene shot, compared and judged',
  },
  'profile-r6': {
    shape: 30,
    oneSided: 0,
    reason: 'The career bar\'s lit lamps bleed a device-pixel sliver of their light into the first dark lamp on the web (phase 1\'s class: a Bar\'s lamp bleeding a sliver).',
    report: 'Batch pass 1: every scene shot, compared and judged',
  },
  'end-bankrupt': {
    shape: 5,
    oneSided: 0,
    reason: 'Five pixels of a gold edge on the last row of the screen compared (839.67 pt), where the web\'s is antialiased at a fractional place and the phone\'s on a device pixel.',
    report: 'Batch pass 1: every scene shot, compared and judged',
  },
  'end-share': {
    // 5084 and 5085 in batch pass 1's runs and again in batch pass 2's (four runs): the web's own picture is not the same from one shot to the next
    // (677 of its pixels changed between two shots of the same page), and the count moved with it by one pixel. The record is the most measured,
    // 5085, and a margin of 5: five times that measured spread.
    shape: 5085 + 5,
    oneSided: 0,
    reason: 'The picture to share is a picture, its words no text to the comparison: drawn from the same layout by Skia on the phone and by the canvas on the web, its glyphs\' edges differ (Skia sets them without kerning) and the 1080-wide card is smoothed into its 270 points by each its own way, the web\'s a little differently each time it is drawn.',
    report: 'Batch pass 1: every scene shot, compared and judged',
  },
  'end-ru': {
    shape: 168,
    oneSided: 0,
    reason: 'The confetti either side of the prized badge, centred in a panel whose Russian lines make it a fraction taller: centred on another device pixel, their pieces at the panel\'s foot are cut a pixel apart.',
    report: 'Batch pass 1: every scene shot, compared and judged',
  },
  'home-account-taken': {
    shape: 1,
    oneSided: 0,
    reason: 'One pixel at the edge of a glyph the text check\'s windows did not cover, as in home-continue (the same front door, its continue button\'s title); nothing is out of place.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'home-member': {
    shape: 5,
    oneSided: 0,
    reason: 'The pixel of home-continue\'s, and four of the member\'s rat at the foot of the page, its picture a device pixel off the web\'s: the rat stands at a fraction of a point, which the browser rounds one way and the phone another.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'rankings-friends': {
    shape: 28,
    oneSided: 0,
    reason: 'The rats of the friends\' panel, each a picture at a fraction of a point, a device pixel apart: their edges count as shape (a picture is not text).',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'rankings-nickname': {
    shape: 317,
    oneSided: 0,
    reason: 'The name typed in the field (`Rata_Uno`) a device pixel lower on the phone: a field\'s value is no text to the web\'s text check (an input\'s value is not a text node), so its glyphs\' edges count as shape, as in the kit\'s forms (within a point, where a line of text would be clean).',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'player-member': {
    shape: 34,
    lines: { '✎': 5 / 3 },
    oneSided: 0,
    reason: 'The career bar\'s lit lamps bleed a device-pixel sliver of light into the first dark lamp on the web (profile-r6\'s, phase 1\'s class); and the pencil of the name, U+270E, which Chrome on macOS draws from Lucida Grande and iOS, which has no Lucida Grande, from Zapf Dingbats: another pencil, lying flatter.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'player-editor-body': {
    shape: 1015,
    lines: { '🎲 At random': 5 / 3 },
    oneSided: 0,
    reason: 'The grid of choices about a device pixel off on the phone, each rat in it with it; its cause not found. Probed in Task 14 part B: the grid lifted by ⅓ pt under the part\'s name (6 - 0.3, as if the web rounded 14.3 + 6) made every editor scene worse (1048, 1549 and 693 px, the dice a further ⅓ pt off): inconclusive, the direction unexplained (a lift of a device pixel should have cancelled a grid a device pixel low). Left as it was, for the user to accept or not at the phase\'s end. And the dice emoji of \'At random\', Apple Color Emoji lower on iOS than on macOS Chrome (new-first\'s).',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'player-editor-wear': {
    shape: 1384,
    oneSided: 0,
    reason: 'The grids of choices about a device pixel off on the phone, each piece of clothing in them with them, as in player-editor-body (its cause not found; for the user at the phase\'s end). Shot again in Task 14c over the grid drawn without layers: the same 1384.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'player-editor-scene': {
    shape: 670,
    lines: { '🎲 At random': 5 / 3 },
    oneSided: 0,
    reason: 'The grid of backdrops about a device pixel off on the phone, as in player-editor-body (its cause not found; for the user at the phase\'s end), and the dice emoji of \'At random\' (new-first\'s).',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'player-friend-code': {
    shape: 569,
    lines: { '✎': 5 / 3 },
    oneSided: 0,
    reason: 'The toast over the tabs (covered there, so its words are not measured as text), measured on the shots: its words\' ink at the same x on both and a device pixel higher on the phone; its box 104 pt wide on the web and 103⅓ on the phone, a device pixel in from each side. "Code copied" is 79.17 pt of Chakra at 14 (the font\'s own advances) and 12 of padding each side. Chrome lays the box out unrounded, 103.17 wide (getBoundingClientRect, Task 14c: 79.171875 + 24), centred at 149.41 pt, between device pixels: the 104 of the shot is its painting of those edges, not its layout. The phone lays it at device pixels (103⅓). Then the bar\'s lamp sliver and the pencil of player-member\'s.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'challenge-attempt': {
    shape: 0,
    lines: { 'See the challenge ranking': 4 / 3 },
    oneSided: 0,
    reason: 'The way to the challenge\'s ranking: the web\'s `underline` skips the descenders of its words (Chrome\'s `text-decoration-skip-ink`), the phone\'s line runs whole under them, so the line\'s ink stands further apart than its glyphs (a third of a point).',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'challenge-played': {
    shape: 0,
    lines: { 'See the challenge ranking': 4 / 3 },
    oneSided: 0,
    reason: 'The way to the challenge\'s ranking, underlined whole on the phone and round the descenders on the web, as in challenge-attempt.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'end-standing': {
    shape: 168,
    oneSided: 0,
    reason: 'The rare badge\'s confetti either side of its line at the foot of the screen, cut a device pixel apart: where the score\'s standing puts that line, it falls at a fraction of a point (end-ru\'s class).',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'new-ranked': {
    shape: 738,
    lines: { '🎲 At random': 2 },
    oneSided: 0,
    reason: 'The dice emoji, the arrow of the folded list and whole CSS pixels against device pixels, as in new-first.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'room-door': {
    shape: 26,
    oneSided: 0,
    reason: 'The six dots of the empty code\'s placeholder at a fraction of a point, a device pixel apart: a placeholder is no text to the web\'s text check.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'room-lobby-friends': {
    shape: 25,
    oneSided: 0,
    reason: 'The rats of the seats, pictures at a fraction of a point, a device pixel apart.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'room-lobby-public': {
    shape: 7,
    oneSided: 0,
    reason: 'The rats of the seats, pictures at a fraction of a point, a device pixel apart.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'room-playing': {
    shape: 1551,
    oneSided: 0,
    reason: 'Everything under the guide\'s note a device pixel lower (play-guide-r1\'s: the web paints the note\'s foot at a whole CSS pixel, the phone at a device pixel), and the paper\'s masthead (play-news-r1\'s).',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'room-loans': {
    shape: 20,
    oneSided: 0,
    reason: 'The rats of the room\'s bar, each 128-pixel picture drawn into its small box nearest-neighbour by the browser and by Skia, which keep a few other rows and columns of it.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'room-resolved': {
    shape: 2,
    oneSided: 0,
    reason: 'Two pixels of a rat of the room\'s bar, drawn small nearest-neighbour by each its own way, as in room-loans.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'room-end': {
    shape: 22,
    oneSided: 0,
    reason: 'The rats of the room\'s order, pictures at a fraction of a point, a device pixel apart.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
  'room-history': {
    shape: 17,
    oneSided: 0,
    reason: 'The rats of the game\'s players in its sheet, pictures at a fraction of a point, a device pixel apart.',
    report: 'Phase 3 batch pass: the online scenes shot, compared and judged',
  },
};

/**
 * A page of the phone's own words from top to bottom (`PHONE_PAGES`) has no shape that says anything of its layout, but it does not move: where it stood when its
 * words were last written is the baseline, and a shape that is more than `drift` (a share of it) away from it, either way, fails the run. A change of the words is
 * a new baseline, written here by whoever changes them (the parity report says how the layout was judged).
 */
export interface PageBaseline {
  shape: number;
  drift: number;
  reason: string;
  report: string;
}

export const PAGE_BASELINE: Readonly<Record<string, PageBaseline>> = {
  legal: {
    shape: 39721,
    drift: 0.1,
    reason: 'The phone\'s notice has other sections and other lengths than the web\'s, so every box under the first heading stands where its own text puts it: the shape is that of the text.',
    report: 'Task 6: the front door, its settings, the week\'s challenge and the legal notice',
  },
};

/** Whether a scene is compared: every screen is the real one on the app, so every scene is, once a batch pass has shot it. */
export const isJudged = (scene: Scene): boolean => !PENDING_SHOTS.has(scene.name);

/** What the report keeps of a scene: its verdict, and for a scene that is judged how much of the two shots differs and how far apart the text stands. */
export type Line =
  | { scene: string; locale: string; verdict: 'unjudged'; why: string }
  | {
      scene: string;
      locale: string;
      /** A scene with lines in the phone's own words (`PHONE_WORDS`) is judged without them, and says so. */
      verdict: 'clean' | 'differs' | 'accepted' | 'phone words, layout clean' | 'phone words, layout accepted' | 'phone words, layout differs' | 'phone words, not comparable' | 'phone words, drifted';
      rawPercent: number;
      beyondPercent: number;
      loose: number;
      shape: number;
      shapeBlended: number;
      textLines: number;
      unmeasured: number;
      /** Lines of text found in one shot and not the other: text the app does not draw, or draws elsewhere altogether. Of the lines judged. */
      oneSided: number;
      /** The most any line's ink stands apart in the two shots, of those found in both and judged. */
      worstPt: number;
      /** The lines in the phone's own words, reported and not judged (`PHONE_WORDS`). */
      phoneLines?: number;
      /** Each line judged that stands further apart than the tolerance, by its words (the first forty letters, as the text check has them), and how far. */
      far?: Array<{ text: string; pt: number }>;
      /** The app's screen never stood still while it was shot (`stillShot`): what was compared is one moment of something moving, and the run fails for it. */
      moving?: true;
    };

const round = (value: number, places: number) => Math.round(value * 10 ** places) / 10 ** places;

/** A scene that is not compared, and why: no numbers. The only one is a scene still to be shot. */
export const unjudgedLine = (scene: Scene): Line => ({
  scene: scene.name,
  locale: scene.locale,
  verdict: 'unjudged',
  why: 'ported and not shot yet: a batch pass shoots it and judges it',
});

/** How the text check names a line: its first forty letters (`TEXT_BOXES` in shotDrivers.ts). A line named in a record or in `PHONE_WORDS` is found by those. */
export const lineName = (words: string): string => words.trim().slice(0, 40);

/** A result without its lines in the phone's own words: what is judged of it. */
function judgedOf(scene: Scene, result: Result): Result {
  const own = (PHONE_WORDS[scene.name] ?? []).map(lineName);
  return own.length === 0 ? result : { ...result, texts: result.texts.filter((text) => !own.includes(text.text)) };
}

/** Whether a result's text is within what is accepted of it: no more lines in one shot only than the record allows, and every line within the tolerance or the bound its record names it by. */
function textWithin(result: Result, record: Accepted | undefined): boolean {
  const bound = (text: string) => Object.entries(record?.lines ?? {}).find(([name]) => lineName(name) === text)?.[1] ?? TEXT_WITHIN_PT;
  const measured = result.texts.filter((text) => !text.unmeasured);
  return textSummary(result).oneSided <= (record?.oneSided ?? 0) && measured.every((text) => !Number.isFinite(text.apart) || text.apart <= bound(text.text));
}

/**
 * What a scene with lines in the phone's own words comes to, those lines left out: its layout and its other lines, or, where the page is other words from
 * some line down, its other lines and where it stands against its baseline. A shape the phone's words make themselves (longer than the web's, past the
 * web's line, where no window of the text check reaches) is a residual like any other: accepted by its record (`ACCEPTED`), and failing on any growth.
 */
function phoneVerdict(scene: Scene, judged: Result): 'phone words, layout clean' | 'phone words, layout accepted' | 'phone words, layout differs' | 'phone words, not comparable' | 'phone words, drifted' {
  const record = ACCEPTED[scene.name];
  if (PHONE_PAGES.includes(scene.name)) {
    const base = PAGE_BASELINE[scene.name];
    if (base !== undefined && Math.abs(judged.shape - base.shape) > base.shape * base.drift) return 'phone words, drifted';
    return textWithin(judged, record) ? 'phone words, not comparable' : 'phone words, layout differs';
  }
  if (verdictOf(judged) === 'clean') return 'phone words, layout clean';
  return record !== undefined && judged.shape <= record.shape && textWithin(judged, record) ? 'phone words, layout accepted' : 'phone words, layout differs';
}

/** Whether a scene that differs differs by no more than its record says. */
function withinRecord(scene: Scene, result: Result): boolean {
  const record = ACCEPTED[scene.name];
  return record !== undefined && result.shape <= record.shape && textWithin(result, record);
}

/** A compared scene's line. A shot of the wrong page is stopped before this (`wrongPage`); if one gets here it is not kept. `moving`: the app's shot never stood still. */
export function lineOf(scene: Scene, result: Result, moving = false): Line {
  const judged = judgedOf(scene, result);
  const plain = verdictOf(judged);
  if (plain === 'wrong page') throw new Error(`${scene.name}: a wrong page is not a result to keep`);
  const verdict = hasPhoneWords(scene.name) ? phoneVerdict(scene, judged) : plain === 'differs' && withinRecord(scene, judged) ? 'accepted' : plain;
  const text = textSummary(judged);
  const far = judged.texts.filter((line) => !line.unmeasured && Number.isFinite(line.apart) && line.apart > TEXT_WITHIN_PT).map((line) => ({ text: line.text, pt: round(line.apart, 2) }));
  const phoneLines = result.texts.length - judged.texts.length;
  return {
    scene: scene.name,
    locale: scene.locale,
    verdict,
    rawPercent: round(result.rawPercent, 2),
    beyondPercent: round(result.beyondPercent, 3),
    loose: result.loose,
    shape: result.shape,
    shapeBlended: result.shapeBlended ?? 0,
    textLines: result.texts.length,
    unmeasured: text.unmeasured,
    oneSided: text.oneSided,
    worstPt: round(text.worstPt, 2),
    ...(phoneLines > 0 ? { phoneLines } : {}),
    ...(far.length > 0 ? { far } : {}),
    ...(moving ? { moving: true as const } : {}),
  };
}

/**
 * The lines that fail a run: a scene that differs (beyond what is accepted of it), or whose layout does, or a page of other words that has drifted from its baseline,
 * or whose app shot never stood still, whatever it came to. A clean one, one accepted, one in the phone's own words, a page that cannot be compared and one not shot yet do not.
 */
export const differing = (lines: readonly Line[]): Line[] =>
  lines.filter((line) => line.verdict === 'differs' || line.verdict === 'phone words, layout differs' || line.verdict === 'phone words, drifted' || (line.verdict !== 'unjudged' && line.moving === true));

/** The scenes whose app shot never stood still, kept beside the raw shots from the app's step to the comparison (which may be run apart). */
export const MOVING_FILE = 'scenes-moving.json';

/** The scenes left moving after an app step: those of the scenes not shot this time as they were, and of those shot now the ones that never stood still. */
export const movingAfter = (kept: readonly string[], shot: readonly string[], moving: readonly string[]): string[] => [...kept.filter((name) => !shot.includes(name)), ...moving];

/** The lines of the report after a run: those kept of scenes not shot this time, and the new ones, in the order the scenes are listed. */
export function mergeLines(kept: readonly Line[], now: readonly Line[]): Line[] {
  const order = (line: Line) => SCENES.findIndex((scene) => scene.name === line.scene);
  return [...kept.filter((line) => !now.some((fresh) => fresh.scene === line.scene)), ...now].sort((a, b) => order(a) - order(b));
}

/** The report as a file: a list with a line to each scene. */
export const jsonOf = (lines: readonly Line[]): string => `[\n${lines.map((line) => `  ${JSON.stringify(line)}`).join(',\n')}\n]\n`;
