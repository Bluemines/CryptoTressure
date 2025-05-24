import { IsEmail, IsInt, IsNotEmpty, Min } from 'class-validator';

export class AdminDepositDto {
  @IsInt()
  @Min(50)
  @IsNotEmpty()
  amount: number;

  @IsEmail()
  @IsNotEmpty()
  email: string;
}
