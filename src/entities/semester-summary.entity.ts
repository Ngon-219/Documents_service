import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('semester_summary')
export class SemesterSummary {
  @PrimaryGeneratedColumn('uuid')
  summary_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  semester: string;

  @Column({ type: 'varchar' })
  academic_year: string;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  gpa: number;

  @Column({ type: 'varchar', nullable: true })
  classification: string | null;

  @Column({ type: 'int', nullable: true })
  total_credits: number | null;

  @Column({ type: 'int', nullable: true })
  total_passed_credits: number | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.semesterSummaries)
  @JoinColumn({ name: 'user_id' })
  user: User;
}

