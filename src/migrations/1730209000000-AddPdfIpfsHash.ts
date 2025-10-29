import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPdfIpfsHash1730209000000 implements MigrationInterface {
  name = 'AddPdfIpfsHash1730209000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add pdf_ipfs_hash column to documents table
    await queryRunner.query(`
      ALTER TABLE "documents" 
      ADD COLUMN "pdf_ipfs_hash" character varying
    `);

    // Add index for pdf_ipfs_hash (useful for lookups)
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_pdf_ipfs_hash" ON "documents" ("pdf_ipfs_hash")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop index
    await queryRunner.query(`DROP INDEX "IDX_documents_pdf_ipfs_hash"`);
    
    // Drop column
    await queryRunner.query(`
      ALTER TABLE "documents" DROP COLUMN "pdf_ipfs_hash"
    `);
  }
}

