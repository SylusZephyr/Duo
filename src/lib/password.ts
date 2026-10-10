/**
 * Password rules, in one place so the sign-up form, the reset form and any
 * future change-password screen cannot disagree about what is acceptable.
 *
 * Length is the only rule. Composition rules (a digit, a symbol, a capital)
 * push people towards "Password1!" and are worse than a longer passphrase;
 * this is also the current guidance from NIST SP 800-63B.
 */
export const MIN_PASSWORD_LENGTH = 8;

const MAX_PASSWORD_LENGTH = 72; // bcrypt truncates beyond this, silently.

/** Returns a sentence describing what is wrong, or null when it is fine. */
export function describePassword(password: string): string | null {
  if (password.length === 0) return "Choose a password";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Passwords need at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Passwords can be at most ${MAX_PASSWORD_LENGTH} characters`;
  }
  if (password.trim().length === 0) return "A password of only spaces is too easy to lose";
  return null;
}
