import { Injectable, Logger } from '@nestjs/common';
import { DocumentType } from '../entities/document-type.entity';
import { Template } from "@pdfme/common";
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BLANK_PDF } from '@pdfme/common';
import { generate } from '@pdfme/generator';
import { barcodes, text, table } from '@pdfme/schemas';
import * as fs from 'fs';
import * as path from 'path';

export interface DocumentData {
  documentTypeName: string;
  studentName: string;
  issuerName: string;
  issued_date: string;
  expiry_date: string;
  description: string;
  metadata: Record<string, any> | string;
  documentType: DocumentType;
  qr_code?: string;
}

export interface PdfTemplatePayload {
  template: Template;
  inputs: Array<Record<string, any>>;
}

@Injectable()
export class PdfServiceService {
  private readonly logger = new Logger(PdfServiceService.name);
  private fontConfig: any | null = null;

  /**
   *
   */
  constructor(
    @InjectRepository(DocumentType)
    private documentTypeRepository: Repository<DocumentType>,
  ) {
    this.loadFont();
  }

  /**
   * Load custom Unicode font for Vietnamese text.
   * Place a TTF file at: src/assets/fonts/Roboto-Regular.ttf
   */
  private loadFont() {
    try {
      const fontPath = path.join(
        __dirname,
        '..',
        'assets',
        'fonts',
        'Roboto-Regular.ttf',
      );

      if (!fs.existsSync(fontPath)) {
        this.logger.warn(
          `Custom font not found at ${fontPath}. pdfme will use default WinAnsi fonts (may break with Vietnamese).`,
        );
        return;
      }

      const fontData = fs.readFileSync(fontPath);

      this.fontConfig = {
        Roboto: {
          data: fontData,
          fallback: true,
        },
      };

      this.logger.log(
        `Custom Unicode font loaded for pdfme from ${fontPath}`,
      );
    } catch (error) {
      this.logger.error('Failed to load custom PDF font', error as any);
      this.fontConfig = null;
    }
  }

  /**
   * Force all schemas in template to use our Unicode font (Roboto)
   * so Vietnamese text doesn't break even if template_pdf from DB
   * was created with another font.
   */
  private applyFont(template: Template) {
    if (!template?.schemas) return;

    template.schemas.forEach((row: any[]) => {
      row.forEach((schema: any) => {
        if (!schema || typeof schema !== 'object') return;

        if (schema.fontName) {
          schema.fontName = 'Roboto';
        }

        if (schema.textStyle && schema.textStyle.fontName) {
          schema.textStyle.fontName = 'Roboto';
        }

        if (schema.headStyles && schema.headStyles.fontName) {
          schema.headStyles.fontName = 'Roboto';
        }

        if (schema.bodyStyles && schema.bodyStyles.fontName) {
          schema.bodyStyles.fontName = 'Roboto';
        }
      });
    });
  }

  async generatePdf(data: DocumentData): Promise<PdfTemplatePayload> {
    return await this.generateCertificate(data);
  }

  async generateCertificate(data: DocumentData): Promise<PdfTemplatePayload> {
    let template_pdf_schema: any;
    if (data.documentType.template_pdf) {
      if (typeof data.documentType.template_pdf === 'string') {
        template_pdf_schema = JSON.parse(data.documentType.template_pdf);
      } else {
        template_pdf_schema = data.documentType.template_pdf;
      }
    } else {
      template_pdf_schema = { basePdf: BLANK_PDF, schemas: [] };
    }

    const pdf_template: Template = template_pdf_schema as Template;
    pdf_template.basePdf = pdf_template.basePdf || BLANK_PDF;
    this.applyFont(pdf_template);

    const inputs: Array<Record<string, any>> = [
      {
        subtitile: data.documentType.document_type_name || "",
        signature: data.studentName || "",
        details:
          typeof data.metadata === 'object'
            ? JSON.stringify(data.metadata ?? {})
            : data.metadata || "",
        "from1-1": "Người xác nhận",
        "from1-2": data.issuerName || "",
        "from2-1": "Cơ quan cấp phát",
        "from2-2": "Hệ thống một cửa Trường Đại Học Xây Dựng Hà Nội",
        QR_CODE: data.qr_code || "https://pdfme.com/",
      },
    ];

    return {
      template: pdf_template,
      inputs,
    };
  }

