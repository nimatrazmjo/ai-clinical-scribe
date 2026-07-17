import '@testing-library/jest-dom';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import { server } from './setupServer';

// Provide a functional localStorage/sessionStorage in jsdom workers
function makeStorage() {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, value: string) => { store[key] = String(value); },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (index: number) => Object.keys(store)[index] ?? null,
  };
}

const localStorageMock = makeStorage();
const sessionStorageMock = makeStorage();

vi.stubGlobal('localStorage', localStorageMock);
vi.stubGlobal('sessionStorage', sessionStorageMock);

beforeEach(() => {
  localStorageMock.clear();
  sessionStorageMock.clear();
});

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));
afterEach(() => {
  server.resetHandlers();
  cleanup();
});
afterAll(() => server.close());
