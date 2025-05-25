import {
  IsNumber,
  IsOptional,
  ValidateIf,
  IsString,
  IsNotEmpty,
  Min,
} from 'class-validator';

export class RequestWithdrawDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(50)
  amount: number;

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

export class UserWithdrawResponseDto {
  id: string;
  amount: number;
  fee: number;
  netAmount: number;
  method: string;
  status: string;
  createdAt: Date;
}
