import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateTemplateDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() promptBody?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
