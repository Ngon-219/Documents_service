import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { RequestStatus } from './enums';
import { User } from './user.entity';

@Entity('request')
export class Request {
  @PrimaryGeneratedColumn('uuid')
  request_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'enum',
    enum: RequestStatus,
  })
  status: RequestStatus;

  @Column({ type: 'timestamp', nullable: true })
  scheduled_at: Date | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.requests)
  @JoinColumn({ name: 'user_id' })
  user: User;
}


