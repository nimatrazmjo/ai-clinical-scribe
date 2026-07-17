export const UserRole = {
  Provider: 'provider',
  Admin: 'admin',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const EncounterStatus = {
  Draft: 'draft',
  Finalized: 'finalized',
} as const;
export type EncounterStatus = (typeof EncounterStatus)[keyof typeof EncounterStatus];
