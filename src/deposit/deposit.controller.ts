import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Headers as HeaderDec,
} from '@nestjs/common';
import { DepositService } from './deposit.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiResponse } from 'src/common';

@Controller('deposit')
export class DepositController {
  constructor(private svc: DepositService) {}

  /** user starts a deposit */
  @Post('init')
  @UseGuards(JwtAuthGuard)
  async init(@Req() req, @Body('amount') amount: number) {
    const { payUrl, reference } = await this.svc.initDeposit(
      req.user.id,
      amount,
    );
    return new ApiResponse(200, { payUrl, reference }, 'Redirect user');
  }

  /** Easypaisa IPN */
  @Post('webhook')
  async webhook(@HeaderDec('x-signature') sig: string, @Body() body: any) {
    await this.svc.handleIPN(body, sig);
    return { ok: true };
  }
}
