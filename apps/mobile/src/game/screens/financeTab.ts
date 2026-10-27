import { createContext, useContext } from 'react';

/*
 * The tab of the finances on screen, kept round the life's whole screen (`FinanceShell` in Finance.tsx), so that what stands outside the finances'
 * panel (the Hud's sheet of the focus) can take the player to the tab it speaks of. A module of its own: the Hud and the finances both read it.
 */

/** The finances' tabs, in their order. */
export type TabId = 'portfolio' | 'market' | 'property' | 'business' | 'debt' | 'lifestyle' | 'shop' | 'taxes';
export const TABS: TabId[] = ['portfolio', 'market', 'property', 'business', 'debt', 'lifestyle', 'shop', 'taxes'];

export const FinanceTab = createContext<{ tab: TabId; setTab(tab: TabId): void } | null>(null);

/** The way to another tab of the finances, where they are on screen; null outside them. */
export const useFinanceTabSetter = (): ((tab: TabId) => void) | null => useContext(FinanceTab)?.setTab ?? null;
