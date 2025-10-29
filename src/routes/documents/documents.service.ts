import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from '../../entities/document.entity';
import { DocumentType } from '../../entities/document-type.entity';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';
import { RequestDocumentDto, ApproveDocumentDto } from './dto';

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @InjectRepository(Document)
    private documentRepository: Repository<Document>,
    @InjectRepository(DocumentType)
    private documentTypeRepository: Repository<DocumentType>,
    private blockchainService: BlockchainService,
    private configService: ConfigService,
  ) {}

  /**
   * Step 1: Student requests document (creates draft)
   */
  async requestDocument(userId: string, dto: RequestDocumentDto): Promise<Document> {
    this.logger.log(
      `Student ${userId} requesting document type ${dto.document_type_id}`,
    );

    const documentType = await this.documentTypeRepository.findOne({
      where: { document_type_id: dto.document_type_id },
    });

    if (!documentType) {
      throw new NotFoundException('Document type not found');
    }

    const document = this.documentRepository.create({
      user_id: userId,
      document_type_id: dto.document_type_id,
      issuer_id: userId, // Will be updated when manager approves
      metadata: dto.metadata || {},
      status: DocumentStatus.DRAFT,
      is_valid: false, // Not yet minted
      contract_address:
        this.configService.get<string>('ISSUANCE_CONTRACT_ADDRESS'),
    });

    return await this.documentRepository.save(document);
  }

  /**
   * Step 2: Manager approves and signs on blockchain
   */
  async approveAndSignDocument(
    documentId: string,
    issuerId: string,
    dto: ApproveDocumentDto,
  ): Promise<Document> {
    this.logger.log(
      `Manager ${issuerId} approving document ${documentId}`,
    );

    const studentBlockchainId = dto.student_blockchain_id;

    const document = await this.documentRepository.findOne({
      where: { document_id: documentId },
      relations: ['documentType'],
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (document.status !== DocumentStatus.DRAFT) {
      throw new Error(
        `Cannot approve document with status: ${document.status}`,
      );
    }

    // Update to pending approval
    document.status = DocumentStatus.PENDING_BLOCKCHAIN;
    document.issuer_id = issuerId;
    await this.documentRepository.save(document);

    try {
      // Prepare metadata for IPFS
      const metadata = {
        studentId: studentBlockchainId,
        documentType: document.documentType.document_type_name,
        ...document.metadata,
        issuedDate: new Date().toISOString(),
        issuer: issuerId,
      };

      // TODO: Upload to IPFS (implement IPFS service)
      const ipfsHash = 'Qm...'; // Placeholder
      const tokenURI = `ipfs://${ipfsHash}`;

      // Create document hash
      const documentHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(metadata)),
      );

      // Call blockchain
      const { txHash, blockchainDocId, tokenId } =
        await this.blockchainService.signDocument(
          studentBlockchainId,
          document.documentType.document_type_name,
          documentHash,
          tokenURI,
        );

      // Update document with blockchain data
      document.tx_hash = txHash;
      document.blockchain_doc_id = blockchainDocId;
      document.token_id = tokenId;
      document.ipfs_hash = ipfsHash;
      document.document_hash = documentHash;
      document.status = DocumentStatus.MINTED;
      document.is_valid = true;
      document.issued_at = new Date();
      document.verified_at = new Date();

      return await this.documentRepository.save(document);
    } catch (error) {
      this.logger.error('Failed to sign document on blockchain', error);

      // Mark as failed
      document.status = DocumentStatus.FAILED;
      await this.documentRepository.save(document);

      throw error;
    }
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

  /**
   * Get all document types
   */
  async getDocumentTypes(): Promise<DocumentType[]> {
    return await this.documentTypeRepository.find();
  }
}

