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

@Entity('score_board')
export class ScoreBoard {
  @PrimaryGeneratedColumn('uuid')
  score_board_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  course_id: string;

  @Column({ type: 'varchar' })
  course_name: string;

  @Column({ type: 'varchar', nullable: true })
  course_code: string | null;

  @Column({ type: 'int' })
  credits: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score1: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score2: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score3: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score4: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score5: number | null;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: true })
  score6: number | null;

  @Column({ type: 'varchar', nullable: true })
  letter_grade: string | null;

  @Column({ type: 'varchar', nullable: true })
  status: string | null;

  @Column({ type: 'varchar' })
  semester: string;

  @Column({ type: 'varchar', nullable: true })
  academic_year: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.scoreBoards)
  @JoinColumn({ name: 'user_id' })
  user: User;
}


