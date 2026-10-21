import { readFileSync } from 'node:fs';
import { SCENES } from '@ratrace/core/testing/scenes';
import { expect, test } from 'vitest';
import { STAND_INS } from './sceneShots';

// The scenes of the app and the web's are compared shot for shot: the same scenes, each drawn on the screen its name starts with.
// (Here, not beside the route: every file under src/app is a route to expo-router, a test too.)
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const app = read('../src/testing/scene.tsx');
const web = read('../../web/src/app/[locale]/kit/scene/page.tsx');
const route = read('../src/app/scene.tsx');
const core = read('../../../packages/core/src/session/fixed.ts');

/** The screens a registry lists, in its order: each `name: (…) =>` of the object the registry is, up to its closing `};`. */
const entriesOf = (source: string, registry: string): Array<{ screen: string; body: string }> => {
  const open = source.indexOf('= {', source.indexOf(`const ${registry}`));
  const block = source.slice(open, source.indexOf('\n};', open));
  return [...block.matchAll(/^\s+(\w+): \(\w*\) => (.*),$/gm)].map((m) => ({ screen: m[1], body: m[2] }));
};
const screensOf = (source: string, registry: string): string[] => entriesOf(source, registry).map((entry) => entry.screen);

test('the app and the web draw a scene on the same screens, in the same order: the web\'s pages the phone has not ported yet are stand-ins', () => {
  const inApp = screensOf(app, 'SCENE_SCREENS');
  expect(inApp).toEqual(['home', 'new', 'play', 'finance', 'hud', 'amount', 'celebrate', 'records', 'collection', 'challenge', 'legal', 'work', 'profile', 'balance', 'rivals', 'end', 'moment']);
  expect(screensOf(web, 'SCREENS')).toEqual(inApp);
});

test('every scene is drawn on a screen both sides have: the first word of its name', () => {
  const screens = screensOf(web, 'SCREENS');
  for (const { name } of SCENES) expect(screens, name).toContain(name.split('-')[0]);
  expect(app).toContain('screenOf(');
  expect(web).toContain('screenOf(');
});

test('a registry\'s screen is given the scene, on both sides, so that a scene\'s sheet can be the screen\'s to open', () => {
  const type = 'Readonly<Record<string, (scene: Scene) => ReactNode>>';
  expect(app).toContain(`type SceneScreens = ${type}`);
  expect(web).toContain(`SCREENS: ${type} = {`);
  expect(app).toContain('screens[screenOf(scene)]?.(scene)');
  expect(web).toContain('SCREENS[screenOf(scene)](scene)');
});

test('a scene for a narrower phone is drawn in a box that wide, in the middle of the screen, on both sides (the simulator cannot be made narrower)', () => {
  expect(app).toContain('<OfWidth width={scene.width}>{screens[screenOf(scene)]?.(scene)}</OfWidth>');
  expect(app).toContain("return <View style={{ flex: 1, width, alignSelf: 'center' }}>{children}</View>;");
  expect(web).toContain('{over ? <OfWidth width={scene.width}>{SCREENS[screenOf(scene)](scene)}</OfWidth> : null}');
  expect(web).toContain("return <div style={{ width, marginInline: 'auto' }}>{children}</div>;");
});

