import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from '../../entities/document.entity';
import { DocumentType } from '../../entities/document-type.entity';
import { Wallet } from '../../entities/wallet.entity';
import { User } from '../../entities/user.entity';
import { BlockchainService } from '../../blockchain/blockchain.service';
import { IPFSService } from '../../blockchain/ipfs.service';
import { PdfServiceService } from '../../pdf_service/pdf_service.service';
import { GrpcModule } from '../../grpc/grpc.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Document, DocumentType, Wallet, User]),
    GrpcModule,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, BlockchainService, IPFSService, PdfServiceService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

