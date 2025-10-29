import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Document, DocumentStatus } from '../../entities/document.entity';
import { DocumentType } from '../../entities/document-type.entity';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IPFSService } from '../../blockchain/ipfs.service';
import { PdfServiceService } from '../../pdf_service/pdf_service.service';
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
    private ipfsService: IPFSService,
    private pdfService: PdfServiceService,
    private configService: ConfigService,
  ) {}

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
      issuer_id: userId,
      metadata: dto.metadata || {},
      status: DocumentStatus.DRAFT,
      is_valid: false,
      contract_address:
        this.configService.get<string>('ISSUANCE_CONTRACT_ADDRESS'),
    });

    return await this.documentRepository.save(document);
  }

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
      throw new BadRequestException(
        `Cannot approve document with status: ${document.status}. Only DRAFT documents can be approved.`,
      );
    }

    // Update to pending blockchain
    document.status = DocumentStatus.PENDING_BLOCKCHAIN;
    document.issuer_id = issuerId;
    await this.documentRepository.save(document);

    try {
      this.logger.log(`Starting blockchain process for document ${documentId}`);

      // Step 1: Generate PDF
      this.logger.log('📄 Generating PDF certificate...');
      const pdfBuffer = await this.pdfService.generatePdf({
        document,
        documentType: document.documentType,
        // You can add student/issuer names from auth service if needed
      });

      // Step 2: Upload PDF to IPFS
      this.logger.log('📤 Uploading PDF to IPFS...');
      const pdfFileName = `document-${documentId}.pdf`;
      const pdfIpfsHash = await this.ipfsService.uploadFile(pdfBuffer, pdfFileName, {
        documentId: documentId,
        documentType: document.documentType.document_type_name,
        studentId: document.user_id,
      });
      this.logger.log(`✅ PDF uploaded to IPFS: ${pdfIpfsHash}`);

      // Step 3: Prepare metadata for IPFS (include PDF link)
      const metadata = {
        studentId: studentBlockchainId,
        documentType: document.documentType.document_type_name,
        documentTypeId: document.document_type_id,
        studentUserId: document.user_id,
        issuerUserId: issuerId,
        ...document.metadata,
        issuedDate: new Date().toISOString(),
        issuer: issuerId,
        version: '1.0',
        // Add PDF IPFS link
        pdfFile: `ipfs://${pdfIpfsHash}`,
        pdfGateway: `https://gateway.pinata.cloud/ipfs/${pdfIpfsHash}`,
      };

      this.logger.log('Metadata prepared, uploading to IPFS...');

      // Step 4: Upload metadata to IPFS
      const ipfsHash = await this.ipfsService.uploadMetadata(metadata);
      const tokenURI = `ipfs://${ipfsHash}`;

      this.logger.log(`IPFS upload successful: ${ipfsHash}`);

      // Step 5: Create document hash (for blockchain integrity)
      const documentHash = ethers.keccak256(
        ethers.toUtf8Bytes(JSON.stringify(metadata)),
      );

      this.logger.log(`Document hash generated: ${documentHash}`);

      // Step 6: Sign document on blockchain and mint NFT
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

      // Step 7: Update document with blockchain data
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

      this.logger.log(`✅ Document ${documentId} successfully minted as NFT!`);

      return savedDocument;
    } catch (error) {
      this.logger.error('❌ Failed to sign document on blockchain', error);

      // Mark as failed
      document.status = DocumentStatus.FAILED;
      await this.documentRepository.save(document);

      // Re-throw with more context
      throw new BadRequestException(
        `Failed to mint document on blockchain: ${error.message}`,
      );
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

  /**
   * Get PDF file from IPFS
   * @param documentId Document UUID
   * @returns PDF buffer and IPFS hash
   */
  async getDocumentPdf(documentId: string): Promise<{ buffer: Buffer; ipfsHash: string }> {
    const document = await this.documentRepository.findOne({
      where: { document_id: documentId },
    });

    if (!document) {
      throw new NotFoundException('Document not found');
    }

    if (!document.pdf_ipfs_hash) {
      throw new NotFoundException('PDF not available for this document');
    }

    // For mock mode, we can regenerate the PDF
    if (this.configService.get<string>('USE_MOCK_IPFS') === 'true') {
      this.logger.warn('Mock mode: Regenerating PDF instead of downloading from IPFS');
      const documentWithRelations = await this.documentRepository.findOne({
        where: { document_id: documentId },
        relations: ['documentType'],
      });
      
      if (!documentWithRelations) {
        throw new NotFoundException('Document not found');
      }
      
      const pdfBuffer = await this.pdfService.generatePdf({
        document: documentWithRelations,
        documentType: documentWithRelations.documentType,
      });
      
      return {
        buffer: pdfBuffer,
        ipfsHash: document.pdf_ipfs_hash,
      };
    }

    // Download from IPFS
    try {
      const gateway = this.configService.get<string>('PINATA_GATEWAY') || 'gateway.pinata.cloud';
      const url = `https://${gateway}/ipfs/${document.pdf_ipfs_hash}`;
      
      this.logger.log(`Downloading PDF from IPFS: ${url}`);
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`Failed to download PDF: ${response.statusText}`);
      }
      
      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      
      this.logger.log(`✅ PDF downloaded successfully (${buffer.length} bytes)`);
      
      return {
        buffer,
        ipfsHash: document.pdf_ipfs_hash,
      };
    } catch (error) {
      this.logger.error(`❌ Failed to download PDF from IPFS`, error);
      throw new BadRequestException(`Failed to download PDF: ${error.message}`);
    }
  }
}

