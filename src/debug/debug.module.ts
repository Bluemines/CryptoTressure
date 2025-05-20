import { Module } from '@nestjs/common';
import { DebugController } from './debug.controller';
import { JobsModule } from 'src/jobs/jobs.module';

@Module({
  imports: [JobsModule],
  controllers: [DebugController],
})
export class DebugModule {}
