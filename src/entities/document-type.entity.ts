import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Document } from './document.entity';

@Entity('document_type')
export class DocumentType {
  @PrimaryGeneratedColumn('uuid')
  document_type_id: string;

  @Column({ unique: true })
  document_type_name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @OneToMany(() => Document, (document) => document.documentType)
  documents: Document[];
}

