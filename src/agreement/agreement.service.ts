import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAgreementDto, UpdateAgreementDto } from './agreement.dto';

@Injectable()
export class AgreementService {
  constructor(private prisma: PrismaService) {}

  async create(dto: CreateAgreementDto) {
    return this.prisma.agreement.create({
      data: {
        agreement: dto.agreement,
      },
    });
  }

  async getAgreements() {
    const agreements = await this.prisma.agreement.findMany();
    if (!agreements) {
      throw new NotFoundException(`Agreements not found.`);
    }

    return agreements;
  }

  async getById(id: number) {
    const existing = await this.prisma.agreement.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Agreement with ID ${id} not found.`);
    }
    return existing;
  }
  async update(id: number, dto: UpdateAgreementDto) {
    const existing = await this.prisma.agreement.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Agreement with ID ${id} not found.`);
    }

    return this.prisma.agreement.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

  async delete(id: number) {
    const existing = await this.prisma.agreement.findUnique({ where: { id } });

    if (!existing) {
      throw new NotFoundException(`Agreement with ID ${id} not found.`);
    }

    return this.prisma.agreement.delete({
      where: { id },
    });
  }
}
