import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Patch,
  Delete,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { LevelService } from './level.service';
import { CreateLevelDto } from './dto/create-level.dto';
import { UpdateLevelDto } from './dto/update-level.dto';
import { ApiResponse } from 'src/common/utils/api-response';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { Level } from '../../generated/prisma/client';

@Controller('levels')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class LevelController {
  constructor(private readonly svc: LevelService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async create(@Body() dto: CreateLevelDto): Promise<ApiResponse<Level>> {
    const lvl = await this.svc.create(dto);
    return new ApiResponse(201, lvl, 'Level created');
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findAll(): Promise<ApiResponse<Level[]>> {
    const list = await this.svc.findAll();
    return new ApiResponse(200, list, 'Levels retrieved');
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponse<Level>> {
    const lvl = await this.svc.findOne(id);
    return new ApiResponse(200, lvl, 'Level retrieved');
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateLevelDto,
  ): Promise<ApiResponse<Level>> {
    const lvl = await this.svc.update(id, dto);
    return new ApiResponse(200, lvl, 'Level updated');
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponse<Level>> {
    const lvl = await this.svc.remove(id);
    return new ApiResponse(200, lvl, 'Level deleted');
  }
}
