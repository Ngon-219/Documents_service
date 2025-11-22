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
  studentName: string;
  issuerName: string;
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
    return await this.generateCertificate(data);
  }

  async generateCertificate(data: DocumentData): Promise<Buffer> {
    const documentType = await this.documentTypeRepository.findOne({
      where: { document_type_id: data.document.document_type_id },
    });

    if (!documentType) {
      throw new NotFoundException("Document type not found");
    }

    // Parse template_pdf from string to object
    let template_pdf_schema: any;
    if (documentType.template_pdf) {
      // If template_pdf is a string, parse it. If it's already an object, use it directly
      if (typeof documentType.template_pdf === 'string') {
        template_pdf_schema = JSON.parse(documentType.template_pdf);
      } else {
        template_pdf_schema = documentType.template_pdf;
      }
    } else {
      // Default empty template if not provided
      template_pdf_schema = { basePdf: BLANK_PDF, schemas: [] };
    }

    const pdf_template: Template = template_pdf_schema as Template;
    pdf_template.basePdf = pdf_template.basePdf || BLANK_PDF;

    const fonts = this.loadFonts();
    const defaultFontName = Object.keys(fonts)[0];
    if (defaultFontName) {
      this.applyDefaultFont(pdf_template, defaultFontName);
    }

    const inputs = [
      {
        "subtitile": data.documentType.document_type_name || "",
        "signature": data.studentName || "",
        "details": typeof data.document.metadata === 'object' 
          ? JSON.stringify(data.document.metadata) 
          : (data.document.metadata || ""),
        "from1-1": "Người xác nhận",
        "from1-2": data.issuerName || "",
        "from2-1": "Cơ quan cấp phát",
        "from2-2": "Hệ thống một cửa Trường Đại Học Xây Dựng Hà Nội"
      }
    ];

    const pdf_generate = await generate({ template: pdf_template, inputs, options: { font: fonts } });
    const pdfBuffer = Buffer.from(pdf_generate);
    fs.writeFileSync('pdf_generate.pdf', pdfBuffer);
    return pdfBuffer;
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
