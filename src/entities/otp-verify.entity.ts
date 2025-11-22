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

@Entity('otp_verify')
export class OtpVerify {
  @PrimaryGeneratedColumn('uuid')
  otp_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  otp_code: string;

  @Column({ type: 'varchar' })
  email: string;

  @Column({ type: 'varchar' })
  purpose: string;

  @Column({ type: 'boolean' })
  is_verified: boolean;

  @Column({ type: 'timestamp' })
  expires_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.otpVerifies)
  @JoinColumn({ name: 'user_id' })
  user: User;
}

