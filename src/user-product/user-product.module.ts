import { Module } from '@nestjs/common';
import { PrincipalRefundJob } from './user-product.job';

@Module({
  providers: [PrincipalRefundJob],
})
export class UserProductModule {}