test('a scene of the play screen is Play itself on both sides, with the calendar of a round just turned drawn beside it where the scene has one: held by the web\'s shot, and by the phone\'s prop', () => {
  // A city a card offers (`play-cards-city`): its sheet, the one the card's link opens, drawn beside Play on both sides.
  const play = "play: (scene) => (scene.sheet === 'city' ? <><PlayScene scene={scene} /><CardCity /></> : <PlayScene scene={scene} />),";
  expect(web).toContain(play);
  expect(app).toContain(play);
  const city = 'const city = card?.options.find((option) => option.effects?.moveCity !== undefined)?.effects?.moveCity;\n  return city ? <CityPreview cityId={city} view={view} onClose={nothing} /> : null;';
  expect(web).toContain(city);
  expect(app).toContain(city);
  // The sheet the card's link opens is the one the web's Finance exports, as the phone's does.
  expect(read('../../web/src/game/screens/Cards.tsx')).toContain("{seeing === 'city' && city ? <CityPreview cityId={city} view={view} onClose={() => setSeeing(null)} /> : null}");
  expect(read('../src/game/screens/Cards.tsx')).toContain("{seeing === 'city' && city ? <CityPreview cityId={city} view={view} onClose={() => setSeeing(null)} /> : null}");
  expect(web).toContain('{turn ? <PageTurn from={turn.from} to={turn.to} onDone={nothing} /> : null}');
  expect(app).toContain('{turn ? <PageTurn from={turn.from} to={turn.to} onDone={nothing} held={PAGE_TURN_HELD_MS} /> : null}');
  // The web's calendar is held by a rule of the scene's page, in it before the calendar is drawn: its two animations paused that far into their run.
  expect(web).toContain('const HOLD_TURN = `.animate-page, .animate-tear { animation-play-state: paused !important; animation-delay: -${PAGE_TURN_HELD_MS}ms !important; }`;');
  expect(web).toContain('{turn ? <style>{HOLD_TURN}</style> : null}');
  // The two are the web's calendar's own pages.
  const turning = read('../../web/src/game/screens/PageTurn.tsx');
  expect(turning).toContain('className="relative h-44 w-36 animate-page"');
  expect(turning).toContain('className="origin-top-left animate-tear"');
  // The game of a scene that cannot go on is given its basket on both sides.
  expect(web).toContain('sceneServices(store, scene.name)');
  expect(app).toContain('const basket = sceneBasket(scene.name);');
});

