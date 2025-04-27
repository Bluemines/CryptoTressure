import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { ApiResponse, Roles, RolesGuard } from 'src/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('referral')
export class ReferralController {
  constructor(private referralService: ReferralService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async createReferral(@Req() req): Promise<ApiResponse<{ url: string }>> {
    const userId = req.user.id as number;
    const url = await this.referralService.createReferralLink(userId);
    return new ApiResponse(200, { url }, 'Referral link created');
  }
}
