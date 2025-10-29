import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { DocumentType } from './document-type.entity';

export enum DocumentStatus {
  DRAFT = 'draft',
  PENDING_APPROVAL = 'pending_approval',
  APPROVED = 'approved',
  PENDING_BLOCKCHAIN = 'pending_blockchain',
  MINTED = 'minted',
  REVOKED = 'revoked',
  FAILED = 'failed',
}

@Entity('documents')
export class Document {
  @PrimaryGeneratedColumn('uuid')
  document_id: string;

  // User references (UUID from auth_service)
  @Column({ type: 'uuid' })
  user_id: string;

  @Column({ type: 'uuid' })
  issuer_id: string;

  @Column({ type: 'uuid' })
  document_type_id: string;

  // Blockchain references
  @Column({ type: 'varchar', length: 66, nullable: true })
  blockchain_doc_id: string; // bytes32 from IssuanceOfDocument

  @Column({ type: 'bigint', nullable: true })
  token_id: string;

  @Column({ type: 'varchar', length: 66, nullable: true })
  tx_hash: string;

  @Column({ type: 'varchar', length: 42 })
  contract_address: string;

  // IPFS
  @Column({ type: 'varchar', nullable: true })
  ipfs_hash: string;

  @Column({ type: 'varchar', length: 66, nullable: true })
  document_hash: string; // SHA256/keccak256 hash

  // Metadata (flexible JSON)
  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  // Status
  @Column({
    type: 'enum',
    enum: DocumentStatus,
    default: DocumentStatus.DRAFT,
  })
  status: DocumentStatus;

  @Column({ type: 'boolean', default: true })
  is_valid: boolean;

  // Dates
  @Column({ type: 'timestamp', nullable: true })
  issued_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  verified_at: Date;

  // Audit
  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // Relations
  @ManyToOne(() => DocumentType, (docType) => docType.documents)
  @JoinColumn({ name: 'document_type_id' })
  documentType: DocumentType;
}

