export class AdminWalletDto {
  userId: number;
  email: string;
  username?: string;
  balance: number;
  reservedAmount: number;
  referralEarnings: number;
  teamEarnings: number;
  investmentEarnings: number;
  total: number;
}
