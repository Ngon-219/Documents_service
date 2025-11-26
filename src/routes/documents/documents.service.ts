import { Injectable, Logger, NotFoundException, BadRequestException, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DeepPartial } from 'typeorm';
import { Document, DocumentStatus } from '../../entities/document.entity';
import { DocumentType } from '../../entities/document-type.entity';
import { Wallet } from '../../entities/wallet.entity';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IPFSService } from '../../blockchain/ipfs.service';
import { DocumentData, PdfServiceService, PdfTemplatePayload } from '../../pdf_service/pdf_service.service';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { RequestDocumentDto, ApproveDocumentDto, RejectDocumentDto, GetAllDocumentsQueryDto, PaginatedDocumentsResponse, CertificateResponse } from './dto';
import { MfaService } from '../../grpc/mfa.service';
import { User } from 'src/entities/user.entity';
import { Certificate } from 'src/entities/certificate.entity';
import { ScoreBoard } from '../../entities/score-board.entity';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(DocumentType)
    private documentTypeRepository: Repository<DocumentType>,
    @InjectRepository(Wallet)
    private walletRepository: Repository<Wallet>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Certificate)
    private certificateReposioty: Repository<Certificate>,
    @InjectRepository(ScoreBoard)
    private scoreBoardRepository: Repository<ScoreBoard>,
    private blockchainService: BlockchainService,
    private ipfsService: IPFSService,
    private pdfService: PdfServiceService,
    private configService: ConfigService,
    private mfaService: MfaService,
  ) {}

  async requestDocument(userId: string, dto: RequestDocumentDto): Promise<Document> {
    this.logger.log(
      `Student ${userId} requesting document type ${dto.document_type_id}`,
    );

    let userInfor = await this.userRepository.findOne({
      where: {user_id: userId}
    });

    if (!userInfor) {
      throw new UnauthorizedException('User not found');
    }

    this.logger.log(`Verifying MFA code for user ${userId}`);
    try {
      const mfaResult = await this.mfaService.verifyMfaCode(
        userId,
        dto.authenticator_code,
      );

      if (!mfaResult.is_valid) {
        this.logger.warn(`MFA verification failed for user ${userId}: ${mfaResult.reason}`);
        
        if (mfaResult.locked_until) {
          const lockedUntil = new Date(mfaResult.locked_until * 1000);
          throw new ForbiddenException(
            `MFA verification failed. Account locked until ${lockedUntil.toISOString()}. Reason: ${mfaResult.reason}`,
          );
        }

        throw new ForbiddenException(
          `MFA verification failed: ${mfaResult.reason || mfaResult.message}`,
        );
      }

      this.logger.log(`✅ MFA verification successful for user ${userId}`);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(`Failed to verify MFA code for user ${userId}`, error);
      throw new BadRequestException(
        `MFA verification failed: ${error.message}`,
      );
    }

    const documentType = await this.documentTypeRepository.findOne({
      where: { document_type_id: dto.document_type_id },
    });

    if (!documentType) {
      throw new NotFoundException('Document type not found');
    }

    let pdfTemplate: PdfTemplatePayload | null = null;

    switch (documentType.document_type_name) {
      case 'Certificate':
      case 'Diploma': {
        let my_cerfificate = await this.certificateReposioty.findOne({
          where: { certificate_id: dto.certificate_id },
        });

        if (!my_cerfificate) {
          throw new NotFoundException('certificate type not found');
        }

        const documenType = await this.documentTypeRepository.findOne({
          where: { document_type_id: my_cerfificate?.document_type_id },
        });

        if (!documenType) {
          throw new NotFoundException('document type not found');
        }

        const data: DocumentData = {
          documentTypeName: documenType.document_type_name,
          issuerName: '',
          studentName: `${userInfor.last_name} ${userInfor.first_name}`,
          description: my_cerfificate?.description || '',
          expiry_date: my_cerfificate.expiry_date?.toString() || '',
          issued_date: my_cerfificate.issued_date?.toString() || '',
          metadata: my_cerfificate?.metadata || {},
          documentType: documentType,
          qr_code: '',
        };

        pdfTemplate = await this.pdfService.generateCertificate(data);
        break;
      }

      case 'Transcript': {
        const scoreBoards = await this.scoreBoardRepository.find({
          where: { user_id: userId },
          order: {
            academic_year: 'ASC',
            semester: 'ASC',
            course_name: 'ASC',
          },
        });

        if (!scoreBoards.length) {
          throw new NotFoundException('scoreboard not found for this student');
        }

        const transcriptRows = scoreBoards.map((score) => {
          const finalScore =
            score.score6 ??
            score.score5 ??
            score.score4 ??
            score.score3 ??
            score.score2 ??
            score.score1 ??
            null;

          return {
            courseName: score.course_name,
            courseCode: score.course_code,
            credits: score.credits,
            semester: score.semester,
            academicYear: score.academic_year,
            finalScore,
            letterGrade: score.letter_grade,
            status: score.status,
            rawScores: {
              score1: score.score1,
              score2: score.score2,
              score3: score.score3,
              score4: score.score4,
              score5: score.score5,
              score6: score.score6,
            },
            metadata: score.metadata,
          };
        });

        const totalCredits = transcriptRows.reduce(
          (sum, row) => sum + (row.credits || 0),
          0,
        );

        const weightedScore = transcriptRows.reduce((sum, row) => {
          if (typeof row.finalScore === 'number') {
            return sum + row.finalScore * (row.credits || 0);
          }
          return sum;
        }, 0);

        const gpa =
          totalCredits > 0
            ? Number((weightedScore / totalCredits).toFixed(2))
            : null;

        const transcriptMetadata = {
          ...(dto.metadata || {}),
          scoreboard: transcriptRows,
          summary: {
            totalCredits,
            gpa,
            totalSubjects: transcriptRows.length,
          },
        };

        const data: DocumentData = {
          documentTypeName: documentType.document_type_name,
          issuerName: '',
          studentName: `${userInfor.last_name} ${userInfor.first_name}`,
          description: 'Bảng điểm tổng hợp',
          expiry_date: '',
          issued_date: new Date().toISOString(),
          metadata: transcriptMetadata,
          documentType,
          qr_code: '',
        };

        pdfTemplate = await this.pdfService.generateTranscript(data);
        break;
      }
    }

    const documentPayload: DeepPartial<Document> = {
      user_id: userId,
      document_type_id: dto.document_type_id,
      issuer_id: userId,
      metadata: dto.metadata || {},
      pdf_schema: pdfTemplate
        ? (pdfTemplate as unknown as Record<string, any>)
        : undefined,
      status: DocumentStatus.DRAFT,
      is_valid: false,
      contract_address:
        this.configService.get<string>('ISSUANCE_CONTRACT_ADDRESS'),
    };

    const document = this.documentRepository.create(documentPayload);

    return await this.documentRepository.save(document);
  }

  async approveAndSignDocument(
    documentId: string,
    issuerId: string,
    dto: ApproveDocumentDto,
  ): Promise<Document> {
    this.logger.log(`Manager ${issuerId} approving document ${documentId}`);

    const issuer_info = await this.userRepository.findOne({
      where: { user_id: issuerId },
    });

    if (!issuer_info) {
      throw new NotFoundException('Issuer not found');
    }

    this.logger.log(`Verifying MFA code for issuer ${issuerId}`);
    try {
      const mfaResult = await this.mfaService.verifyMfaCode(
        issuerId,
        dto.authenticator_code,
      );

      if (!mfaResult.is_valid) {
        this.logger.warn(
          `MFA verification failed for issuer ${issuerId}: ${mfaResult.reason}`,
        );

        if (mfaResult.locked_until) {
          const lockedUntil = new Date(mfaResult.locked_until * 1000);
          throw new ForbiddenException(
            `MFA verification failed. Account locked until ${lockedUntil.toISOString()}. Reason: ${mfaResult.reason}`,
          );
        }

        throw new ForbiddenException(
          `MFA verification failed: ${mfaResult.reason || mfaResult.message}`,
        );
      }

      this.logger.log(
        `✅ MFA verification successful for issuer ${issuerId}`,
      );
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      this.logger.error(
        `Failed to verify MFA code for issuer ${issuerId}`,
        error,
      );
      throw new BadRequestException(
        `MFA verification failed: ${error.message}`,
      );
    }

    const document = await this.documentRepository.findOne({
      where: { document_id: documentId },
      relations: ['documentType'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (
      document.status !== DocumentStatus.DRAFT &&
      document.status !== DocumentStatus.PENDING_APPROVAL
    ) {
      throw new BadRequestException(
        `Cannot approve document with status: ${document.status}. Only DRAFT or PENDING_APPROVAL documents can be approved.`,
      );
    }

    this.logger.log(`Getting wallet address for user: ${document.user_id}`);
    const wallet = await this.walletRepository.findOne({
      where: { user_id: document.user_id },
    });

    if (!wallet) {
      throw new NotFoundException(
        `Wallet not found for user ${document.user_id}. Student must have a wallet registered.`,
      );
    }

    if (!wallet.address) {
      throw new BadRequestException(
        `Wallet address is missing for user ${document.user_id}`,
      );
    }

    const studentWalletAddress = wallet.address;
    const student_info_db = await this.userRepository
      .createQueryBuilder('user')
      .innerJoin('user.wallet', 'wallet')
      .where('wallet.address = :address', { address: studentWalletAddress })
      .getOne();

    if (!student_info_db) {
      throw new NotFoundException(
        `Student info not found for wallet address ${studentWalletAddress}`,
      );
    }

    this.logger.log(
      `✅ Wallet address found: ${studentWalletAddress} for user ${document.user_id}`,
    );

    let studentBlockchainId: number;
    let studentInfo: any;
    try {
      studentBlockchainId =
        await this.blockchainService.getStudentIdByAddress(
          studentWalletAddress,
        );
      this.logger.log(`✅ Student blockchain ID found: ${studentBlockchainId}`);

      studentInfo = await this.blockchainService.getStudentInfo(
        studentBlockchainId,
      );
      if (!studentInfo.isActive) {
        throw new BadRequestException(
          `Student with ID ${studentBlockchainId} is not active`,
        );
      }
      this.logger.log(
        `✅ Student is active: ${studentInfo.fullName} (${studentInfo.studentCode})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to get student ID for wallet ${studentWalletAddress}`,
        error,
      );
      if (error instanceof BadRequestException) {
        throw error;
      }
      throw new BadRequestException(
        `Invalid student wallet address: ${error.message}`,
      );
    }

    document.status = DocumentStatus.PENDING_BLOCKCHAIN;
    document.issuer_id = issuerId;
    await this.documentRepository.save(document);

    const currentPdfSchema = document.pdf_schema as
      | PdfTemplatePayload
      | undefined;

    let pdfPayload: PdfTemplatePayload | null = null;

    if (dto.json_template) {
      try {
        const parsedTemplate = JSON.parse(dto.json_template);
        if (parsedTemplate.template && parsedTemplate.inputs) {
          pdfPayload = parsedTemplate;
        } else {
          pdfPayload = {
            template: parsedTemplate.template ?? parsedTemplate,
            inputs:
              parsedTemplate.inputs ??
              currentPdfSchema?.inputs ??
              [],
          };
        }
      } catch (error) {
        this.logger.error('Failed to parse json_template', error);
        throw new BadRequestException(
          'json_template must be valid JSON string',
        );
      }
    } else if (currentPdfSchema) {
      pdfPayload = currentPdfSchema;
    }

    if (!pdfPayload?.template) {
      throw new BadRequestException('PDF template schema is missing');
    }

    if (!pdfPayload.inputs || pdfPayload.inputs.length === 0) {
      throw new BadRequestException(
        'PDF template inputs are missing. Please provide inputs when requesting document.',
      );
    }

    const isSimpleTemplate =
      document.documentType.document_type_name === 'Certificate' ||
      document.documentType.document_type_name === 'Diploma';

    // For Certificate & Diploma: keep all fields except we still enforce QR_CODE = document_id.
    // For other types (e.g. Transcript), also enrich with student/issuer info.
    pdfPayload.inputs = pdfPayload.inputs.map((input) => {
      const updated = { ...input };

      if (!isSimpleTemplate) {
        if ('studentName' in updated) {
          updated.studentName = `${student_info_db.last_name} ${student_info_db.first_name}`;
        }
        if ('issuerName' in updated) {
          updated.issuerName = `${issuer_info.first_name} ${issuer_info.last_name}`;
        }
        if ('signature' in updated) {
          updated.signature = `${issuer_info.first_name} ${issuer_info.last_name}`;
        }
        if ('details' in updated && document.metadata) {
          updated.details =
            typeof document.metadata === 'object'
              ? JSON.stringify(document.metadata)
              : document.metadata;
        }
      }

      // Always make QR code carry document_id if the field exists in template
      if ('QR_CODE' in updated) {
        updated.QR_CODE = document.document_id;
      }

      return updated;
    });

    document.pdf_schema = pdfPayload as Record<string, any>;
    await this.documentRepository.save(document);

    try {
      this.logger.log(
        `Starting blockchain process for document ${documentId}`,
      );

      this.logger.log('📄 Generating PDF via pdfme...');
      const pdfBuffer = await this.pdfService.generatePdfBuffer(pdfPayload);

      this.logger.log('📤 Uploading PDF to IPFS...');
      const pdfFileName = `document-${documentId}.pdf`;
      const pdfIpfsHash = await this.ipfsService.uploadFile(
        pdfBuffer,
        pdfFileName,
        {
          documentId: documentId,
          documentType: document.documentType.document_type_name,
          studentId: document.user_id,
        },
      );
      this.logger.log(`✅ PDF uploaded to IPFS: ${pdfIpfsHash}`);

      const certificateMetadata = {
        name: `${document.documentType.document_type_name} - ${student_info_db.last_name} ${student_info_db.first_name}`,
        description:
          document.documentType.description ||
          'Educational credential issued via Document Service',
        image: `https://gateway.pinata.cloud/ipfs/${pdfIpfsHash}`,
        attributes: [
          { trait_type: 'Loại văn bằng', value: document.documentType.document_type_name },
          { trait_type: 'Mã sinh viên', value: student_info_db.student_code || 'N/A' },
          { trait_type: 'Ngành học', value: document.metadata?.major || 'N/A' },
          { trait_type: 'Ngày cấp', value: new Date().toISOString().split('T')[0] },
          { trait_type: 'Trạng thái', value: 'Còn hiệu lực' },
        ],
      };

      this.logger.log('Metadata prepared, uploading to IPFS...');
      const ipfsHash = await this.ipfsService.uploadMetadata(certificateMetadata);
      const tokenURI = `ipfs://${ipfsHash}`;

      this.logger.log(`IPFS upload successful: ${ipfsHash}`);

      const documentHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(certificateMetadata)),
      );
      this.logger.log(`Document hash generated: ${documentHash}`);

      this.logger.log('Signing document on blockchain...');
      const { txHash, blockchainDocId, tokenId } =
        await this.blockchainService.signDocument(
          studentBlockchainId,
          document.documentType.document_type_name,
          documentHash,
          tokenURI,
        );

      this.logger.log(`Document signed successfully!`);
      this.logger.log(`- Transaction Hash: ${txHash}`);
      this.logger.log(`- Blockchain Doc ID: ${blockchainDocId}`);
      this.logger.log(`- NFT Token ID: ${tokenId}`);

      document.tx_hash = txHash;
      document.blockchain_doc_id = blockchainDocId;
      document.token_id = tokenId;
      document.ipfs_hash = ipfsHash;
      document.pdf_ipfs_hash = pdfIpfsHash;
      document.document_hash = documentHash;
      document.status = DocumentStatus.MINTED;
      document.is_valid = true;
      document.issued_at = new Date();
      document.verified_at = new Date();

      const savedDocument = await this.documentRepository.save(document);

      this.logger.log(
        `✅ Document ${documentId} successfully minted as NFT!`,
      );

      return savedDocument;
    } catch (error) {
      this.logger.error('❌ Failed to sign document on blockchain', error);

      document.status = DocumentStatus.FAILED;
      await this.documentRepository.save(document);

      throw new BadRequestException(
        `Failed to mint document on blockchain: ${error.message}`,
      );
    }
  }

  /**
   * Get all documents with pagination and status filter (Manager/Admin only)
   * Default sorted by created_at DESC (newest first)
   */
  async getAllDocuments(query: GetAllDocumentsQueryDto): Promise<PaginatedDocumentsResponse> {
    const { page = 1, limit = 10, status, sort = 'created_at', order = 'DESC' } = query;

    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.documentType', 'documentType');

    // Filter by status if provided
    if (status) {
      queryBuilder.andWhere('document.status = :status', { status });
    }

    // Validate sort field and apply sorting
    const validSortFields = ['created_at', 'updated_at', 'issued_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    queryBuilder.orderBy(`document.${sortField}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [documents, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: documents,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Get student's documents
   */
  async getStudentDocuments(userId: string): Promise<Document[]> {
    return await this.documentRepository.find({
      where: { user_id: userId },
      relations: ['documentType'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Get current user's documents with pagination and filtering
   * Similar to getAllDocuments but filtered by user_id from JWT
   */
  async getMyDocuments(userId: string, query: GetAllDocumentsQueryDto): Promise<PaginatedDocumentsResponse> {
    const { page = 1, limit = 10, status, sort = 'created_at', order = 'DESC' } = query;

    const queryBuilder = this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.documentType', 'documentType')
      .where('document.user_id = :userId', { userId });

    // Filter by status if provided
    if (status) {
      queryBuilder.andWhere('document.status = :status', { status });
    }

    // Validate sort field and apply sorting
    const validSortFields = ['created_at', 'updated_at', 'issued_at'];
    const sortField = validSortFields.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    queryBuilder.orderBy(`document.${sortField}`, sortOrder);

    // Pagination
    const skip = (page - 1) * limit;
    queryBuilder.skip(skip).take(limit);

    // Execute query
    const [documents, total] = await queryBuilder.getManyAndCount();

    const totalPages = Math.ceil(total / limit);

    return {
      data: documents,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrev: page > 1,
    };
  }

  /**
   * Get document by ID
   */
  async getDocumentById(documentId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { document_id: documentId },
      relations: ['documentType'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    return document;
  }

  /**
   * Get public document information by document_id (for QR code verification)
   * Returns full information including student, issuer, and document type
   */
  async getPublicDocumentInfo(documentId: string): Promise<any> {
    this.logger.log(`Getting public document info for document_id: ${documentId}`);

    const document = await this.documentRepository
      .createQueryBuilder('document')
      .leftJoinAndSelect('document.documentType', 'documentType')
      .where('document.document_id = :documentId', { documentId })
      .getOne();

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    // Get student information
    const student = await this.userRepository.findOne({
      where: { user_id: document.user_id },
      relations: ['wallet'],
    });

    // Get issuer information
    const issuer = await this.userRepository.findOne({
      where: { user_id: document.issuer_id },
    });

    // Get blockchain verification if token_id exists
    let blockchainVerification: {
      owner: string;
      isValid: boolean;
      metadata: any;
    } | null = null;
    if (document.token_id) {
      try {
        blockchainVerification = await this.blockchainService.verifyNFT(document.token_id);
      } catch (error) {
        this.logger.warn(`Failed to verify on blockchain for token_id ${document.token_id}:`, error);
      }
    }

    return {
      document: {
        document_id: document.document_id,
        document_type_id: document.document_type_id,
        document_type_name: document.documentType?.document_type_name || null,
        status: document.status,
        is_valid: document.is_valid,
        created_at: document.created_at,
        updated_at: document.updated_at,
        issued_at: document.issued_at,
        verified_at: document.verified_at,
        blockchain_doc_id: document.blockchain_doc_id,
        token_id: document.token_id,
        tx_hash: document.tx_hash,
        contract_address: document.contract_address,
        ipfs_hash: document.ipfs_hash,
        pdf_ipfs_hash: document.pdf_ipfs_hash,
        document_hash: document.document_hash,
        metadata: document.metadata,
      },
      student: student ? {
        user_id: student.user_id,
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email,
        student_code: student.student_code,
        phone_number: student.phone_number,
        address: student.address,
        cccd: student.cccd,
        wallet_address: student.wallet?.address || null,
      } : null,
      issuer: issuer ? {
        user_id: issuer.user_id,
        first_name: issuer.first_name,
        last_name: issuer.last_name,
        email: issuer.email,
        role: issuer.role,
      } : null,
      blockchain: blockchainVerification ? {
        owner: blockchainVerification.owner,
        isValid: blockchainVerification.isValid,
        metadata: blockchainVerification.metadata,
      } : null,
    };
  }

  /**
   * Verify document on blockchain
   */
  async verifyDocument(tokenId: string): Promise<any> {
    this.logger.log(`Verifying document with tokenId: ${tokenId}`);

    // Get from database
    const document = await this.documentRepository.findOne({
      where: { token_id: tokenId },
      relations: ['documentType'],
    });

    // Verify on blockchain
    const blockchainData = await this.blockchainService.verifyNFT(tokenId);

    // Cross-verify
    const isValid =
      blockchainData.isValid &&
      (!document || document.document_hash === blockchainData.metadata.documentHash);

    // Update verified_at if found in DB
    if (document) {
      document.verified_at = new Date();
      document.is_valid = blockchainData.isValid;
      await this.documentRepository.save(document);
    }

    return {
      valid: isValid,
      tokenId,
      owner: blockchainData.owner,
      metadata: blockchainData.metadata,
      database: document
        ? {
            documentId: document.document_id,
            userId: document.user_id,
            type: document.documentType.document_type_name,
            issuedAt: document.issued_at,
          }
        : null,
    };
  }

  /**
   * Revoke document
   */
  async revokeDocument(documentId: string): Promise<Document> {
    const document = await this.documentRepository.findOne({
      where: { document_id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!document.blockchain_doc_id) {
      throw new Error('Document not on blockchain');
    }

    // Revoke on blockchain
    const txHash = await this.blockchainService.revokeDocument(
      document.blockchain_doc_id,
    );

    // Update document
    document.status = DocumentStatus.REVOKED;
    document.is_valid = false;
    document.tx_hash = txHash;
    document.verified_at = new Date();

    return await this.documentRepository.save(document);
  }

  async rejectDocument(
    documentId: string,
    issuerId: string,
    dto: RejectDocumentDto,
  ): Promise<Document> {
    this.logger.log(`Manager ${issuerId} rejecting document ${documentId}`);

    const document = await this.documentRepository.findOne({
      where: { document_id: documentId },
      relations: ['documentType'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    const rejectableStatuses = [
      DocumentStatus.DRAFT,
      DocumentStatus.PENDING_APPROVAL,
    ];

    if (!rejectableStatuses.includes(document.status)) {
      throw new BadRequestException(
        `Cannot reject document with status: ${document.status}. Only DRAFT or PENDING_APPROVAL documents can be rejected.`,
      );
    }

    document.status = DocumentStatus.REJECTED;
    document.issuer_id = issuerId;
    document.is_valid = false;
        const rejectionMetadata = {
          ...(document.metadata || {}),
          rejection_reason: dto.reason,
          rejection_at: new Date().toISOString(),
        };
        document.metadata = rejectionMetadata;

    return await this.documentRepository.save(document);
  }

  /**
   * Get all document types
   */
  async getDocumentTypes(): Promise<DocumentType[]> {
    return await this.documentTypeRepository.find();
  }

  // async generateCertificatePreview(): Promise<Buffer> {
  //   // Get the first available document type for preview
  //   const documentTypes = await this.documentTypeRepository.find({
  //     take: 1,
  //   });
    
  //   const documentType = documentTypes[0];

  //   if (!documentType) {
  //     throw new NotFoundException('No document types available for preview');
  //   }

  //   // Create mock data for preview
  //   const mockDocument = this.documentRepository.create({
  //     document_id: 'preview',
  //     user_id: 'preview',
  //     document_type_id: documentType.document_type_id,
  //     metadata: { preview: true },
  //   });

  //   const mockData = {
  //     document: mockDocument,
  //     documentType: documentType,
  //     studentName: 'Nguyễn Văn A',
  //     issuerName: 'Hệ thống một cửa',
  //   };

  //   return await this.pdfService.generateCertificate(mockData, documentType.document_type_id);
  // }

  /**
   * Get PDF file from IPFS
   * @param documentId Document UUID
   * @returns PDF buffer and IPFS hash
   */
  // async getDocumentPdf(documentId: string): Promise<{ buffer: Buffer; ipfsHash: string }> {
  //   const document = await this.documentRepository.findOne({
  //     where: { document_id: documentId },
  //   });

  //   if (!document) {
  //     throw new NotFoundException('Document not found');
  //   }

  //   if (!document.pdf_ipfs_hash) {
  //     throw new NotFoundException('PDF not available for this document');
  //   }

  //   // For mock mode, we can regenerate the PDF
  //   if (this.configService.get<string>('USE_MOCK_IPFS') === 'true') {
  //     this.logger.warn('Mock mode: Regenerating PDF instead of downloading from IPFS');
  //     const documentWithRelations = await this.documentRepository.findOne({
  //       where: { document_id: documentId },
  //       relations: ['documentType'],
  //     });
      
  //     if (!documentWithRelations) {
  //       throw new NotFoundException('Document not found');
  //     }
      
  //     const pdfBuffer = await this.pdfService.generatePdf({
  //       document: documentWithRelations,
  //       documentType: documentWithRelations.documentType,
  //     });
      
  //     return {
  //       buffer: pdfBuffer,
  //       ipfsHash: document.pdf_ipfs_hash,
  //     };
  //   }

  //   // Download from IPFS
  //   try {
  //     const gateway = this.configService.get<string>('PINATA_GATEWAY') || 'gateway.pinata.cloud';
  //     const url = `https://${gateway}/ipfs/${document.pdf_ipfs_hash}`;
      
  //     this.logger.log(`Downloading PDF from IPFS: ${url}`);
      
  //     const response = await fetch(url);
      
  //     if (!response.ok) {
  //       throw new Error(`Failed to download PDF: ${response.statusText}`);
  //     }
      
  //     const arrayBuffer = await response.arrayBuffer();
  //     const buffer = Buffer.from(arrayBuffer);
      
  //     this.logger.log(`✅ PDF downloaded successfully (${buffer.length} bytes)`);
      
  //     return {
  //       buffer,
  //       ipfsHash: document.pdf_ipfs_hash,
  //     };
  //   } catch (error) {
  //     this.logger.error(`❌ Failed to download PDF from IPFS`, error);
  //     throw new BadRequestException(`Failed to download PDF: ${error.message}`);
  //   }
  // }

  /**
   * Get certificates for current user, optionally filtered by document_type_id
   */
  async getCertificates(userId: string, documentTypeId?: string): Promise<CertificateResponse[]> {
    this.logger.log(`Getting certificates for user ${userId}${documentTypeId ? ` with document_type_id ${documentTypeId}` : ''}`);

    const whereCondition: any = { user_id: userId };
    if (documentTypeId) {
      whereCondition.document_type_id = documentTypeId;
    }

    const certificates = await this.certificateReposioty.find({
      where: whereCondition,
      relations: ['documentType'],
      order: { issued_date: 'DESC' },
    });

    return certificates.map((cert) => {
      // Handle date conversion - TypeORM 'date' type may return string or Date
      const formatDate = (date: Date | string | null | undefined): string | undefined => {
        if (!date) return undefined;
        if (typeof date === 'string') {
          // If it's already a string, return as is (assuming YYYY-MM-DD format)
          return date.split('T')[0];
        }
        if (date instanceof Date) {
          return date.toISOString().split('T')[0];
        }
        return undefined;
      };

      return {
        certificate_id: cert.certificate_id,
        document_type_id: cert.document_type_id,
        document_type_name: cert.documentType?.document_type_name || 'Unknown',
        issued_date: formatDate(cert.issued_date) || '',
        expiry_date: formatDate(cert.expiry_date),
        description: cert.description || undefined,
        metadata: cert.metadata || undefined,
      };
    });
  }
}

