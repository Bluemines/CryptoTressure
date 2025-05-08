import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ApiError, ApiResponse, Roles, RolesGuard } from 'src/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateReferralDto } from './dto/create-referral.dto';
import { ConfigService } from '@nestjs/config';

@Controller('referral')
export class ReferralController {
  constructor(
    private referralService: ReferralService,
    private config: ConfigService,
  ) {}

  @Get('link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async getReferralLink(@Req() req) {
    const { referralCode } = req.user;

    if (!referralCode) {
      throw new ApiError(400, 'Referral code not assigned to this user');
    }

    const base = this.config.get<string>('FRONTEND_URL').replace(/\/+$/, '');
    const link = `${base}/?ref=${referralCode}`;

    return new ApiResponse(200, { link }, 'Referral link generated');
  }

  @Get('history')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async getHistory(@Req() req) {
    return this.referralService.getReferralHistory(req.user.id);
  }
}
