// src/referral/dto/create-referral.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateReferralDto {
  @IsNotEmpty()
  @IsString()
  referredUsername: string;
}