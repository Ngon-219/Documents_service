import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ethers } from 'ethers';

// Import ABIs (you'll need to copy these from smart_contract/artifacts)
import IssuanceOfDocumentABI from './abis/IssuanceOfDocument.json';
import DocumentNFTABI from './abis/DocumentNFT.json';

@Injectable()
export class BlockchainService {
  private readonly logger = new Logger(BlockchainService.name);
  private provider: ethers.JsonRpcProvider;
  private wallet: ethers.Wallet;
  private issuanceContract: ethers.Contract;
  private documentNFTContract: ethers.Contract;

  constructor(private configService: ConfigService) {
    this.initializeBlockchain();
  }

  private initializeBlockchain() {
    try {
      // Setup provider
      const rpcUrl = this.configService.get<string>('BLOCKCHAIN_RPC_URL');
      if (!rpcUrl) {
        throw new Error('BLOCKCHAIN_RPC_URL is not defined');
      }
      this.provider = new ethers.JsonRpcProvider(rpcUrl);

      // Setup wallet (admin wallet)
      const privateKey = this.configService.get<string>('ADMIN_PRIVATE_KEY');
      if (!privateKey) {
        throw new Error('ADMIN_PRIVATE_KEY is not defined');
      }
      this.wallet = new ethers.Wallet(privateKey, this.provider);

      // Setup contracts
      const issuanceAddress = this.configService.get<string>(
        'ISSUANCE_CONTRACT_ADDRESS',
      );
      if (!issuanceAddress) {
        throw new Error('ISSUANCE_CONTRACT_ADDRESS is not defined');
      }

      const nftAddress = this.configService.get<string>(
        'DOCUMENT_NFT_CONTRACT_ADDRESS',
      );
      if (!nftAddress) {
        throw new Error('DOCUMENT_NFT_CONTRACT_ADDRESS is not defined');
      }

      this.issuanceContract = new ethers.Contract(
        issuanceAddress,
        IssuanceOfDocumentABI,
        this.wallet,
      );

      this.documentNFTContract = new ethers.Contract(
        nftAddress,
        DocumentNFTABI,
        this.wallet,
      );

      this.logger.log('Blockchain service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize blockchain service', error);
      throw error;
    }
  }

  /**
   * Sign document and mint NFT on blockchain
   */
  async signDocument(
    studentBlockchainId: number,
    documentType: string,
    documentHash: string,
    tokenURI: string,
  ): Promise<{
    txHash: string;
    blockchainDocId: string;
    tokenId: string;
  }> {
    try {
      this.logger.log(
        `Signing document for student ${studentBlockchainId}, type: ${documentType}`,
      );

      const tx = await this.issuanceContract.signDocument(
        documentHash,
        studentBlockchainId,
        documentType,
        tokenURI,
      );

      this.logger.log(`Transaction sent: ${tx.hash}`);

      const receipt = await tx.wait();

      this.logger.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

      // Parse event to get documentId and tokenId
      const eventSignature = this.issuanceContract.interface.getEvent('DocumentSigned');
      if (!eventSignature) {
        throw new Error('DocumentSigned event signature not found in ABI');
      }

      const event = receipt.logs.find(
        (log: any) => log.topics[0] === eventSignature.topicHash,
      );

      if (!event) {
        throw new Error('DocumentSigned event not found in transaction logs');
      }

      const parsedEvent = this.issuanceContract.interface.parseLog({
        topics: event.topics as string[],
        data: event.data,
      });

      console.log("Parsed Event: ", parsedEvent);

      if (!parsedEvent) {
        throw new Error('Failed to parse DocumentSigned event');
      }

      return {
        txHash: receipt.hash,
        blockchainDocId: parsedEvent.args.documentId,
        tokenId: parsedEvent.args.tokenId.toString(),
      };
    } catch (error) {
      this.logger.error('Failed to sign document on blockchain', error);
      throw error;
    }
  }

  /**
   * Revoke document on blockchain
   */
  async revokeDocument(blockchainDocId: string): Promise<string> {
    try {
      this.logger.log(`Revoking document: ${blockchainDocId}`);

      const tx = await this.issuanceContract.revokeDocument(blockchainDocId);
      const receipt = await tx.wait();

      this.logger.log(`Document revoked, tx: ${receipt.hash}`);

      return receipt.hash;
    } catch (error) {
      this.logger.error('Failed to revoke document', error);
      throw error;
    }
  }

  /**
   * Get document info from blockchain
   */
  async getDocumentInfo(blockchainDocId: string): Promise<{
    tokenId: string;
    documentHash: string;
    studentId: number;
    createdAt: Date;
    signedBy: string;
    documentType: string;
    isValid: boolean;
  }> {
    try {
      const docInfo =
        await this.issuanceContract.getDocumentInfo(blockchainDocId);

      return {
        tokenId: docInfo.tokenId.toString(),
        documentHash: docInfo.documentHash,
        studentId: Number(docInfo.studentId),
        createdAt: new Date(Number(docInfo.createdAt) * 1000),
        signedBy: docInfo.signedBy,
        documentType: docInfo.documentType,
        isValid: docInfo.isValid,
      };
    } catch (error) {
      this.logger.error('Failed to get document info', error);
      throw error;
    }
  }

  /**
   * Verify NFT on blockchain
   */
  async verifyNFT(tokenId: string): Promise<{
    owner: string;
    isValid: boolean;
    metadata: any;
  }> {
    try {
      const owner = await this.documentNFTContract.ownerOf(tokenId);
      const isValid = await this.documentNFTContract.isDocumentValid(tokenId);
      const metadata =
        await this.documentNFTContract.getDocumentMetadata(tokenId);

      return {
        owner,
        isValid,
        metadata: {
          studentId: Number(metadata.studentId),
          documentType: metadata.documentType,
          documentHash: metadata.documentHash,
          issuedAt: new Date(Number(metadata.issuedAt) * 1000),
          issuedBy: metadata.issuedBy,
          isValid: metadata.isValid,
        },
      };
    } catch (error) {
      this.logger.error('Failed to verify NFT', error);
      throw error;
    }
  }

  /**
   * Get student's NFTs
   */
  async getStudentNFTs(studentBlockchainId: number): Promise<string[]> {
    try {
      const tokenIds =
        await this.issuanceContract.getStudentNFTs(studentBlockchainId);
      return tokenIds.map((id: bigint) => id.toString());
    } catch (error) {
      this.logger.error('Failed to get student NFTs', error);
      throw error;
    }
  }
}

