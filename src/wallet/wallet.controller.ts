import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { WalletService } from './wallet.service';
import { ApiResponse, Roles, RolesGuard } from 'src/common';
import { AdminWalletListDto } from './dto/admin-wallet.dto';
import { AdminWalletDto } from './dto/admin-userWallets.dto';
import { AdminWalletSummary } from './interfaces/AdminWalletSummary';

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private svc: WalletService) {}

  // Customer
  /** Logged-in user wallet snapshot */
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async myWallet(@Req() req) {
    const data = await this.svc.getUserWallet(req.user.id);
    return new ApiResponse(200, data, 'Wallet snapshot');
  }

  @Get('admin-allWallets')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async adminWalletSummary(): Promise<ApiResponse<AdminWalletSummary>> {
    const data = await this.svc.getAdminWalletSummary();
    return new ApiResponse(200, data, 'Admin wallet summary');
  }

  @Get('overview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  getWalletOverview(@Req() req) {
    return this.svc.getWalletOverview(req.user.id);
  }

  // ADMIN
  /** paginated list */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async list(@Query() q: AdminWalletListDto) {
    const { items, total } = await this.svc.listWallets(
      q.page,
      q.limit,
      q.search,
    );
    return new ApiResponse(200, { items, meta: { total } }, 'Wallets list');
  }

  /** single wallet */
  @Get(':userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async single(@Param('userId', ParseIntPipe) userId: number) {
    const w = await this.svc.getWalletByUser(userId);
    return new ApiResponse(200, w, 'Wallet detail');
  }
}
