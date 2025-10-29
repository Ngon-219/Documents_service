import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDocumentTables1730208000000 implements MigrationInterface {
  name = 'CreateDocumentTables1730208000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create document_type table
    await queryRunner.query(`
      CREATE TABLE "document_type" (
        "document_type_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "document_type_name" character varying NOT NULL,
        "description" text,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_document_type_name" UNIQUE ("document_type_name"),
        CONSTRAINT "PK_document_type" PRIMARY KEY ("document_type_id")
      )
    `);

    // Create documents table
    await queryRunner.query(`
      CREATE TABLE "documents" (
        "document_id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL,
        "issuer_id" uuid NOT NULL,
        "document_type_id" uuid NOT NULL,
        "blockchain_doc_id" character varying(66),
        "token_id" bigint,
        "tx_hash" character varying(66),
        "contract_address" character varying(42) NOT NULL,
        "ipfs_hash" character varying,
        "document_hash" character varying(66),
        "metadata" jsonb,
        "status" character varying NOT NULL DEFAULT 'draft',
        "is_valid" boolean NOT NULL DEFAULT true,
        "issued_at" TIMESTAMP,
        "verified_at" TIMESTAMP,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_documents" PRIMARY KEY ("document_id")
      )
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX "IDX_documents_user_id" ON "documents" ("user_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_documents_token_id" ON "documents" ("token_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_documents_blockchain_doc_id" ON "documents" ("blockchain_doc_id")
    `);

    await queryRunner.query(`
      CREATE INDEX "IDX_documents_status" ON "documents" ("status", "is_valid")
    `);

    // Add foreign key
    await queryRunner.query(`
      ALTER TABLE "documents" 
      ADD CONSTRAINT "FK_documents_document_type" 
      FOREIGN KEY ("document_type_id") 
      REFERENCES "document_type"("document_type_id") 
      ON DELETE NO ACTION 
      ON UPDATE NO ACTION
    `);

    // Seed document types
    await queryRunner.query(`
      INSERT INTO "document_type" ("document_type_name", "description") VALUES
        ('Diploma', 'Bằng tốt nghiệp'),
        ('Transcript', 'Bảng điểm'),
        ('Certificate', 'Chứng chỉ'),
        ('Recommendation', 'Thư giới thiệu')
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "documents" DROP CONSTRAINT "FK_documents_document_type"
    `);

    await queryRunner.query(`DROP INDEX "IDX_documents_status"`);
    await queryRunner.query(`DROP INDEX "IDX_documents_blockchain_doc_id"`);
    await queryRunner.query(`DROP INDEX "IDX_documents_token_id"`);
    await queryRunner.query(`DROP INDEX "IDX_documents_user_id"`);

    await queryRunner.query(`DROP TABLE "documents"`);
    await queryRunner.query(`DROP TABLE "document_type"`);
  }
}

