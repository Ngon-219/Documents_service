import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('user_mfa')
export class UserMfa {
  @PrimaryGeneratedColumn('uuid')
  mfa_id: string;

  @Column({ type: 'uuid', unique: true })
  user_id: string;

  @Column({ type: 'varchar' })
  secret: string;

  @Column({ type: 'boolean' })
  is_enabled: boolean;

  @Column({ type: 'jsonb', nullable: true })
  backup_codes: string[] | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToOne(() => User, (user) => user.userMfa)
  @JoinColumn({ name: 'user_id' })
  user: User;
}


