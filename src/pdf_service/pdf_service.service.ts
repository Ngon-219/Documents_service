import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Document } from '../entities/document.entity';
import { DocumentType } from '../entities/document-type.entity';

interface DocumentData {
  document: Document;
  documentType: DocumentType;
  studentName?: string;
  issuerName?: string;
}

@Injectable()
export class PdfServiceService {
  private readonly logger = new Logger(PdfServiceService.name);

  async generatePdf(data: DocumentData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const { document, documentType, studentName, issuerName } = data;
        
        const doc = new PDFDocument({
          size: 'A4',
          margins: {
            top: 50,
            bottom: 50,
            left: 72,
            right: 72,
          },
        });

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          this.logger.log(`PDF generated successfully (${pdfBuffer.length} bytes)`);
          resolve(pdfBuffer);
        });
        doc.on('error', (error) => {
          this.logger.error('PDF generation failed', error);
          reject(error);
        });

        doc.fontSize(24)
          .font('Helvetica-Bold')
          .fillColor('#2C3E50')
          .text('OFFICIAL DOCUMENT CERTIFICATE', { align: 'center' });

        doc.moveDown(0.5);
        doc.fontSize(10)
          .font('Helvetica')
          .fillColor('#7F8C8D')
          .text('Verified on Blockchain', { align: 'center' });

        doc.moveDown(1);
        doc.strokeColor('#3498DB')
          .lineWidth(2)
          .moveTo(72, doc.y)
          .lineTo(540, doc.y)
          .stroke();

        doc.moveDown(2);

        doc.fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#2C3E50')
          .text('DOCUMENT INFORMATION', { underline: true });

        doc.moveDown(0.5);

        const infoY = doc.y;
        const leftX = 72;
        const valueX = 240;
        
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#34495E')
          .text('Document Type:', leftX, infoY);
        doc.font('Helvetica')
          .fillColor('#2C3E50')
          .text(documentType.document_type_name, valueX, infoY);

        doc.moveDown(0.8);
        doc.font('Helvetica-Bold')
          .fillColor('#34495E')
          .text('Student:', leftX, doc.y);
        doc.font('Helvetica')
          .fillColor('#2C3E50')
          .text(studentName || document.user_id, valueX, doc.y);

        doc.moveDown(0.8);
        doc.font('Helvetica-Bold')
          .fillColor('#34495E')
          .text('Issued By:', leftX, doc.y);
        doc.font('Helvetica')
          .fillColor('#2C3E50')
          .text(issuerName || document.issuer_id, valueX, doc.y);

        doc.moveDown(0.8);
        doc.font('Helvetica-Bold')
          .fillColor('#34495E')
          .text('Issue Date:', leftX, doc.y);
        doc.font('Helvetica')
          .fillColor('#2C3E50')
          .text(
            document.issued_at
              ? new Date(document.issued_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : 'N/A',
            valueX,
            doc.y,
          );

        doc.moveDown(0.8);
        doc.font('Helvetica-Bold')
          .fillColor('#34495E')
          .text('Document ID:', leftX, doc.y);
        doc.font('Helvetica')
          .fontSize(9)
          .fillColor('#7F8C8D')
          .text(document.document_id, valueX, doc.y, { width: 300 });

        doc.moveDown(2);

        if (document.metadata && Object.keys(document.metadata).length > 0) {
          doc.fontSize(14)
            .font('Helvetica-Bold')
            .fillColor('#2C3E50')
            .text('ADDITIONAL INFORMATION', { underline: true });

          doc.moveDown(0.5);
          doc.fontSize(11).font('Helvetica');

          Object.entries(document.metadata).forEach(([key, value]) => {
            if (['studentId', 'issuer', 'version', 'issuedDate'].includes(key)) {
              return;
            }

            doc.font('Helvetica-Bold')
              .fillColor('#34495E')
              .text(`${this.formatKey(key)}:`, leftX, doc.y);
            
            doc.font('Helvetica')
              .fillColor('#2C3E50')
              .text(String(value), valueX, doc.y);
            
            doc.moveDown(0.6);
          });

          doc.moveDown(1);
        }

        doc.fontSize(14)
          .font('Helvetica-Bold')
          .fillColor('#2C3E50')
          .text('BLOCKCHAIN VERIFICATION', { underline: true });

        doc.moveDown(0.5);

        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#34495E')
          .text('NFT Token ID:', leftX, doc.y);
        doc.font('Helvetica')
          .fillColor('#27AE60')
          .text(document.token_id || 'Pending', valueX, doc.y);

        doc.moveDown(0.8);
        doc.font('Helvetica-Bold')
          .fillColor('#34495E')
          .text('Transaction Hash:', leftX, doc.y);
        doc.font('Helvetica')
          .fontSize(8)
          .fillColor('#7F8C8D')
          .text(document.tx_hash || 'N/A', valueX, doc.y, { width: 300 });

        doc.moveDown(0.8);
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#34495E')
          .text('IPFS Metadata:', leftX, doc.y);
        doc.font('Helvetica')
          .fontSize(8)
          .fillColor('#7F8C8D')
          .text(document.ipfs_hash || 'N/A', valueX, doc.y, { width: 300 });

        doc.moveDown(0.8);
        doc.fontSize(11)
          .font('Helvetica-Bold')
          .fillColor('#34495E')
          .text('Document Hash:', leftX, doc.y);
        doc.font('Helvetica')
          .fontSize(8)
          .fillColor('#7F8C8D')
          .text(document.document_hash || 'N/A', valueX, doc.y, { width: 300 });

        doc.moveDown(2);

        doc.fontSize(9)
          .font('Helvetica-Oblique')
          .fillColor('#95A5A6')
          .text(
            'This document is cryptographically secured on the blockchain. ' +
            'To verify authenticity, visit our verification portal with the NFT Token ID.',
            {
              align: 'center',
              width: 450,
            },
          );

        const pageHeight = doc.page.height;
        doc.fontSize(8)
          .font('Helvetica')
          .fillColor('#BDC3C7')
          .text(
            `Generated on ${new Date().toLocaleString('en-US')}`,
            72,
            pageHeight - 50,
            { align: 'center', width: 450 },
          );

        doc.end();
      } catch (error) {
        this.logger.error('Error generating PDF', error);
        reject(error);
      }
    });
  }

  private formatKey(key: string): string {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim();  
  }
}
