import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Major } from './major.entity';

@Entity('user_major')
export class UserMajor {
  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @PrimaryColumn({ type: 'uuid' })
  major_id: string;

  @CreateDateColumn({ name: 'create_at' })
  create_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.userMajors)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Major, (major) => major.userMajors)
  @JoinColumn({ name: 'major_id' })
  major: Major;
}