test('the Hud has open, in a scene, the sheet the scene names: the web\'s page presses the Hud\'s own button for it, the phone\'s Hud is given it as its initial state', () => {
  expect(web).toContain("hud: (scene) => <Pressed selector={HUD_SHEETS[scene.sheet ?? '']}><Play /></Pressed>,");
  expect(app).toContain('hud: (scene) => <HudScene open={hudOpenOf(scene)} />,');
  // Every sheet a scene of the Hud names is one the web's page can press and the phone's Hud can open.
  const sheets = SCENES.filter((scene) => scene.name.startsWith('hud-') && scene.sheet !== undefined).map((scene) => scene.sheet as string);
  expect(sheets.length).toBeGreaterThan(0);
  for (const sheet of sheets) {
    expect(web, sheet).toMatch(new RegExp(`\\b${sheet}: 'header `));
    expect(app, sheet).toMatch(new RegExp(`'${sheet}'`));
  }
  // The buttons pressed are the web Hud's own: the cash marked as where coins land, the figures of its grid, the one block button, the prison's tag.
  const hud = read('../../web/src/game/screens/Hud.tsx');
  expect(hud).toContain('<div data-hud-cash className="contents">');
  expect(hud).toContain('<div className="grid grid-cols-3 gap-1.5">');
  expect([...hud.matchAll(/className="block min-h-11/g)]).toHaveLength(1);
  expect([...hud.matchAll(/className="mt-1 inline-flex"/g)]).toHaveLength(1);
  // The strip of a crisis, under the figures of the compact Hud, is the crisis's own bar.
  expect(hud).toContain('<CrisisBar crisis={shown.timeline[shown.round]?.crisis ?? null} compact />');
  expect(read('../../web/src/game/screens/Crisis.tsx')).toContain('frame-raised frame-wine flex w-full');
});

test('a scene that goes on once the game is open is drawn after its steps, on both sides: the core\'s one function, a screen first drawn at the stage the scene ends on', () => {
  for (const [where, source] of Object.entries({ app, web })) {
    expect(source, where).toContain('runScene(scene.name, { getState:');
    expect(source, where).toMatch(/\{over( !== null)? \? /);
  }
});

test('the life of a scene is begun with the same ids, seeds and clock wherever it is made: the core\'s, the web\'s tests\' and the phone\'s', () => {
  const deps = "{ newId: () => `id-${(ids += 1)}`, newSeed: () => `screen-seed-${ids}`, now: () => (clock += 1) }";
  for (const [where, source] of Object.entries({
    core,
    'the web\'s memoryServices': read('../../web/src/testing/render.tsx'),
    'the phone\'s memoryServices': read('../src/testing/memoryServices.ts'),
  })) {
    expect(source, where).toContain(deps);
    expect(source, where).toContain('let clock = 1_000;');
  }
});

// What is around the page (the layout's own GameProvider, which opens the browser's database and, with the project's address in the
// environment, asks the cloud who is playing) is not the page's. The shots keep the browser from the project themselves: shotDrivers.test.ts.
test('the web\'s scene page names no client of the project and no store of the device, and gives its game its services in memory', () => {
  expect(web).not.toMatch(/supabase|@\/online|indexedDB|localStorage|@ratrace\/online/i);
  expect(web).toContain('sceneServices(store, scene.name)');
  expect(web).toMatch(/<GameProvider services=\{services\}>/);
});

test('the app\'s route is for development only, and everything it wires is behind testing/scene.tsx', () => {
  expect(route).toMatch(/if \(!__DEV__\) return <Redirect href="\/" \/>;/);
  expect([...route.matchAll(/from '([^']+)'/g)].map((m) => m[1])).toEqual(['expo-router', '../testing/scene']);
});

test('the screens the shots do not compare are the ones the app still draws as phase 1\'s stand-ins: a screen\'s task takes its word out of both', () => {
  const standIns = (/import \{([^}]*)\} from '\.\.\/game\/screens\/Placeholder'/.exec(app)?.[1] ?? '').split(',').map((name) => name.trim()).filter(Boolean);
  expect(standIns.length).toBeGreaterThan(0);
  const drawnAsOne = entriesOf(app, 'SCENE_SCREENS').filter((entry) => standIns.some((name) => new RegExp(`<${name}\\b`).test(entry.body)));
  expect(drawnAsOne.map((entry) => entry.screen)).toEqual([...STAND_INS]);
});

// The legal page is a server component, which the scene page (a client one) cannot draw: the scene has a copy of its body, held to it here.
test('the web\'s legal scene draws the legal page\'s own sections and layout, line for line', () => {
  const page = read('../../web/src/app/[locale]/legal/page.tsx');
  const scene = read('../../web/src/app/[locale]/kit/scene/Legal.tsx');
  const body = (source: string) => source.slice(source.indexOf('const sections = ['));
  expect(body(page).length).toBeGreaterThan(900);
  expect(body(scene)).toBe(body(page));
  // The same two constants, from the same file.
  for (const source of [page, scene]) expect(source).toContain("import { LEGAL_EMAIL, LEGAL_NAME } from '@/lib/site';");
});

test('the front door\'s settings are open in the web\'s scene by the page, not by the shot: a scene names the sheet, and the app draws the same sheet beside the door', () => {
  expect(web).toContain("document.querySelector<HTMLElement>('button[aria-label=\"Settings\"]')?.click()");
  expect(app).toContain("scene.sheet === 'settings' ? <><Home /><HomeSettingsSheet open onClose={nothing} /></> : <Home />");
});

test('the page where a life is chosen has open, in a scene, what the scene says: the web\'s page presses the button that opens it, the phone\'s screen is given it as its initial state', () => {
  // The web: the list of the lives still locked is opened by the button that folds it (the only one with an `aria-expanded` on that page), and the
  // question of ending a life by the button that starts one (in the bar that stands at the foot).
  expect(web).toContain("'new-locked': 'main button[aria-expanded]'");
  // Pressed once, not once for each run of an effect: a second press would shut the list the first opened.
  expect(web).toContain('if (selector === undefined || pressed.current) return;');
  expect(web).toContain("'new-replace': 'main div.fixed button'");
  expect(web).toContain('<Pressed selector={PRESSED[scene.name]}><NewLife /></Pressed>');
  const page = read('../../web/src/game/screens/NewLife.tsx');
  expect([...page.matchAll(/aria-expanded=/g)]).toHaveLength(1);
  expect(page).toMatch(/<div className="pb-safe fixed inset-x-0 bottom-0[^"]*">/);
  expect(page.slice(page.indexOf('pb-safe fixed'), page.indexOf('<Sheet'))).toContain('<Button');
  // The phone: the scene's sheet and its name say what the screen opens.
  expect(app).toContain("scene.sheet === 'replace' ? 'replace' : scene.name === 'new-locked' ? 'locked' : undefined");
  expect(app).toContain('new: (scene) => <NewLife opened={openedOf(scene)} />,');
  // And both are scenes there are, and the one with a sheet names it.
  const names = SCENES.map((scene) => scene.name);
  expect(names).toEqual(expect.arrayContaining(['new-locked', 'new-replace']));
  expect(SCENES.find((scene) => scene.name === 'new-replace')?.sheet).toBe('replace');
});

test('a sheet that a screen not ported yet opens is drawn beside the Hud on both sides, the page under it the Hud alone: an amount moved to savings, a legendary badge', () => {
  // The web: Play itself, all of it but the Hud hidden by the shot (HUD_ONLY in sceneShots.ts), the sheet of savings beside it (Finance's own, not exported, opens the
  // web's AmountSheet with these words and the cash shown), and the legendary badge in its own place, the stage of a card's result, whose sheet is drawn over the page.
  expect(web).toContain('amount: () => <SavingsScene />,');
  expect(web).toContain("celebrate: (scene) => (scene.name === 'celebrate-earned' ? <Pressed selector={TAKEN_IN}><Play /></Pressed> : <Play />),");
  expect(web).toContain("<AmountSheet title={amount('save')} max={cash} onClose={nothing} onConfirm={refused} />");
  const finance = read('../../web/src/game/screens/Finance.tsx');
  expect(finance).toContain("if (move.kind === 'save') return <AmountSheet title={amount('save')} max={p.cash} onClose={close} onConfirm={(a) => addOrder({ type: 'depositIn', amount: a })} />;");
  expect(read('../../web/src/game/screens/Cards.tsx')).toMatch(/<h2 className="pixel text-center text-\[20px\] text-gold-500">\{t\('results'\)\}<\/h2>\n\s+<Celebrations \/>/);
  // The phone: the Hud as Play mounts it, and the same sheet beside it; the badge's stage mounted where it draws nothing in the page.
  expect(app).toContain('amount: () => <><HudScene /><SavingsSheet /></>,');
  expect(app).toContain("<AmountSheet title={amount('save')} max={cash} onClose={nothing} onConfirm={refused} />");
  expect(app).toContain("celebrate: (scene) => (scene.name === 'celebrate-earned' ? <HudScene><EarnedStage /></HudScene> : <><HudScene /><HiddenStage><Celebrations /></HiddenStage></>),");
});

test('the small cards of a step are drawn with its legendary sheet taken in: the web\'s page presses its own button to move on, the phone\'s Celebrations is told it was seen', () => {
  // The web: the one button of the legendary sheet, which it marks with the badge (`data-legendary`), pressed once in the page, not by the shot.
  expect(web).toContain("const TAKEN_IN = '[data-legendary] button';");
  const celebrations = read('../../web/src/game/screens/Celebrations.tsx');
  expect(celebrations).toContain('<div data-legendary={grand} className="relative flex flex-col items-center gap-3 text-center">');
  const sheet = celebrations.slice(celebrations.indexOf('<div data-legendary'), celebrations.indexOf('</Sheet>'));
  expect([...sheet.matchAll(/<Button /g)]).toHaveLength(1);
  // The phone: its initial state, and the cards where the web's result of a card has them: 12 under the Hud's figures, 12 apart.
  expect(app).toContain('<Celebrations seen={LEGENDARY} />');
  expect(app).toContain('<View style={{ paddingTop: 4, gap: 12 }}>');
});

test('a scene of the play screen holds the shine of a rare card still, at the core\'s moments, on both sides: the web\'s page by a rule of its stylesheet, the phone\'s by the card\'s own context', () => {
  // The web: the three animations of its card, paused that far into their runs, in the page with Play (the sparks at their end: gone).
  expect(web).toContain('const HOLD_SHINE = [');
  for (const [kind, held] of [['holo', 'holo'], ['glint', 'glint'], ['spark', 'spark']]) {
    expect(web).toContain(`\`article .animate-${kind} { animation-play-state: paused !important; animation-delay: -\${SHINE_HELD_MS.${held}}ms !important; }\``);
  }
  expect(web).toContain('<style>{HOLD_SHINE}</style>');
  // They are the web card's own, in its article (the sparks are the kit's, thrown from it).
  const cards = read('../../web/src/game/screens/Cards.tsx');
  expect(cards).toContain('<motion.article');
  expect(cards).toMatch(/className="pointer-events-none absolute inset-0 animate-holo /);
  expect(cards).toMatch(/className="pointer-events-none absolute inset-y-0 left-0 w-1\/5 animate-glint /);
  expect(read('../../web/src/ui/Sparks.tsx')).toContain('className={`absolute animate-spark ');
  // The phone: the same moments, as shares of the runs the kit plays them over, given to Play's card.
  expect(app).toContain('const HELD_SHINE = { holo: SHINE_HELD_MS.holo / KEYFRAMES.holo.ms, glint: SHINE_HELD_MS.glint / KEYFRAMES.glint.ms, spark: SHINE_HELD_MS.spark / KEYFRAMES.spark.ms };');
  expect(app).toContain('<HeldShine value={HELD_SHINE}>');
});

test('a scene\'s screen on the phone takes no touch: a picture to be shot, which nothing pressed may move on', () => {
  expect(app).toContain("return <View style={{ flex: 1, pointerEvents: 'none' }}>{children}</View>;");
  expect(app).toMatch(/<Untouched>\s*<OfWidth width=\{scene\.width\}>/);
});

test('a scene of the finances is Play at its finances on both sides, on the tab and with the sheet it names: the basket drawn beside it on both, the rest pressed by the web\'s page and given to the phone\'s Finance as its initial state', () => {
  // The basket: the web's Finance exports it, as the phone's does, and both draw it beside Play.
  expect(web).toContain("finance: (scene) => (scene.sheet === 'basket' ? <><PlayScene scene={scene} /><Basket onClose={nothing} /></> : <PressedInTurn selectors={financePresses(scene)}><PlayScene scene={scene} /></PressedInTurn>),");
  expect(app).toContain("finance: (scene) => (scene.sheet === 'basket' ? <><PlayScene scene={scene} /><Basket onClose={nothing} /></> : <FinanceOpened value={{ tab: scene.tab, sheet: scene.sheet }}><PlayScene scene={scene} /></FinanceOpened>),");
  const finance = read('../../web/src/game/screens/Finance.tsx');
  expect(finance).toContain('export function Basket({ onClose }: { onClose(): void }) {');
  // The web's page presses the tab first (each of the web's tabs is marked with its id), then what opens the sheet, each once it is there and once only.
  expect(web).toContain('const financePresses = (scene: Scene): string[] => [...(scene.tab === undefined ? [] : [`main [data-tab="${scene.tab}"]`]), ...(scene.sheet === undefined || FINANCE_SHEETS[scene.sheet] === undefined ? [] : [FINANCE_SHEETS[scene.sheet]])];');
  expect(web).toContain('if (selectors.length === 0 || pressed.current) return;');
  expect(read('../../web/src/ui/overlay.tsx')).toContain('data-tab={tab.id}');
  // The pension: the first item of the finances that opens a sheet, which is the pension plan's line (the plans' lines come after it).
  expect(web).toContain(`pension: 'main [data-finance-item][aria-haspopup="dialog"]'`);
  const portfolio = finance.slice(finance.indexOf('function Portfolio()'), finance.indexOf('function PensionSheet('));
  const opening = [...portfolio.matchAll(/data-finance-item aria-haspopup="dialog" onClick=\{(.*?)\} className/g)].map((m) => m[1]);
  expect(opening[0]).toBe("() => setMove({ kind: 'pension' })");
  // Nothing before the portfolio's own panels opens a sheet: the glance draws none.
  expect(read('../../web/src/game/screens/Glance.tsx')).not.toContain('aria-haspopup');
  // Apple's sheet: the market's row of Apple, the one item of the market that draws Apple's mark, which opens the sheet that buys it.
  expect(web).toContain(`'buy-apple': 'main [role="tabpanel"] [data-finance-item]:has(img[src*="/logo.apple."])'`);
  const market = finance.slice(finance.indexOf('function Market()'), finance.indexOf('function BuySheet('));
  expect(market).toContain('onClick={() => setBuying(asset)}');
  expect(market).toContain('<AssetMark asset={asset} />');
  // Every sheet a scene of the finances names is one of these, and every tab one of the web's.
  const sheets = SCENES.filter((scene) => scene.name.startsWith('finance-') && scene.sheet !== undefined).map((scene) => scene.sheet);
  expect(sheets).toEqual(['basket', 'pension', 'buy-apple', 'move', 'item-watch_omega']);
  // The sheet of every city: the way of life's one button that draws the sign of a move.
  expect(web).toContain(`move: 'main [role="tabpanel"] button:has(img[src*="/icon.move."])'`);
  const lifestyle = finance.slice(finance.indexOf('function Lifestyle()'), finance.indexOf('// Shop'));
  expect([...lifestyle.matchAll(/<Sprite id="icon\.move"/g)]).toHaveLength(1);
  expect(lifestyle).toContain('<Button wide onClick={() => setMoving(true)}>');
  // A thing's sheet: its tile on the shop's shelf, the one that draws its picture, which opens its sheet; the phone's shop opens it from `item-<id>`.
  expect(web).toContain(`'item-watch_omega': 'main [role="tabpanel"] [data-finance-item]:has(img[src*="/item.watch_omega."])'`);
  const shop = finance.slice(finance.indexOf('function Shop('), finance.indexOf('// Taxes'));
  expect(shop).toContain('data-finance-item onClick={() => setOpen(item)}');
  expect(shop).toContain('<Sprite id={itemArt(item.id)} fallback={{ w: 64, h: 64 }} />');
  expect(read('../src/game/screens/Finance.tsx')).toContain("opened.sheet?.startsWith('item-') ? opened.sheet.slice('item-'.length) : null");
  const tabs = SCENES.filter((scene) => scene.tab !== undefined).map((scene) => scene.tab as string);
  for (const tab of tabs) expect(finance, tab).toContain(`{tab === '${tab}' ? `);
});

test('the work panel of the profile is drawn on a page of its own on both sides, given the life as it stands', () => {
  expect(web).toContain('work: () => <WorkScene />,');
  expect(app).toContain('work: () => <WorkScene />,');
  expect(web).toContain('<WorkPanel shown={shown} />');
  expect(app).toContain('return <WorkPanel shown={useShown()} />;');
  // In the column of the game's pages, 16 above and below as the phone's page leaves.
  expect(web).toContain('<main className="mx-auto min-h-safe w-full max-w-md px-3 pb-4 pt-4">');
  expect(app).toContain('return <Screen>{playing ? <ShownWork /> : null}</Screen>;');
});

test('the profile is open, in a scene, as the portrait opens it: the web\'s page presses the portrait and then what the scene names, the phone\'s draws the profile beside Play with it open', () => {
  expect(web).toContain('profile: (scene) => <ProfileScene scene={scene} />,');
  expect(web).toContain('balance: (scene) => <ProfileScene scene={scene} line={scene.sheet} />,');
  expect(app).toContain('profile: (scene) => <ProfileScene scene={scene} opened={{ item: scene.sheet }} />,');
  expect(app).toContain('balance: (scene) => <ProfileScene scene={scene} opened={{ line: scene.sheet as BalanceLine | undefined }} />,');
  // What the web's page presses is the web's own: the portrait by its name, a thing owned by its title, a line of the balance by its popup.
  expect(web).toContain("button[aria-label=\"${hud('openProfile')}\"]");
  const hud = read('../../web/src/game/screens/Hud.tsx');
  expect(hud).toContain("aria-label={t('openProfile')}");
  const profile = read('../../web/src/game/screens/Profile.tsx');
  expect(profile).toContain('title={names.items[owned.itemId]}');
  expect(profile).toContain("onClick={() => setLine('netWorth')}");
  // A thing a scene opens is one the scene's life owns; a line, one the balance sheet has.
  const sheets = SCENES.filter((scene) => scene.name.startsWith('profile-') || scene.name.startsWith('balance-')).map((scene) => scene.sheet);
  expect(sheets).toEqual([undefined, 'watch_casio', 'netWorth']);
  // The rivals' board is drawn alone in a page's column on both sides.
  expect(web).toContain('<main className="mx-auto flex w-full max-w-md flex-col px-3 pt-4">');
  expect(app).toContain('rivals: () => <RivalsScene />,');
  expect(web).toContain('rivals: () => <RivalsScene />,');
});

test('the end of a life is Play at its last stage on both sides, with the picture to share open where the scene names it: pressed by the web\'s page, given to the phone\'s End as its initial state', () => {
  expect(web).toContain('end: (scene) => <EndScene scene={scene} />,');
  expect(app).toContain("end: (scene) => <EndOpened value={{ share: scene.sheet === 'share' }}><Play /></EndOpened>,");
  // What the web's page presses is the end's own button, by its words, in the end's own page: the web's End draws the share card's button in its `main`.
  expect(web).toContain("[...document.querySelectorAll<HTMLElement>('main button')].find((button) => button.textContent === share('open'))");
  const end = read('../../web/src/game/screens/End.tsx');
  expect(end).toContain('<main className="mx-auto w-full max-w-md px-3 pb-8 pt-6 lg:max-w-5xl">');
  expect(end).toContain('<ShareCard ops={picture}');
  expect(read('../../web/src/game/screens/ShareCard.tsx')).toContain("<Button wide onClick={() => setOpen(true)}>\n        {t('open')}");
  expect(read('../../web/src/game/screens/Play.tsx')).toContain("if (stage === 'end') return <End extra={room?.end} />;");
  // The one scene of the end with a sheet names the share card's.
  expect(SCENES.filter((scene) => scene.name.startsWith('end-') && scene.sheet !== undefined).map((scene) => scene.sheet)).toEqual(['share']);
});

test('a moment of a life is drawn by Play on both sides: its sheet is Play\'s own, open over its stage as the game opens it', () => {
  expect(web).toContain('moment: (scene) => <PlayScene scene={scene} />,');
  expect(app).toContain('moment: (scene) => <PlayScene scene={scene} />,');
  // Each side's Play mounts the moments with its page.
  expect(read('../../web/src/game/screens/Play.tsx')).toContain('<Moments />');
  expect(read('../src/game/screens/Play.tsx')).toContain('<Moments />');
});
