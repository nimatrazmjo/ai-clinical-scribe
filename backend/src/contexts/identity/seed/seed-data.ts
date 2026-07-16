import { UserRole } from '../user.entity';

// DEMO CREDENTIALS ONLY — never use real passwords here
export const DEMO_USERS = [
  {
    email: 'dr.alice@demo.clinic',
    firstName: 'Alice',
    lastName: 'Demo',
    role: UserRole.PROVIDER,
    password: 'DemoPass1!',
  },
  {
    email: 'dr.bob@demo.clinic',
    firstName: 'Bob',
    lastName: 'Demo',
    role: UserRole.PROVIDER,
    password: 'DemoPass2!',
  },
  {
    email: 'dr.carol@demo.clinic',
    firstName: 'Carol',
    lastName: 'Demo',
    role: UserRole.PROVIDER,
    password: 'DemoPass3!',
  },
  {
    email: 'admin@demo.clinic',
    firstName: 'Admin',
    lastName: 'Demo',
    role: UserRole.ADMIN,
    password: 'AdminPass1!',
  },
] as const;
