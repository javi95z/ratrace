/**
 * The record of a life: its net-worth history, its bankruptcies and the journal its badges are
 * judged from. It lives with the badge rules in the content package, so that a server writing a
 * finished life down keeps it with the very same code.
 */
export { recordStart, recordStep } from '@ratrace/content';
export type { LifeRecord } from '@ratrace/content';
