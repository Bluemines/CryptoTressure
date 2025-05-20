import { Controller, Get, HttpCode, UseGuards } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Roles, RolesGuard } from 'src/common';

@Controller('debug')
export class DebugController {
  constructor(private readonly scheduler: SchedulerRegistry) {}

  /** Manually trigger the handleExpiredMachines cron */
  @Get('trigger-expiry')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  triggerExpiry() {
    const job = this.scheduler.getCronJob('handleExpiredMachines');
    if (!job) {
      throw new Error('handleExpiredMachines job not found');
    }
    const jobs = this.scheduler.getCronJobs();
    console.log([...jobs.keys()]);

    job.fireOnTick();
    return; // 204 No Content
  }

  /** Optionally, also a trigger for daily rewards */
  @Get('trigger-rewards')
  @HttpCode(204)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  triggerRewards() {
    const job = this.scheduler.getCronJob('daily-reward');
    if (!job) {
      throw new Error('daily-reward job not found');
    }
    job.fireOnTick();
    return;
  }
}
