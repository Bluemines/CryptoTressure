import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Roles, RolesGuard } from 'src/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getStats() {
    return this.dashboardService.getDashboardStats();
  }

    @Get('user_stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles('USER')
    getUserStats() {
      return this.dashboardService.getUserDashboardStats()
    }

  @Get('recent-users')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getRecentUsers() {
    return this.dashboardService.getRecentUsers();
  }

  @Get('recent-withdrawals')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getRecentWithdrawals() {
    return this.dashboardService.getRecentWithdrawals();
  }

  @Get('revenue-stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getRevenueStats(@Query('range') range: string = 'ALL') {
    return this.dashboardService.getRevenueAndSales();
  }
}
