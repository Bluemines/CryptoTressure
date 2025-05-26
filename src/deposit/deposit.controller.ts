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
import { AdminDepositDto } from './dto/adminDeposit.dto';

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

  @Post('admin')
  @UseGuards(JwtAuthGuard)
  async adminDeposit(@Body() dto: AdminDepositDto) {
    await this.svc.adminDepositService(dto);
    return new ApiResponse(
      200,
      '',
      'Deposit added to User wallet successfully!',
    );
  }
}
