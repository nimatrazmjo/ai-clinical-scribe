import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTemplateDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() encounterType?: string;
  @IsString() @IsNotEmpty() promptBody: string;
}
