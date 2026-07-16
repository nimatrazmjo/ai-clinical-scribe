export { DomainException } from './domain.exception';
export { DomainEvent } from './domain-event';
export { ValueObject } from './value-object';
export { UniqueId } from './unique-id';
export { Entity } from './entity';
export { AggregateRoot } from './aggregate-root';
export type { Result } from './result';
export { ok, fail } from './result';
export { Guard } from './guard';
export {
  UserId,
  PatientId,
  EncounterId,
  NoteVersionId,
  TemplateId,
  AuditId,
} from './ids';
export type { Clock } from './ports/clock.port';
export type { IdGenerator } from './ports/id-generator.port';
export { SystemClock } from './implementations/system-clock';
export { UuidGenerator } from './implementations/uuid-generator';
export { FixedClock } from './test-doubles/fixed-clock';
export { SeqIdGenerator } from './test-doubles/seq-id-generator';
export { CLOCK, ID_GENERATOR } from './tokens';
