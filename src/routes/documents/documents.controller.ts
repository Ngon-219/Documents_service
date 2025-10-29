import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { RequestDocumentDto, ApproveDocumentDto } from './dto';
import { Public } from '../../auth/decorators/public.decorator';
import { Roles, UserRole } from '../../auth/decorators/roles.decorator';
import { CurrentUser, type CurrentUserData } from '../../auth/decorators/current-user.decorator';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  /**
   * Student requests a document
   * POST /documents/request
   * Auth: Student only
   */
  @Post('request')
  @HttpCode(HttpStatus.CREATED)
  @Roles(UserRole.STUDENT)
  async requestDocument(
    @Body() dto: RequestDocumentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    // Ensure student can only request for themselves
    dto.user_id = user.userId;
    return await this.documentsService.requestDocument(dto);
  }

  /**
   * Manager approves and signs document on blockchain
   * POST /documents/:id/approve
   * Auth: Manager or Admin only
   * Body: { student_blockchain_id }
   */
  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.MANAGER, UserRole.ADMIN)
  async approveDocument(
    @Param('id') documentId: string,
    @Body() dto: ApproveDocumentDto,
    @CurrentUser() user: CurrentUserData,
  ) {
    // Auto-fill issuer_id from JWT token
    dto.issuer_id = user.userId;
    return await this.documentsService.approveAndSignDocument(documentId, dto);
  }

  /**
   * Get student's documents
   * GET /documents/student/:userId
   * Auth: Student (own documents), Manager/Admin (any student)
   */
  @Get('student/:userId')
  @Roles(UserRole.STUDENT, UserRole.MANAGER, UserRole.ADMIN, UserRole.TEACHER)
  async getStudentDocuments(
    @Param('userId') userId: string,
    @CurrentUser() user: CurrentUserData,
  ) {
    // Students can only view their own documents
    if (user.role === UserRole.STUDENT && userId !== user.userId) {
      throw new Error('Students can only view their own documents');
    }
    return await this.documentsService.getStudentDocuments(userId);
  }

  /**
   * Get document by ID
   * GET /documents/:id
   * Auth: Authenticated users
   */
  @Get(':id')
  async getDocument(@Param('id') documentId: string) {
    return await this.documentsService.getDocumentById(documentId);
  }

  /**
   * Verify document by token ID (PUBLIC - no auth required)
   * GET /documents/verify/:tokenId
   */
  @Get('verify/:tokenId')
  @Public()
  async verifyDocument(@Param('tokenId') tokenId: string) {
    return await this.documentsService.verifyDocument(tokenId);
  }

  /**
   * Revoke document
   * PUT /documents/:id/revoke
   * Auth: Admin only
   */
  @Put(':id/revoke')
  @HttpCode(HttpStatus.OK)
  @Roles(UserRole.ADMIN)
  async revokeDocument(@Param('id') documentId: string) {
    return await this.documentsService.revokeDocument(documentId);
  }

  /**
   * Get all document types (PUBLIC - no auth required)
   * GET /documents/types/all
   */
  @Get('types/all')
  @Public()
  async getDocumentTypes() {
    return await this.documentsService.getDocumentTypes();
  }
}

