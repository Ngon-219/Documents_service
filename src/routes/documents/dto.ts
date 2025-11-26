import { IsUUID, IsNotEmpty, IsObject, IsOptional, IsNumber, IsString, IsEnum, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DocumentStatus } from '../../entities/document.entity';

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

  @ApiProperty({
    description: 'MFA authenticator code (6-digit code from authenticator app)',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  authenticator_code: string;

  @ApiPropertyOptional({
    description: 'Additional metadata (grades, GPA, etc.)',
    example: { gpa: 3.8, major: 'Computer Science' },
  })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>; // Grades, GPA, etc.

  @ApiPropertyOptional({
    description: 'Document type UUID',
    example: '660e8400-e29b-41d4-a716-446655440001',
  })
  @IsUUID()
  @IsOptional()
  certificate_id: string;
}

/**
 * DTO for manager approving document
 * Note: issuer_id is extracted from JWT token, not from request body
 * Note: student wallet address is automatically retrieved from document.user_id via wallets table
 */
export class ApproveDocumentDto {
  @ApiProperty({
    description: 'MFA authenticator code (6-digit code from authenticator app)',
    example: '123456',
  })
  @IsString()
  @IsNotEmpty()
  authenticator_code: string;

  @ApiPropertyOptional({
    description: 'Pdf json schema template (can be large JSON string)',
    example: '{"basePdf": "...", "schemas": [...]}'
  })
  @IsOptional()
  @IsString()
  json_template?: string;
}

export class RejectDocumentDto {
  @ApiProperty({
    description: 'Reason for rejecting the document',
    example: 'Missing prerequisite documents',
  })
  @IsString()
  @IsNotEmpty()
  reason: string;
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

/**
 * Query DTO for listing all documents with pagination and status filter
 */
export class GetAllDocumentsQueryDto {
  @ApiPropertyOptional({
    description: 'Page number (starts from 1)',
    example: 1,
    minimum: 1,
    default: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Number of items per page',
    example: 10,
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 10;

  @ApiPropertyOptional({
    description: 'Filter by document status',
    enum: DocumentStatus,
    example: DocumentStatus.MINTED,
  })
  @IsEnum(DocumentStatus)
  @IsOptional()
  status?: DocumentStatus;

  @ApiPropertyOptional({
    description: 'Sort field',
    example: 'created_at',
    enum: ['created_at', 'updated_at', 'issued_at'],
    default: 'created_at',
  })
  @IsString()
  @IsOptional()
  sort?: string = 'created_at';

  @ApiPropertyOptional({
    description: 'Sort order',
    example: 'DESC',
    enum: ['ASC', 'DESC'],
    default: 'DESC',
  })
  @IsString()
  @IsOptional()
  order?: 'ASC' | 'DESC' = 'DESC';
}

/**
 * Response DTO for paginated documents list
 */
export class PaginatedDocumentsResponse {
  @ApiProperty({ description: 'List of documents', type: [DocumentResponse] })
  data: DocumentResponse[];

  @ApiProperty({ description: 'Total number of documents matching the query' })
  total: number;

  @ApiProperty({ description: 'Current page number' })
  page: number;

  @ApiProperty({ description: 'Number of items per page' })
  limit: number;

  @ApiProperty({ description: 'Total number of pages' })
  totalPages: number;

  @ApiProperty({ description: 'Whether there is a next page' })
  hasNext: boolean;

  @ApiProperty({ description: 'Whether there is a previous page' })
  hasPrev: boolean;
}

