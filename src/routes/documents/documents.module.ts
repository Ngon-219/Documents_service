import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document } from '../../entities/document.entity';
import { DocumentType } from '../../entities/document-type.entity';
import { BlockchainService } from '../../blockchain/blockchain.service';

@Module({
  imports: [TypeOrmModule.forFeature([Document, DocumentType])],
  controllers: [DocumentsController],
  providers: [DocumentsService, BlockchainService],
  exports: [DocumentsService],
})
export class DocumentsModule {}

