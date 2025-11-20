import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import { Document } from '../entities/document.entity';
import { DocumentType } from '../entities/document-type.entity';
import { Font, Template } from "@pdfme/common";
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { generate } from '@pdfme/generator';
import fs from 'fs';
import { BLANK_PDF } from '@pdfme/common';
import path from 'path';

interface DocumentData {
  document: Document;
  documentType: DocumentType;
  studentName?: string;
  issuerName?: string;
}

@Injectable()
export class PdfServiceService {
  private readonly logger = new Logger(PdfServiceService.name);

  /**
   *
   */
  constructor(
    @InjectRepository(DocumentType)
    private documentTypeRepository: Repository<DocumentType>,
  ) {}

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

  async generateCertificate(): Promise<Buffer> {
    const pdf_template: Template = this.loadTemplateFromFile();
    pdf_template.basePdf = pdf_template.basePdf || BLANK_PDF;

    const fonts = this.loadFonts();
    const defaultFontName = Object.keys(fonts)[0];
    if (defaultFontName) {
      this.applyDefaultFont(pdf_template, defaultFontName);
    }

    const inputs = [
      {
        "subtitile": "CHỨNG NHẬN THỰC TẬP",
        "signature": "VŨ CÔNG NGÔN",
        "details": "CHỨNG NHẬN BẠN QUÁ ĐẸP TRAI",
        "from1-1": "Truong khoa",
        "from1-2": "Vu Cong Ngon",
        "from2-1": "Ahii",
        "from2-2": "ahihi"
      }
    ];

    const pdf_generate = await generate({ template: pdf_template, inputs, options: { font: fonts } });
    const pdfBuffer = Buffer.from(pdf_generate);
    fs.writeFileSync('pdf_generate.pdf', pdfBuffer);
    return pdfBuffer;
  }

  private loadTemplateFromFile(): Template {
    const templatePath = this.resolveTemplatePath();
    const templateContent = fs.readFileSync(templatePath, 'utf-8');
    return JSON.parse(templateContent) as Template;
  }

  private resolveTemplatePath(): string {
    const candidates = [
      path.join(__dirname, 'template', 'template.json'),
      path.join(process.cwd(), 'src', 'pdf_service', 'template', 'template.json'),
    ];

    const foundPath = candidates.find((candidate) => fs.existsSync(candidate));

    if (!foundPath) {
      throw new NotFoundException('Certificate template file not found');
    }

    return foundPath;
  }

  private loadFonts(): Font {
    const googleSans = this.readFontFile('GoogleSansFlex-VariableFont_GRAD,ROND,opsz,slnt,wdth,wght.ttf');

    return {
      GoogleSansFlex: {
        data: googleSans,
        fallback: true,
      },
    };
  }

  private readFontFile(fileName: string): ArrayBuffer {
    const candidates = [
      path.join(__dirname, 'fonts', fileName),
      path.join(process.cwd(), 'src', 'pdf_service', 'fonts', fileName),
    ];

    const foundPath = candidates.find((candidate) => fs.existsSync(candidate));

    if (!foundPath) {
      throw new NotFoundException(`Font file ${fileName} not found`);
    }

    const fileBuffer = fs.readFileSync(foundPath);
    return fileBuffer.buffer.slice(
      fileBuffer.byteOffset,
      fileBuffer.byteOffset + fileBuffer.byteLength,
    );
  }

  private applyDefaultFont(template: Template, fontName: string) {
    template.schemas?.forEach((schemaRow) => {
      schemaRow.forEach((schemaItem: any) => {
        if (schemaItem.type === 'text') {
          schemaItem.fontName = fontName;
        }
      });
    });
  }
}
