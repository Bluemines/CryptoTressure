import { IsEmail, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @IsNotEmpty()
  code!: string;

  @IsNotEmpty()
  @MinLength(8)
  newPassword!: string;

  @IsNotEmpty()
  @Matches(/^(?!.*\s).+$/, {
    message: 'Password cannot contain spaces',
  })
  confirmPassword!: string;
}
