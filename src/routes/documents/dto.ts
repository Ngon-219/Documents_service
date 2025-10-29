import { IsUUID, IsNotEmpty, IsObject, IsOptional, IsNumber } from 'class-validator';

/**
 * DTO for student requesting document
 */
export class RequestDocumentDto {
  @IsUUID()
  @IsOptional() // Auto-filled from JWT token
  user_id?: string; // Student UUID

  @IsUUID()
  @IsNotEmpty()
  document_type_id: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>; // Grades, GPA, etc.
}

/**
 * DTO for manager approving document
 */
export class ApproveDocumentDto {
  @IsUUID()
  @IsOptional() // Auto-filled from JWT token
  issuer_id?: string; // Manager UUID

  @IsNumber()
  @IsNotEmpty()
  student_blockchain_id: number; // Student's blockchain ID
}

/**
 * Response DTOs
 */
export class DocumentResponse {
  document_id: string;
  user_id: string;
  issuer_id: string;
  document_type_id: string;
  blockchain_doc_id?: string;
  token_id?: string;
  tx_hash?: string;
  contract_address: string;
  ipfs_hash?: string;
  document_hash?: string;
  metadata?: any;
  status: string;
  is_valid: boolean;
  issued_at?: Date;
  verified_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export class VerifyDocumentResponse {
  valid: boolean;
  tokenId: string;
  owner: string;
  metadata: {
    studentId: number;
    documentType: string;
    documentHash: string;
    issuedAt: Date;
    issuedBy: string;
    isValid: boolean;
  };
}

