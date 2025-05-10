import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateAgreementDto {
  @IsNotEmpty()
  title: string;

  @IsNotEmpty()
  content: string; // This will contain the raw HTML
}

export class UpdateAgreementDto {
    @IsOptional()
    @IsString()
    title?: string;
  
    @IsOptional()
    @IsString()
    content?: string; // Raw HTML
  }
