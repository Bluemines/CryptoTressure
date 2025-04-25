import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UserRewardDTO {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  id: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  product: number;

  @Type(() => Number)
  @IsInt()
  @Min(0)
  reward: number;
}
