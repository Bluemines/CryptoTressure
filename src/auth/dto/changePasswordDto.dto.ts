import { IsNotEmpty, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  currentPassword!: string;

  @IsNotEmpty()
  @MinLength(8, { message: 'New password must be at least 8 characters.' })
  newPassword!: string;

  @IsNotEmpty()
  confirmPassword!: string;
}
