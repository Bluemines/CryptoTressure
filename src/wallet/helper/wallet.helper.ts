import { Prisma, Wallet } from '../../../generated/prisma/client';
const { Decimal } = Prisma;

export function getTotals(wallet: Wallet) {
  const available = new Decimal(wallet.balance);
  const reserved = new Decimal(wallet.reserved);

  return {
    available,
    reserved,
    total: available.plus(reserved),
  };
}
