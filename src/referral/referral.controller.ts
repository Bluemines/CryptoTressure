import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ApiResponse, Roles, RolesGuard } from 'src/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { CreateReferralDto } from './dto/create-referral.dto';

@Controller('referral')
export class ReferralController {
  constructor(private referralService: ReferralService) {}

  @Post('link')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async createReferral(@Req() req): Promise<ApiResponse<{ url: string }>> {
    const userId = req.user.id as number;
    const url = await this.referralService.createReferralLink(userId);
    return new ApiResponse(200, { url }, 'Referral link created');
  }

  @Post()
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles('USER')
  async create(
    @Req() req,
    @Body() createReferralDto: CreateReferralDto,
  ) {
    return this.referralService.createReferral(req.user.id, createReferralDto);
  }

  @Get('history')
  @UseGuards(JwtAuthGuard,RolesGuard)
  @Roles('USER')
  async getHistory(@Req() req) {
    return this.referralService.getReferralHistory(req.user.id);
  }

  // @Get('stats')
  // @UseGuards(JwtAuthGuard,RolesGuard)
  // @Roles('USER')
  // async getStats(@Req() req) {
  //   return this.referralService.getReferralStats(req.user.id);
  // }

}
