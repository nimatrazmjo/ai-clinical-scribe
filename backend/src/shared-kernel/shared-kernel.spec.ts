import { AggregateRoot } from './aggregate-root';
import { DomainEvent } from './domain-event';
import { DomainException } from './domain.exception';
import { Entity } from './entity';
import { Guard } from './guard';
import { EncounterId, PatientId, UserId } from './ids';
import { SystemClock } from './implementations/system-clock';
import { UuidGenerator } from './implementations/uuid-generator';
import { ok, fail } from './result';
import { FixedClock } from './test-doubles/fixed-clock';
import { SeqIdGenerator } from './test-doubles/seq-id-generator';
import { ValueObject } from './value-object';

// ─── ValueObject ────────────────────────────────────────────────────────────

class Money extends ValueObject<{ amount: number; currency: string }> {}
class Weight extends ValueObject<{ amount: number; currency: string }> {}

describe('ValueObject', () => {
  it('equals by structural value', () => {
    const a = new Money({ amount: 10, currency: 'USD' });
    const b = new Money({ amount: 10, currency: 'USD' });
    expect(a.equals(b)).toBe(true);
  });

  it('unequal when any field differs', () => {
    const a = new Money({ amount: 10, currency: 'USD' });
    const b = new Money({ amount: 20, currency: 'USD' });
    expect(a.equals(b)).toBe(false);
  });

  it('unequal when constructor differs (different subclass)', () => {
    const a = new Money({ amount: 10, currency: 'USD' });
    const b = new Weight({ amount: 10, currency: 'USD' });
    expect(a.equals(b)).toBe(false);
  });

  it('unequal when compared to null', () => {
    const a = new Money({ amount: 10, currency: 'USD' });
    expect(a.equals(null as unknown as Money)).toBe(false);
  });

  it('props are frozen after construction', () => {
    const a = new Money({ amount: 10, currency: 'USD' });
    // Object.freeze makes the props object non-writable
    expect(Object.isFrozen((a as unknown as { props: object }).props)).toBe(
      true,
    );
  });
});

// ─── UniqueId / branded IDs ─────────────────────────────────────────────────

describe('UniqueId', () => {
  it('rejects empty string', () => {
    expect(() => new UserId('')).toThrow(DomainException);
  });

  it('rejects blank/whitespace-only string', () => {
    expect(() => new UserId('   ')).toThrow(DomainException);
  });

  it('two IDs with same value and same type are equal', () => {
    expect(new UserId('abc').equals(new UserId('abc'))).toBe(true);
  });

  it('two IDs with same value but different types are unequal', () => {
    const u = new UserId('abc');
    const p = new PatientId('abc');
    expect(u.equals(p)).toBe(false);
  });

  it('toString returns the value', () => {
    expect(new EncounterId('enc-1').toString()).toBe('enc-1');
  });

  it('equals returns false when compared to null', () => {
    expect(new UserId('abc').equals(null as unknown as UserId)).toBe(false);
  });
});

// ─── Entity ─────────────────────────────────────────────────────────────────

class TestEntity extends Entity<UserId> {}
class OtherEntity extends Entity<UserId> {}

describe('Entity', () => {
  it('equals when same type and same id', () => {
    const a = new TestEntity(new UserId('u1'));
    const b = new TestEntity(new UserId('u1'));
    expect(a.equals(b)).toBe(true);
  });

  it('not equal when ids differ', () => {
    const a = new TestEntity(new UserId('u1'));
    const b = new TestEntity(new UserId('u2'));
    expect(a.equals(b)).toBe(false);
  });

  it('equals returns false for null', () => {
    const a = new TestEntity(new UserId('u1'));
    expect(a.equals(null as unknown as TestEntity)).toBe(false);
  });

  it('equals returns false when entity types differ (same id)', () => {
    const a = new TestEntity(new UserId('u1'));
    const b = new OtherEntity(new UserId('u1'));
    expect(a.equals(b)).toBe(false);
  });
});

// ─── AggregateRoot ──────────────────────────────────────────────────────────

class ItemCreated extends DomainEvent {
  constructor(readonly itemId: string) {
    super();
  }
}

class ItemUpdated extends DomainEvent {
  constructor(readonly itemId: string) {
    super();
  }
}

class TestAggregate extends AggregateRoot<UserId> {
  create(id: string): void {
    this.record(new ItemCreated(id));
  }

  update(id: string): void {
    this.record(new ItemUpdated(id));
  }
}

describe('AggregateRoot', () => {
  it('records events and pullEvents returns them in order', () => {
    const agg = new TestAggregate(new UserId('u1'));
    agg.create('item-1');
    agg.update('item-1');
    const events = agg.pullEvents();
    expect(events).toHaveLength(2);
    expect(events[0]).toBeInstanceOf(ItemCreated);
    expect(events[1]).toBeInstanceOf(ItemUpdated);
  });

  it('pullEvents clears the queue (second call returns [])', () => {
    const agg = new TestAggregate(new UserId('u1'));
    agg.create('item-1');
    agg.pullEvents();
    expect(agg.pullEvents()).toHaveLength(0);
  });

  it('starts with an empty event queue', () => {
    const agg = new TestAggregate(new UserId('u1'));
    expect(agg.pullEvents()).toHaveLength(0);
  });
});

