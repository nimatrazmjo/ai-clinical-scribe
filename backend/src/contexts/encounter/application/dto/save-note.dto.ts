import {
  ArrayMinSize,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class Icd10ItemDto {
  @IsString() @IsNotEmpty() code: string;
  @IsString() @IsNotEmpty() description: string;
  @IsOptional() @IsNumber() score?: number;
}

export class AssessmentDto {
  @IsString() @IsNotEmpty() text: string;
  @ValidateNested({ each: true })
  @Type(() => Icd10ItemDto)
  @ArrayMinSize(1)
  icd10: Icd10ItemDto[];
}

export class SoapNoteDto {
  @IsString() @IsNotEmpty() subjective: string;
  @IsString() @IsNotEmpty() objective: string;
  @ValidateNested()
  @Type(() => AssessmentDto)
  assessment: AssessmentDto;
  @IsString() @IsNotEmpty() plan: string;
}

export class SaveNoteDto {
  @ValidateNested()
  @Type(() => SoapNoteDto)
  soapNote: SoapNoteDto;

  @IsOptional()
  @IsString()
  draftRevision?: string;
}
