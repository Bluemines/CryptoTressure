import {
  Body,
  Controller,
  Post,
  Get,
  Req,
  UseGuards,
  Headers as HeaderDec,
} from '@nestjs/common';
import { DepositService } from './deposit.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiResponse, Roles, RolesGuard } from 'src/common';
import { AdminDepositDto } from './dto/adminDeposit.dto';

@Controller('deposit')
export class DepositController {
  constructor(private svc: DepositService) {}

  // User Deposits
  @Get('my-deposits')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async userDeposits(@Req() req) {
    const userId = req.user.Id;
    const deposits = await this.svc.userDepositsService(userId);
    return new ApiResponse(
      200,
      deposits,
      'User Deposits Retrived Successfully',
    );
  }

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
  const res =  await this.svc.handleIPN(body, sig);
    return { res};
  }

  // Admin give deposit to User
  @Post('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async adminDeposit(@Body() dto: AdminDepositDto) {
    await this.svc.adminDepositService(dto);
    return new ApiResponse(200, '', 'Amount Deposit to User Successfully');
  }
}
