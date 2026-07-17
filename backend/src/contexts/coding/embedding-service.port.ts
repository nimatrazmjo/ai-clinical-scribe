export const EMBEDDING_SERVICE = 'EMBEDDING_SERVICE';

export interface EmbeddingService {
  embed(text: string): Promise<number[]>;
}
