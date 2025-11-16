import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('wallet')
export class Wallet {
  @PrimaryGeneratedColumn('uuid')
  wallet_id: string;

  @Column({ type: 'uuid', unique: true })
  user_id: string;

  @Column({ type: 'varchar', length: 42 })
  address: string;

  @Column({ type: 'text' })
  private_key: string;

  @Column({ type: 'varchar' })
  chain_type: string;

  @Column({ type: 'text' })
  public_key: string;

  @Column({ type: 'varchar' })
  status: string;

  @Column({ type: 'varchar' })
  network_id: string;

  @Column({ type: 'timestamp', nullable: true })
  last_used_at: Date;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}

