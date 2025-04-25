import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Level } from '../../generated/prisma/client';
import { ApiError } from 'src/common/utils/api-error';
import { CreateLevelDto } from './dto';
import { PrismaClientKnownRequestError } from 'generated/prisma/runtime/library';
import { UpdateLevelDto } from './dto/update-level.dto';

@Injectable()
export class LevelService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateLevelDto): Promise<Level> {
    try {
      return await this.prisma.level.create({ data: dto });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ApiError(400, `Level ${dto.level} already exists`);
      }
      throw e;
    }
  }

  findAll(): Promise<Level[]> {
    return this.prisma.level.findMany({ orderBy: { level: 'asc' } });
  }

  async findOne(id: number): Promise<Level> {
    const lvl = await this.prisma.level.findUnique({ where: { id } });
    if (!lvl) throw new ApiError(404, 'Level not found');
    return lvl;
  }

  async update(id: number, dto: UpdateLevelDto): Promise<Level> {
    try {
      return await this.prisma.level.update({
        where: { id },
        data: dto,
      });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new ApiError(404, 'Level not found');
      }
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
        throw new ApiError(400, `Level ${dto.level} already exists`);
      }
      throw e;
    }
  }

  async remove(id: number): Promise<Level> {
    try {
      return await this.prisma.level.delete({ where: { id } });
    } catch (e) {
      if (e instanceof PrismaClientKnownRequestError && e.code === 'P2025') {
        throw new ApiError(404, 'Level not found');
      }
      throw e;
    }
  }
}
