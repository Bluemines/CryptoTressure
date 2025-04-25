import { CreateProductDto } from '../dto';

export interface ProductCreateInput extends CreateProductDto {
  image: string;
  userId: number;
}
