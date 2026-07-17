import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

export class TestDb {
  private constructor(private readonly container: StartedPostgreSqlContainer) {}

  static async start(): Promise<TestDb> {
    const container = await new PostgreSqlContainer(
      'pgvector/pgvector:pg16',
    ).start();
    return new TestDb(container);
  }

  async stop(): Promise<void> {
    await this.container.stop();
  }

  get connectionUri(): string {
    return this.container.getConnectionUri();
  }
}
