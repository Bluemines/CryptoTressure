import { randomBytes } from 'crypto';

export function generateId(len = 12): string {
  return randomBytes(len)
    .toString('base64url')
    .slice(0, (len * 4) / 3);
}
