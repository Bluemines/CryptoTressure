import { Module } from '@nestjs/common';
import { RewardJob } from './reward.service';

@Module({
  providers: [RewardJob],
})
export class RewardModule {}
