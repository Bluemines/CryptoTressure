import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiResponse, RolesGuard } from 'src/common';
import { Roles } from 'src/common/decorators/roles.decorator';
import { AdminTransactionListDto } from './dto/admin-transaction-list.dto';

@Controller('transactions')
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get('user')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER')
  async userTransactions(@Req() req): Promise<ApiResponse> {
    const txns = await this.transactions.UserTransactions(req.user.id);

    if (txns.length === 0) {
      return new ApiResponse(404, [], 'No transactions found');
    }

    return new ApiResponse(200, txns, 'User transactions retrieved');
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async adminTransactions(@Query() query: AdminTransactionListDto) {
    const { items, total } = await this.transactions.listAllTransactions(query);
    return new ApiResponse(
      200,
      { items, total, page: query.page, limit: query.limit },
      'All user transactions retrieved',
    );
  }
}
