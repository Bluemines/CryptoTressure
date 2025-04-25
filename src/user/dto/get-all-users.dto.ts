import { Type } from 'class-transformer';
import { IsOptional, IsString, Min, IsIn } from 'class-validator';

export class GetAllUsersDTO {
  @IsOptional()
  @Type(() => Number)
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @Min(1)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  @IsIn(['APPROVED', 'INACTIVE'])
  status?: 'APPROVED' | 'INACTIVE';

  @IsOptional()
  @IsString()
  @IsIn(['ALL', '24H', '7d', '12d', '30d'])
  time?: 'ALL' | '24H' | '7d' | '12d' | '30d' = 'ALL';
}
