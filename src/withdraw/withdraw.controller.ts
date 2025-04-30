import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { WithdrawService } from './withdraw.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles, ApiResponse } from 'src/common';
import { RequestWithdrawDto } from './dto/request-withdraw.dto';
import { Withdraw } from '../../generated/prisma/client';

@Controller('withdraw')
export class WithdrawController {
  constructor(private readonly svc: WithdrawService) {}

  /* ─────────────── USER asks for cash-out ─────────────── */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async request(
    @Req() req,
    @Body() dto: RequestWithdrawDto,
  ): Promise<ApiResponse<Withdraw>> {
    console.log('1');
    const wd = await this.svc.request(req.user.id, dto);
    return new ApiResponse(200, wd, 'Withdrawal requested');
  }

  /* ─────────────── ADMIN list PENDING ──────────────────── */
  @Get('admin/pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listPending(): Promise<ApiResponse<Withdraw[]>> {
    const list = await this.svc.listPending();
    return new ApiResponse(200, list, 'Pending withdrawals');
  }

  /* ─────────────── ADMIN approve ───────────────────────── */
  @Patch('admin/:id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async approve(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponse<null>> {
    await this.svc.approve(id);
    return new ApiResponse(200, null, 'Withdrawal approved');
  }

  /* ─────────────── ADMIN reject ────────────────────────── */
  @Patch('admin/:id/reject')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async reject(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponse<null>> {
    await this.svc.reject(id);
    return new ApiResponse(200, null, 'Withdrawal rejected & funds returned');
  }
}
