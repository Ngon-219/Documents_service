import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth, 
  ApiParam,
  ApiBody,
} from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { DocumentsService } from './documents.service';
import { RequestDocumentDto, ApproveDocumentDto, DocumentResponse, VerifyDocumentResponse, GetAllDocumentsQueryDto, PaginatedDocumentsResponse } from './dto';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles, UserRole } from '../../auth/decorators/roles.decorator';

// Extend Express Request to include user from JWT
interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    role: UserRole;
  };
}

@ApiTags('documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}
  @Post('request')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.STUDENT)
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Request a document', 
    description: 'Student requests a new document (requires Student role and MFA verification). User ID is automatically extracted from JWT token. MFA authenticator code is required in request body.' 
  })
  @ApiBody({ type: RequestDocumentDto })
  @ApiResponse({ 
    status: 201, 
    description: 'Document requested successfully',
    type: DocumentResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid MFA code or authentication failed' })
  @ApiResponse({ status: 403, description: 'Forbidden - Student role required' })
  async requestDocument(
    @Body() dto: RequestDocumentDto,
    @Req() request: RequestWithUser,
  ) {
    const user_id = request.user.userId;
    return await this.documentsService.requestDocument(user_id, dto);
  }

  /**
   * Manager approves and signs document on blockchain
   * POST /documents/:id/approve
   * Auth: Manager or Admin only (requires MFA verification)
   * Body: { authenticator_code }
   * Note: Student wallet address is automatically retrieved from document.user_id via wallets table
   */
  @Post(':id/approve')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Approve and sign document', 
    description: 'Manager approves document and issues it on blockchain (requires Manager or Admin role and MFA verification). Issuer ID is automatically extracted from JWT token. MFA authenticator code is required. Student wallet address is automatically retrieved from document.user_id via wallets table. Student blockchain ID will be automatically retrieved from DataStorage contract using the wallet address.' 
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiBody({ type: ApproveDocumentDto })
  @ApiResponse({ 
    status: 200, 
    description: 'Document approved and signed successfully',
    type: DocumentResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized - Invalid MFA code or authentication failed' })
  @ApiResponse({ status: 403, description: 'Forbidden - Manager or Admin role required' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async approveDocument(
    @Param('id') documentId: string,
    @Body() dto: ApproveDocumentDto,
    @Req() request: RequestWithUser,
  ) {
    const issuer_id = request.user.userId;
    return await this.documentsService.approveAndSignDocument(documentId, issuer_id, dto);
  }

  /**
   * Get all documents with pagination, filter, and search
   * GET /documents/all
   * Auth: Manager or Admin only
   */
  @Get('all')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get all documents', 
    description: 'Retrieve all documents in the system with pagination and status filter. Documents can be sorted by created_at, updated_at, or issued_at (default: created_at DESC). Only accessible by Manager or Admin.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Paginated list of documents',
    type: PaginatedDocumentsResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Manager or Admin role required' })
  async getAllDocuments(@Query() query: GetAllDocumentsQueryDto): Promise<PaginatedDocumentsResponse> {
    return await this.documentsService.getAllDocuments(query);
  }

  /**
   * Get my documents (current user from JWT)
   * GET /documents/me
   * Auth: Any authenticated user (typically Student)
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get my documents', 
    description: 'Retrieve all documents for the current authenticated user. User ID is automatically extracted from JWT token.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of current user documents',
    type: [DocumentResponse],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getMyDocuments(@Req() request: RequestWithUser) {
    const user_id = request.user.userId;
    return await this.documentsService.getStudentDocuments(user_id);
  }

  /**
   * Get student's documents by userId (Manager/Admin/Teacher only)
   * GET /documents/student/:userId
   * Auth: Manager/Admin/Teacher only
   */
  @Get('student/:userId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.MANAGER, UserRole.ADMIN, UserRole.TEACHER)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get student documents by ID', 
    description: 'Retrieve all documents for a specific student (Manager/Admin/Teacher only)' 
  })
  @ApiParam({ name: 'userId', description: 'Student UUID' })
  @ApiResponse({ 
    status: 200, 
    description: 'List of student documents',
    type: [DocumentResponse],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Manager/Admin/Teacher role required' })
  @ApiResponse({ status: 404, description: 'Student not found' })
  async getStudentDocuments(@Param('userId') userId: string) {
    // Manager/Admin/Teacher can view any student's documents
    return await this.documentsService.getStudentDocuments(userId);
  }

  /**
   * Get document by ID
   * GET /documents/:id
   * Auth: Authenticated users
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Get document by ID', 
    description: 'Retrieve a specific document by its UUID' 
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Document details',
    type: DocumentResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async getDocument(@Param('id') documentId: string) {
    return await this.documentsService.getDocumentById(documentId);
  }

  /**
   * Verify document by token ID (PUBLIC - no auth required)
   * GET /documents/verify/:tokenId
   */
  @Get('verify/:tokenId')
  @ApiOperation({ 
    summary: 'Verify document (Public)', 
    description: 'Verify a document on blockchain using its NFT token ID. No authentication required.' 
  })
  @ApiParam({ name: 'tokenId', description: 'NFT Token ID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Document verification result',
    type: VerifyDocumentResponse,
  })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async verifyDocument(@Param('tokenId') tokenId: string) {
    return await this.documentsService.verifyDocument(tokenId);
  }

  /**
   * Revoke document
   * PUT /documents/:id/revoke
   * Auth: Admin only
   */
  @Put(':id/revoke')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT-auth')
  @ApiOperation({ 
    summary: 'Revoke document', 
    description: 'Revoke a document (requires Admin role)' 
  })
  @ApiParam({ name: 'id', description: 'Document UUID' })
  @ApiResponse({ 
    status: 200, 
    description: 'Document revoked successfully',
    type: DocumentResponse,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin role required' })
  @ApiResponse({ status: 404, description: 'Document not found' })
  async revokeDocument(@Param('id') documentId: string) {
    return await this.documentsService.revokeDocument(documentId);
  }

  // @Get('certificate/preview')
  // @ApiOperation({
  //   summary: 'Generate certificate preview (Public)',
  //   description: 'Generate a sample certificate PDF using the configured template.',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: 'PDF preview generated',
  //   content: {
  //     'application/pdf': {
  //       schema: {
  //         type: 'string',
  //         format: 'binary',
  //       },
  //     },
  //   },
  // })
  // async previewCertificate(@Res({ passthrough: true }) res: Response): Promise<StreamableFile> {
  //   const buffer = await this.documentsService.generateCertificatePreview();
  //   res.set({
  //     'Content-Type': 'application/pdf',
  //     'Content-Disposition': 'inline; filename="certificate-preview.pdf"',
  //   });
  //   return new StreamableFile(buffer);
  // }


  @Get('types/all')
  @ApiOperation({ 
    summary: 'Get document types (Public)', 
    description: 'Retrieve all available document types. No authentication required.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: 'List of all document types',
  })
  async getDocumentTypes() {
    return await this.documentsService.getDocumentTypes();
  }

  /**
   * Download document PDF
   * GET /documents/:id/pdf
   * Auth: Authenticated users
   */
  // @Get(':id/pdf')
  // @UseGuards(JwtAuthGuard)
  // @ApiBearerAuth('JWT-auth')
  // @ApiOperation({ 
  //   summary: 'Download document PDF', 
  //   description: 'Download the PDF certificate for a document from IPFS' 
  // })
  // @ApiParam({ name: 'id', description: 'Document UUID' })
  // @ApiResponse({ 
  //   status: 200, 
  //   description: 'PDF file',
  //   content: {
  //     'application/pdf': {
  //       schema: {
  //         type: 'string',
  //         format: 'binary',
  //       },
  //     },
  //   },
  // })
  // @ApiResponse({ status: 401, description: 'Unauthorized' })
  // @ApiResponse({ status: 404, description: 'Document or PDF not found' })
  // async downloadPdf(
  //   @Param('id') documentId: string,
  //   @Res({ passthrough: true }) res: Response,
  // ): Promise<StreamableFile> {
  //   const { buffer, ipfsHash } = await this.documentsService.getDocumentPdf(documentId);
    
  //   // Set response headers
  //   res.set({
  //     'Content-Type': 'application/pdf',
  //     'Content-Disposition': `attachment; filename="document-${documentId}.pdf"`,
  //     'X-IPFS-Hash': ipfsHash,
  //   });
    
  //   return new StreamableFile(buffer);
  // }
}

