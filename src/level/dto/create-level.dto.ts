import { IsInt, Min } from 'class-validator';

export class CreateLevelDto {
  @IsInt()
  @Min(1)
  level!: number;

  @IsInt()
  @Min(0)
  points!: number;
}
