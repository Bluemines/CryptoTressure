import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiResponse, Roles, RolesGuard } from 'src/common';
import { AdminListRewardsDto } from './dto/admin-list-rewards.dto';
import { RewardService } from './reward.service';
import { Reward } from 'generated/prisma';
import { UserRewardDTO } from 'src/user/dto';
import { UserService } from 'src/user/user.service';

@Controller('reward')
export class RewardController {
  constructor(private readonly rewardService: RewardService) {}

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async listRewardsAdmin(@Query() q: AdminListRewardsDto): Promise<
    ApiResponse<{
      items: Reward[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>
  > {
    const page = q.page ?? 1;
    const limit = q.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await this.rewardService.findAllAdmin({
      skip,
      take: limit,
      userId: q.userId,
      dateFrom: q.dateFrom ? new Date(q.dateFrom) : undefined,
      dateTo: q.dateTo ? new Date(q.dateTo) : undefined,
    });

    const totalPages = Math.ceil(total / limit) || 1;

    return new ApiResponse(
      200,
      { items, meta: { total, page, limit, totalPages } },
      'Rewards retrieved',
    );
  }

  @Post('reward')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async userReward(@Body() dto: UserRewardDTO): Promise<ApiResponse<any>> {
    const reward = await this.rewardService.userReward(dto);
    return new ApiResponse(200, reward, 'User rewarded');
  }
}
