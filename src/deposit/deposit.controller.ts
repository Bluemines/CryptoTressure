import {
  Body,
  Controller,
  Post,
  Req,
  UseGuards,
  Headers as HeaderDec,
  Get,
  Query,
} from '@nestjs/common';
import { DepositService } from './deposit.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiResponse, Roles, RolesGuard } from 'src/common';
import { AdminDepositDto } from './dto/adminDeposit.dto';
import { AdminDepositListDto } from './dto/admin-deposit-list.dto';

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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async adminDeposit(@Body() dto: AdminDepositDto) {
    await this.svc.adminDepositService(dto);
    return new ApiResponse(
      200,
      '',
      'Deposit added to User wallet successfully!',
    );
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listAdminDeposits(@Query() query: AdminDepositListDto) {
    const { items, total } = await this.svc.listAdminDepositsForUsers(query);
    return new ApiResponse(
      200,
      {
        items,
        total,
        page: query.page,
        limit: query.limit,
      },
      'Admin deposits fetched',
    );
  }

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async listDeposits(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Query('status') status?: string,
    @Query('userId') userId?: string,
  ) {
    return this.svc.getDeposits({
      page: Number(page),
      limit: Number(limit),
      status,
      userId,
    });
  }
}
