import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { VotingEvents } from './voting-events.entity';

@Entity('votes')
export class Vote {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'bigint' })
  event_id: number;

  @Column({ type: 'uuid' })
  voting_event_id: string;

  @Column({ type: 'varchar' })
  user_address: string;

  @Column({ type: 'uuid', nullable: true })
  user_id: string | null;

  @Column({ type: 'varchar' })
  option: string;

  @Column({ type: 'varchar', nullable: true })
  tx_hash: string | null;

  @Column({ type: 'bigint', nullable: true })
  block_number: number | null;

  @Column({ type: 'timestamp' })
  voted_at: Date;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => VotingEvents, (votingEvent) => votingEvent.votes)
  @JoinColumn({ name: 'voting_event_id' })
  votingEvent: VotingEvents;
}


