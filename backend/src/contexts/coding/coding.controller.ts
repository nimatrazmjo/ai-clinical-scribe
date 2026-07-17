import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { Auth } from '../auth/decorators/auth.decorator';
import { UserRole } from '../identity/user.entity';
import { Icd10SearchService } from './icd10-search.service';

@Controller('icd10')
export class CodingController {
  constructor(private readonly search: Icd10SearchService) {}

  @Get('search')
  @Auth(UserRole.PROVIDER)
  async searchIcd10(@Query('q') q: string) {
    if (!q || q.trim().length === 0) {
      throw new BadRequestException('Query parameter "q" is required and must not be empty');
    }
    return this.search.searchSemantic(q.trim(), 10);
  }
}
