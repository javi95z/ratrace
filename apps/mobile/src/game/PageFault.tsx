import type { ErrorBoundaryProps } from 'expo-router';
import type { ComponentType } from 'react';

/*
 * The page of a fault, the web's (`PageFault.web.tsx`, the Next web's `[locale]/error.tsx`). The phone keeps what it does today when a screen cannot
 * be drawn (its error watch hears it, `online/errors.ts`): no boundary is given to the router here, which draws the routes as they are.
 */
export const ErrorBoundary: ComponentType<ErrorBoundaryProps> | undefined = undefined;
