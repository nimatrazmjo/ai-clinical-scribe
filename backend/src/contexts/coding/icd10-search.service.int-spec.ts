import { DataSource } from 'typeorm';
import { TestDb } from '../../../test/support/test-db';
import { ALL_ENTITIES, ALL_MIGRATIONS } from '../../database/database.module';
import { FakeEmbeddingService } from './test-doubles/fake-embedding.service';
import { Icd10SeedService } from './icd10-seed.service';
import { Icd10SearchService } from './icd10-search.service';
import { ICD10_SEED } from './icd10-seed-data';

describe('Icd10SearchService (integration)', () => {
  let testDb: TestDb;
  let ds: DataSource;
  let search: Icd10SearchService;

  beforeAll(async () => {
    testDb = await TestDb.start();
    ds = new DataSource({
      type: 'postgres',
      url: testDb.connectionUri,
      synchronize: false,
      entities: ALL_ENTITIES,
      migrations: ALL_MIGRATIONS,
    });
    await ds.initialize();
    await ds.runMigrations();

    const embedder = new FakeEmbeddingService();
    const seeder = new Icd10SeedService(ds as never, embedder);
    await seeder.onApplicationBootstrap();

    search = new Icd10SearchService(ds as never, embedder);
  }, 180_000);

  afterAll(async () => {
    await ds.destroy();
    await testDb.stop();
  }, 30_000);

  it('returns results for a clinical query', async () => {
    const results = await search.searchSemantic('hypertension', 5);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results[0]).toHaveProperty('code');
    expect(results[0]).toHaveProperty('description');
    expect(typeof results[0].score).toBe('number');
  });

  it('exact description query returns a perfect score of 1.0 for that code', async () => {
    // searching the exact description text should yield cosine similarity ~1.0
    const results = await search.searchSemantic('Essential (primary) hypertension', 10);
    const i10 = results.find((r) => r.code === 'I10');
    expect(i10).toBeDefined();
    expect(i10!.score).toBeCloseTo(1.0, 4);
  });

  it('exact description query for E11.9 yields similarity 1.0', async () => {
    const results = await search.searchSemantic('Type 2 diabetes mellitus without complications', 10);
    const match = results.find((r) => r.code === 'E11.9');
    expect(match).toBeDefined();
    expect(match!.score).toBeCloseTo(1.0, 4);
  });

  it('scores are numeric values in [-1, 1]', async () => {
    const results = await search.searchSemantic('chest pain', 5);
    for (const r of results) {
      expect(r.score).toBeGreaterThanOrEqual(-1);
      expect(r.score).toBeLessThanOrEqual(1);
    }
  });

  it('returns empty array when catalogue is queried with limit 0', async () => {
    const results = await search.searchSemantic('migraine', 0);
    expect(results).toHaveLength(0);
  });

  it('seeder is idempotent — running twice does not duplicate rows', async () => {
    const embedder = new FakeEmbeddingService();
    const seeder = new Icd10SeedService(ds as never, embedder);
    await seeder.onApplicationBootstrap();

    const [{ count }] = await ds.query(`SELECT COUNT(*) FROM icd10_codes`) as [{ count: string }];
    expect(parseInt(count, 10)).toBe(ICD10_SEED.length);
  });
});
