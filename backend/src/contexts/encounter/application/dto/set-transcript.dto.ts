import { IsString } from 'class-validator';

export class SetTranscriptDto {
  @IsString()
  text: string;
}
