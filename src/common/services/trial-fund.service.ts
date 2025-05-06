import { Injectable, Logger } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { setTimeout } from 'timers';
import { TrialFund } from 'generated/prisma';

@Injectable()
export class TrialFundService {
  private readonly logger = new Logger(TrialFundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduler: SchedulerRegistry,
  ) {}

  /** Queue a timeout to auto‑recover a trial fund when it expires */
  async scheduleRecovery(trial: TrialFund) {
    const delay = trial.expiresAt.getTime() - Date.now();
    if (delay <= 0) {
      return this.recover(trial.id);
    }

    const key = `trial-recover-${trial.id}`;
    const timeout = setTimeout(() => {
      this.recover(trial.id).catch((err) => {
        this.logger.error(`Failed auto‑recover trial ${trial.id}`, err.stack);
      });
    }, delay);

    this.scheduler.addTimeout(key, timeout);
    this.logger.log(`Scheduled trialFund ${trial.id} recovery in ${delay}ms`);
  }

  /** Mark trial fund recovered (no refund logic here – handled elsewhere) */
  async recover(trialId: number) {
    const trial = await this.prisma.trialFund.findUnique({
      where: { id: trialId },
    });
    if (!trial || trial.status !== 'ACTIVE') return;

    await this.prisma.trialFund.update({
      where: { id: trialId },
      data: { status: 'RECOVERED', recoveredAt: new Date() },
    });
    this.logger.log(`Recovered trialFund ${trialId}`);

    const key = `trial-recover-${trialId}`;
    if (this.scheduler.doesExist('timeout', key)) {
      this.scheduler.deleteTimeout(key);
    }
  }
}
