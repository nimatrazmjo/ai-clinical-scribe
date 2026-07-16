// Testcontainers wrapper — wired in BE-03 when real DB connections are introduced.
// Declared here so integration tests can import it without structural changes later.
export class TestDb {
  private _connectionUri = '';

  static start(): Promise<TestDb> {
    return Promise.reject(
      new Error('TestDb.start() not yet implemented — wire in BE-03'),
    );
  }

  stop(): Promise<void> {
    return Promise.reject(
      new Error('TestDb.stop() not yet implemented — wire in BE-03'),
    );
  }

  get connectionUri(): string {
    return this._connectionUri;
  }
}
