import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { AuthModule } from '../auth/auth.module';
import { EMBEDDING_SERVICE } from './embedding-service.port';
import { FakeEmbeddingService } from './test-doubles/fake-embedding.service';
import { Icd10SeedService } from './icd10-seed.service';
import { Icd10SearchService } from './icd10-search.service';
import { CodingController } from './coding.controller';

@Module({
  imports: [DatabaseModule, AuthModule],
  providers: [
    { provide: EMBEDDING_SERVICE, useClass: FakeEmbeddingService },
    Icd10SeedService,
    Icd10SearchService,
  ],
  controllers: [CodingController],
  exports: [Icd10SearchService],
})
export class CodingModule {}
