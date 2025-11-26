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
import { DocumentType } from './document-type.entity';

@Entity('certificate')
export class Certificate {
  @PrimaryGeneratedColumn('uuid')
  certificate_id: string;

  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  document_type_id: string;

  @Column({ type: 'date' })
  issued_date: Date;

  @Column({ type: 'date', nullable: true })
  expiry_date: Date | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any> | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.certificates)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => DocumentType, (documentType) => documentType.certificates)
  @JoinColumn({ name: 'document_type_id' })
  documentType: DocumentType;
}


