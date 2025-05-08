// src/referral/dto/referral-response.dto.ts
export class ReferralResponseDto {
    id: number;
    createdAt: Date;
    referrerId: number;
    referredId: number;
    code: string;
  }