// ─── DomainEvent ────────────────────────────────────────────────────────────

describe('DomainEvent', () => {
  it('occurredAt defaults to now when not provided', () => {
    const before = new Date();
    const event = new ItemCreated('x');
    const after = new Date();
    expect(event.occurredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(event.occurredAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it('occurredAt is always a Date instance', () => {
    const event = new ItemCreated('x');
    expect(event.occurredAt).toBeInstanceOf(Date);
  });
});

// ─── Result ─────────────────────────────────────────────────────────────────

describe('Result', () => {
  it('ok wraps a value and success=true', () => {
    const r = ok(42);
    expect(r.success).toBe(true);
    if (r.success) expect(r.value).toBe(42);
  });

  it('fail wraps an error and success=false', () => {
    const r = fail('something went wrong');
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error).toBe('something went wrong');
  });

  it('narrowing works for both branches', () => {
    const results = [ok('hello'), fail('oops')];
    const values: string[] = [];
    const errors: string[] = [];
    for (const r of results) {
      if (r.success) values.push(r.value);
      else errors.push(r.error);
    }
    expect(values).toEqual(['hello']);
    expect(errors).toEqual(['oops']);
  });
});

// ─── Guard ──────────────────────────────────────────────────────────────────

describe('Guard', () => {
  it('againstNullOrUndefined throws on null', () => {
    expect(() => Guard.againstNullOrUndefined(null, 'field')).toThrow(
      DomainException,
    );
  });

  it('againstNullOrUndefined throws on undefined', () => {
    expect(() => Guard.againstNullOrUndefined(undefined, 'field')).toThrow(
      DomainException,
    );
  });

  it('againstNullOrUndefined passes for valid values', () => {
    expect(() => Guard.againstNullOrUndefined('ok', 'field')).not.toThrow();
    expect(() => Guard.againstNullOrUndefined(0, 'field')).not.toThrow();
    expect(() => Guard.againstNullOrUndefined(false, 'field')).not.toThrow();
  });

  it('againstEmptyString throws on empty string', () => {
    expect(() => Guard.againstEmptyString('', 'name')).toThrow(DomainException);
  });

  it('againstEmptyString throws on whitespace-only string', () => {
    expect(() => Guard.againstEmptyString('   ', 'name')).toThrow(
      DomainException,
    );
  });

  it('againstEmptyString passes for non-empty string', () => {
    expect(() => Guard.againstEmptyString('hello', 'name')).not.toThrow();
  });
});

// ─── FixedClock ─────────────────────────────────────────────────────────────

describe('FixedClock', () => {
  it('returns the fixed date on every call', () => {
    const fixed = new Date('2025-06-15T12:00:00Z');
    const clock = new FixedClock(fixed);
    expect(clock.now()).toBe(fixed);
    expect(clock.now()).toBe(fixed);
  });
});

// ─── SystemClock ────────────────────────────────────────────────────────────

describe('SystemClock', () => {
  it('returns a date close to now', () => {
    const before = Date.now();
    const clock = new SystemClock();
    const result = clock.now();
    const after = Date.now();
    expect(result.getTime()).toBeGreaterThanOrEqual(before);
    expect(result.getTime()).toBeLessThanOrEqual(after);
  });
});

// ─── SeqIdGenerator ─────────────────────────────────────────────────────────

describe('SeqIdGenerator', () => {
  it('returns deterministic sequential ids', () => {
    const gen = new SeqIdGenerator();
    expect(gen.uuid()).toBe('id-1');
    expect(gen.uuid()).toBe('id-2');
    expect(gen.uuid()).toBe('id-3');
  });

  it('reset() restarts sequence from 1', () => {
    const gen = new SeqIdGenerator();
    gen.uuid();
    gen.uuid();
    gen.reset();
    expect(gen.uuid()).toBe('id-1');
  });
});

// ─── UuidGenerator ──────────────────────────────────────────────────────────

describe('UuidGenerator', () => {
  it('returns a valid UUID v4 string', () => {
    const gen = new UuidGenerator();
    const id = gen.uuid();
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });

  it('two successive calls return different IDs', () => {
    const gen = new UuidGenerator();
    expect(gen.uuid()).not.toBe(gen.uuid());
  });
});

// ─── DomainException ────────────────────────────────────────────────────────

describe('DomainException', () => {
  it('stores code and message', () => {
    const ex = new DomainException('not found', 'NOT_FOUND', 404);
    expect(ex.message).toBe('not found');
    expect(ex.code).toBe('NOT_FOUND');
    expect(ex.statusCode).toBe(404);
    expect(ex.name).toBe('DomainException');
  });

  it('defaults statusCode to 400', () => {
    const ex = new DomainException('bad', 'BAD');
    expect(ex.statusCode).toBe(400);
  });

  it('is an instance of Error', () => {
    expect(new DomainException('x', 'X')).toBeInstanceOf(Error);
  });
});
