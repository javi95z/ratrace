/**
 * An e-mail address with most of its name hidden: enough to know which account it is, not enough
 * to read it over someone's shoulder. The settings are drawn on the front door too.
 */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 0) return '•••';
  const name = email.slice(0, at);
  // Two letters of a name of three or more, one of a name of two, none of a single letter.
  const shown = name.slice(0, Math.max(0, Math.min(2, name.length - 1)));
  return `${shown}•••${email.slice(at)}`;
}
