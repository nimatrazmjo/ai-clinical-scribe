import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity('patients')
export class PatientEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'first_name' })
  firstName: string;

  @Column({ name: 'last_name' })
  lastName: string;

  @Column({ name: 'date_of_birth', length: 10 })
  dateOfBirth: string;

  @Column({ name: 'match_key', unique: true })
  matchKey: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
