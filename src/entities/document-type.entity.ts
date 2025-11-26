import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Document } from './document.entity';
import { User } from './user.entity';
import { Certificate } from './certificate.entity';

@Entity('document_type')
export class DocumentType {
  @PrimaryGeneratedColumn('uuid')
  document_type_id: string;

  @Column({ unique: true })
  document_type_name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'text', nullable: true })
  template_pdf: string | null;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  @Column({ type: 'uuid', nullable: true })
  created_by: string | null;

  // Relations
  @OneToMany(() => Document, (document) => document.documentType)
  documents: Document[];

  @OneToMany(() => Certificate, (certificate) => certificate.documentType)
  certificates: Certificate[];

  @ManyToOne(() => User, (user) => user.documentTypes)
  @JoinColumn({ name: 'created_by' })
  user: User | null;
}

