import { Product } from '../../../generated/prisma';

export interface UserProductWithRemaining extends Product {
  expiresAt: Date;
  remaining: {
    days: number;
    hours: number;
    mins: number;
    secs: number;
    isExpired: boolean;
  };
}
