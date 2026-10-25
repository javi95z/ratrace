import { createContext, useContext } from 'react';

/*
 * A control in a sheet that drags itself (a slider) and the sheet it stands in: pressed, the sheet is never dragged from it. Apart from the sheet's
 * pull (`useSheetPull.ts`), so that such a control loads nothing of the pull's motion.
 */

/** What a control that drags itself tells the sheet it stands in: pressed, and let go. */
export interface SheetHold {
  press(): void;
  release(): void;
}
const NO_HOLD: SheetHold = { press: () => undefined, release: () => undefined };
const SheetHoldContext = createContext<SheetHold>(NO_HOLD);
/** Given by a sheet to what it holds. */
export const SheetHoldProvider = SheetHoldContext.Provider;
/**
 * For a control that drags itself (a slider): pressed, the sheet it stands in is never dragged from it, on the phone (where the sheet's pan gives way)
 * as on the web (which also knows it by its role, or by `data-sheet-nodrag`). Outside a sheet it does nothing.
 */
export const useSheetHold = (): SheetHold => useContext(SheetHoldContext);
