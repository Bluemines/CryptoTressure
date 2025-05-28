import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { UserService } from './user.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiResponse, Roles, RolesGuard } from 'src/common';
import { GetAllUsersDTO, UpdateUserDTO, UserRewardDTO } from './dto';
import { UserListView } from './interfaces';
import { FileUpload } from 'src/common/decorators/file-upload.decorator';
import { User } from '../../generated/prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('user')
export class UserController {
  constructor(private userService: UserService) {}

  @Patch('update')
  @FileUpload({ fieldName: 'profile' }) // <-- our decorator
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('USER', 'ADMIN')
  async updateUser(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UpdateUserDTO,
    @Req() req,
  ): Promise<ApiResponse<User>> {
    const userId = req.user.id as number;

    const data: UpdateUserDTO & { profile?: string } = { ...dto };
    if (file) data.profile = `/uploads/${file.filename}`;

    const updated = await this.userService.updateUser(userId, data);
    return new ApiResponse(200, updated, 'User updated');
  }

  @Get('stats')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getStats() {
    return this.userService.getUserStats();
  }
  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getAllUsers(@Query() dto: GetAllUsersDTO): Promise<
    ApiResponse<{
      items: UserListView[];
      meta: { total: number; page: number; limit: number; totalPages: number };
    }>
  > {
    const { items, total } = await this.userService.getAllUsers(dto);
    const totalPages = Math.ceil(total / dto.limit!);

    return new ApiResponse(
      200,
      {
        items,
        meta: { total, page: dto.page!, limit: dto.limit!, totalPages },
      },
      'Users retrieved',
    );
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getUserById(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.getUserById(id);
    return new ApiResponse(200, user, 'User retrieved');
  }

  @Post('suspend/:id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async suspendUser(@Param('id', ParseIntPipe) id: number) {
    const user = await this.userService.suspendUser(id);
    return new ApiResponse(200, user, 'User suspended');
  }
}
