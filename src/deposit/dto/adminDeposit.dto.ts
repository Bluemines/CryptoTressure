import { Type } from 'class-transformer';
import { IsEmail, IsNotEmpty, Min } from 'class-validator';

export class AdminDepositDto {
  @Min(50)
  @IsNotEmpty()
  @Type(() => Number)
  amount: number;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}
