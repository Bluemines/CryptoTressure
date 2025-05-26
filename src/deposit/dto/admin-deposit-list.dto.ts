import { Type } from 'class-transformer';
import { IsInt, Min, IsOptional } from 'class-validator';

export class AdminDepositListDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit = 20;
}
