import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiResponse, Roles, RolesGuard } from 'src/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('bonus')
export class BonusController {
  constructor(private prisma: PrismaService) {}

  @Get('')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async getBonuses(@Req() req) {
    const bonuses = await this.prisma.bonus.findMany({
      where: { userId: req.user.sub },
      orderBy: { createdAt: 'desc' },
    });

    return new ApiResponse(200, bonuses, 'Bonuses retrieved successfully');
  }
}
