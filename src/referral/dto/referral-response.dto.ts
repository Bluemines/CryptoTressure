// src/referral/dto/referral-response.dto.ts
export class ReferralResponseDto {
    id: number;
    createdAt: Date;
    referrerId: number;
    referredId: number;
    code: string;
  }
export class ReferralResponse2Dto {
  id: number;
  referrerName: string;
  level: number;
  referredName: string;
  commission: number;
  date: Date;
  status: any;
}

export class PaginatedReferralResponseDto {
  data: ReferralResponse2Dto[];
  total: number;
  page: number;
  limit: number;
}