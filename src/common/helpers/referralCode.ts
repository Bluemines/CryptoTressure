import { randomBytes } from 'crypto';

export function makeReferralCode(bytes = 12): string {
  return randomBytes(bytes).toString('base64url');
}
