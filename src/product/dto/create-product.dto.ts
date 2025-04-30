import { IsNotEmpty, IsNumber, IsString } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  title!: string;

  @IsNotEmpty()
  @IsString()
  description!: string;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  price!: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  dailyIncome!: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  fee!: number;

  @IsNotEmpty()
  @Type(() => Number)
  @IsNumber()
  rentalDays: number;
}
