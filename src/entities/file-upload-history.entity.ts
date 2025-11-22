import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('file_upload_history')
export class FileUploadHistory {
  @PrimaryGeneratedColumn('uuid')
  file_upload_history_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'varchar' })
  file_name: string;

  @Column({ type: 'varchar', length: 16 })
  status: string;

  @CreateDateColumn()
  created_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.fileUploadHistories)
  @JoinColumn({ name: 'user_id' })
  user: User;
}

