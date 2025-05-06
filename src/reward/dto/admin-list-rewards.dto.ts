import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsPositive,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

export class AdminListRewardsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  userId?: number;

  @IsOptional()
  @IsISO8601()
  dateFrom?: string;

  @IsOptional()
  @IsISO8601()
  dateTo?: string;

  @Transform(({ value }) => (value === '' ? undefined : value))
  private _!: unknown;
}