  async generateTranscript(data: DocumentData): Promise<PdfTemplatePayload> {
    const metadataObj =
      typeof data.metadata === 'object' && data.metadata !== null
        ? data.metadata
        : {};

    const scoreboard: Array<any> = metadataObj.scoreboard || [];

    const tableData: string[][] = scoreboard.map((row) => [
      row.courseCode || '',
      row.courseName || '',
      row.credits != null ? String(row.credits) : '',
      row.finalScore != null ? String(row.finalScore) : '',
      row.letterGrade || '',
    ]);

    const template: Template = {
      basePdf: {
        width: 210,
        height: 297,
        padding: [20, 20, 20, 20],
      } as any,
      schemas: [
        [
          {
            name: 'scoreboardTable',
            type: 'table',
            position: {
              x: 10,
              y: 40,
            },
            width: 190,
            height: 220,
            content: '[]',
            showHead: true,
            head: ['Mã môn', 'Tên môn', 'TC', 'Điểm', 'Xếp loại'],
            headWidthPercentages: [15, 45, 10, 15, 15],
            tableStyles: {
              borderWidth: 0.3,
              borderColor: '#000000',
            },
            headStyles: {
              fontName: 'Roboto',
              fontSize: 11,
              characterSpacing: 0,
              alignment: 'left',
              verticalAlignment: 'middle',
              lineHeight: 1,
              fontColor: '#ffffff',
              borderColor: '',
              backgroundColor: '#2980ba',
              borderWidth: {
                top: 0,
                right: 0,
                bottom: 0,
                left: 0,
              },
              padding: {
                top: 5,
                right: 5,
                bottom: 5,
                left: 5,
              },
            },
            bodyStyles: {
              fontName: 'Roboto',
              fontSize: 10,
              characterSpacing: 0,
              alignment: 'left',
              verticalAlignment: 'middle',
              lineHeight: 1,
              fontColor: '#000000',
              borderColor: '#888888',
              backgroundColor: '',
              alternateBackgroundColor: '#f5f5f5',
              borderWidth: {
                top: 0.1,
                right: 0.1,
                bottom: 0.1,
                left: 0.1,
              },
              padding: {
                top: 4,
                right: 4,
                bottom: 4,
                left: 4,
              },
            },
            columnStyles: {},
            required: false,
            readOnly: false,
          } as any,
          // Student info text (bottom-left)
          {
            name: 'studentInfo',
            type: 'text',
            position: { x: 10, y: 270 },
            width: 120,
            height: 20,
            content: '',
            fontName: 'Roboto',
            fontSize: 10,
          } as any,
          // QR code with document_id (bottom-right)
          {
            name: 'QR_CODE',
            type: 'qrcode',
            position: { x: 160, y: 260 },
            width: 30,
            height: 30,
            content: '',
          } as any,
        ],
      ],
    };

    const inputs: Array<Record<string, any>> = [
      {
        scoreboardTable: tableData,
        studentInfo: `${data.studentName}`,
        QR_CODE: data.qr_code || '',
      },
    ];

    return {
      template,
      inputs,
    };
  }

  async generatePdfBuffer(payload: PdfTemplatePayload): Promise<Buffer> {
    if (!payload.template) {
      throw new Error('Template is required to generate PDF');
    }

    if (!payload.inputs || payload.inputs.length === 0) {
      throw new Error('Template inputs are required to generate PDF');
    }

    const options: any = {
      template: payload.template,
      inputs: payload.inputs,
      plugins: {
        text,
        qrcode: barcodes.qrcode,
        table,
      },
    };

    if (this.fontConfig) {
      options.font = this.fontConfig;
    }

    const pdfUint8Array = await generate(options);

    return Buffer.from(pdfUint8Array);
  }
}
