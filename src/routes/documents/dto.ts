import { IsUUID, IsNotEmpty, IsObject, IsOptional, IsNumber } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * DTO for student requesting document
 * Note: user_id is extracted from JWT token, not from request body
 */
export class RequestDocumentDto {
  @ApiProperty({
    description: 'Document type UUID',
    example: '660e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  @IsNotEmpty()
  document_type_id: string;

  @ApiPropertyOptional({
    description: 'Additional metadata (grades, GPA, etc.)',
    example: { gpa: 3.8, major: 'Computer Science' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>; // Grades, GPA, etc.
}

/**
 * DTO for manager approving document
 * Note: issuer_id is extracted from JWT token, not from request body
 */
export class ApproveDocumentDto {
  @ApiProperty({
    description: 'Student blockchain ID',
    example: 12345,
  })
  @IsNumber()
  @IsNotEmpty()
  student_blockchain_id: number; // Student's blockchain ID
}

/**
 * Response DTOs
 */
export class DocumentResponse {
  @ApiProperty({ description: 'Document UUID' })
  document_id: string;

  @ApiProperty({ description: 'Student UUID' })
  user_id: string;

  @ApiProperty({ description: 'Issuer UUID' })
  issuer_id: string;

  @ApiProperty({ description: 'Document type UUID' })
  document_type_id: string;

  @ApiPropertyOptional({ description: 'Blockchain document ID' })
  blockchain_doc_id?: string;

  @ApiPropertyOptional({ description: 'NFT token ID' })
  token_id?: string;

  @ApiPropertyOptional({ description: 'Transaction hash' })
  tx_hash?: string;

  @ApiProperty({ description: 'Smart contract address' })
  contract_address: string;

  @ApiPropertyOptional({ description: 'IPFS hash' })
  ipfs_hash?: string;

  @ApiPropertyOptional({ description: 'Document hash' })
  document_hash?: string;

  @ApiPropertyOptional({ description: 'Additional metadata' })
  metadata?: any;

  @ApiProperty({ description: 'Document status' })
  status: string;

  @ApiProperty({ description: 'Whether the document is valid' })
  is_valid: boolean;

  @ApiPropertyOptional({ description: 'Issuance timestamp' })
  issued_at?: Date;

  @ApiPropertyOptional({ description: 'Verification timestamp' })
  verified_at?: Date;

  @ApiProperty({ description: 'Creation timestamp' })
  created_at: Date;

  @ApiProperty({ description: 'Last update timestamp' })
  updated_at: Date;
}

export class VerifyDocumentResponse {
  @ApiProperty({ description: 'Whether the document is valid' })
  valid: boolean;

  @ApiProperty({ description: 'NFT token ID' })
  tokenId: string;

  @ApiProperty({ description: 'Document owner address' })
  owner: string;

  @ApiProperty({ description: 'Document metadata from blockchain' })
  metadata: {
    studentId: number;
    documentType: string;
    documentHash: string;
    issuedAt: Date;
    issuedBy: string;
    isValid: boolean;
  };
}

