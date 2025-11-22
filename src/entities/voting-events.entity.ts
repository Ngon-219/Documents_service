import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Vote } from './votes.entity';

@Entity('voting_events')
export class VotingEvents {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint', unique: true })
  event_id: number;

  @Column({ type: 'varchar' })
  event_name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'timestamp', name: 'created_at' })
  created_at: Date;

  @Column({ type: 'timestamp' })
  end_time: Date;

  @Column({ type: 'varchar' })
  created_by_address: string;

  @Column({ type: 'uuid', nullable: true })
  created_by_user_id: string | null;

  @Column({ type: 'text', array: true })
  options: string[];

  @Column({ type: 'boolean' })
  is_active: boolean;

  @Column({ type: 'int' })
  total_votes: number;

  @Column({ type: 'varchar', nullable: true })
  tx_hash: string | null;

  @Column({ type: 'timestamp', nullable: true })
  synced_at: Date | null;

  @CreateDateColumn({ name: 'created_at_db' })
  created_at_db: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @OneToMany(() => Vote, (vote) => vote.votingEvent)
  votes: Vote[];
}

