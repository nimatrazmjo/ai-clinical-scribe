import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class StartEncounterDto {
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsDateString()
  dateOfBirth: string;

  @IsOptional()
  @IsString()
  transcript?: string;

  @IsOptional()
  @IsUUID()
  templateId?: string;
}
