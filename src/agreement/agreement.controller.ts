import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { CreateAgreementDto, UpdateAgreementDto } from './agreement.dto';
import { AgreementService } from './agreement.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { ApiResponse, Roles, RolesGuard } from 'src/common';

@Controller('agreements')
export class AgreementController {
  constructor(private readonly agreementService: AgreementService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  create(@Body() dto: CreateAgreementDto) {
    return this.agreementService.create(dto);
  }

  @Get('getAgreements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'USER')
  async getAllAgreements() {
    const result = await this.agreementService.getAgreements();
    console.log(result);

    return new ApiResponse(200, result, 'Agreements retrieved');
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  getById(@Param('id', ParseIntPipe) id: number) {
    return this.agreementService.getById(id);
  }
  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  updateAgreement(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAgreementDto,
  ) {
    return this.agreementService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  deleteAgreement(@Param('id', ParseIntPipe) id: number) {
    return this.agreementService.delete(id);
  }
}
