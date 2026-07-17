import { IsObject } from 'class-validator';

export class UpdateDraftDto {
  @IsObject()
  draft: Record<string, unknown>;
}
