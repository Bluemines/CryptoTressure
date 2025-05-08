// src/referral/dto/referral-history.dto.ts
export class ReferralHistoryDto {
    id: number;
    username: string;
    email: string;
    joinedDate: Date;
    status: string;
    earnedCommissions: number;
  }