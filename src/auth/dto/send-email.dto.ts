import { IsEmail, IsNotEmpty } from 'class-validator';
import { Transform } from 'class-transformer';

export class SendEmailDto {
  @IsEmail()
  @Transform(({ value }) => value?.trim().toLowerCase())
  @IsNotEmpty()
  email!: string;
}
