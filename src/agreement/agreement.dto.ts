import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAgreementDto {
  @IsNotEmpty()
  agreement: string// This will contain the raw HTML
}

export class UpdateAgreementDto {
    @IsOptional()
    @IsString()
    agreement?: string; // Raw HTML
  }
