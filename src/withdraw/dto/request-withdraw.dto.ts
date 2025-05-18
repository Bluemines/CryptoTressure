import { IsNumber, IsOptional, ValidateIf, IsString } from 'class-validator';

export class RequestWithdrawDto {
  @IsNumber() amount: number;

  @IsOptional()
  @IsString()
  msisdn?: string;

  @IsOptional()
  @IsString()
  cnic?: string;

  @ValidateIf((o) => !o.msisdn && !o.cnic)
  missingIdentifier() {
    throw new Error('Either msisdn or cnic is required');
  }
}

export class WithdrawResponseDto {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  method: string;
  status: string;
  createdAt: Date;
}

// src/withdraw/dto/user-withdraw-response.dto.ts
export class UserWithdrawResponseDto {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  method: string;
  status: string;
  createdAt: Date;
}
