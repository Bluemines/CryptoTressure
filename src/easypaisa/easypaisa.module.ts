import { Module } from '@nestjs/common';
import { EasypaisaClient } from './easypaisa.client';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [HttpModule],
  providers: [EasypaisaClient],
  exports: [EasypaisaClient, HttpModule],
})
export class EasypaisaModule {}
