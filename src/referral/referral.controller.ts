import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ApiError, ApiResponse, Roles, RolesGuard } from 'src/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';
import { ReferralFilterDto } from './dto/referral-filter.dto';
import { PaginatedReferralResponseDto } from './dto/referral-response.dto';

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
  
  @Get('tree')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async getMyReferralsTree(@Req() req) {
    return this.referralService.getReferralTree(req.user.id);
  }
  
  @Get('admin/tree/:userId')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles("ADMIN")
  async getReferralTreeByAdmin(@Param('userId', ParseIntPipe) userId: number){
    return this.referralService.getReferralTreeByAdmin(userId)
  }

  @Get('admin/listing')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getReferralListing(
    @Query('referrerId') referrerId?: string,
    @Query('level') level = '1',
    @Query('page') page = '1',
    @Query('limit') limit = '10',
  ) {
    const id = referrerId ? parseInt(referrerId) : undefined;
    const lvl = parseInt(level);
    const pg = parseInt(page);
    const lim = parseInt(limit);
  
    if (referrerId && isNaN(id)) {
      throw new BadRequestException('Invalid referrerId');
    }
  
    return this.referralService.getReferralListingByAdmin({
      referrerId: id,
      level: lvl,
      page: pg,
      limit: lim,
    });
  }
  
}