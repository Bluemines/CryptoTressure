import { IsOptional, IsString, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class AdminWalletListDto {
  @IsOptional() @Type(() => Number) @Min(1) page = 1;
  @IsOptional() @Type(() => Number) @Min(1) limit = 10;
  @IsOptional() @IsString() search?: string;
}
