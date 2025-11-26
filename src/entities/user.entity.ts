import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToOne,
  OneToMany,
} from 'typeorm';
import { RoleEnum, UserStatus } from './enums';
import { Wallet } from './wallet.entity';
import { UserMfa } from './user-mfa.entity';
import { Certificate } from './certificate.entity';
import { DocumentType } from './document-type.entity';
import { FileUploadHistory } from './file-upload-history.entity';
import { OtpVerify } from './otp-verify.entity';
import { Request } from './request.entity';
import { ScoreBoard } from './score-board.entity';
import { SemesterSummary } from './semester-summary.entity';
import { UserMajor } from './user-major.entity';

@Entity('user')
export class User {
  @PrimaryGeneratedColumn('uuid')
  user_id: string;

  @Column({ type: 'varchar' })
  first_name: string;

  @Column({ type: 'varchar' })
  last_name: string;

  @Column({ type: 'varchar' })
  address: string;

  @Column({ type: 'varchar', unique: true })
  email: string;

  @Column({ type: 'varchar' })
  password: string;

  @Column({ type: 'boolean' })
  is_priority: boolean;

  @Column({ type: 'varchar' })
  cccd: string;

  @Column({ type: 'varchar' })
  phone_number: string;

  @Column({ type: 'boolean' })
  is_first_login: boolean;

  @CreateDateColumn({ name: 'create_at' })
  create_at: Date;

  @UpdateDateColumn({ name: 'update_at' })
  update_at: Date;

  @Column({ type: 'timestamp', nullable: true })
  deleted_at: Date | null;

  @Column({
    type: 'enum',
    enum: RoleEnum,
  })
  role: RoleEnum;

  @Column({ type: 'varchar', nullable: true })
  student_code: string | null;

  @Column({
    type: 'enum',
    enum: UserStatus,
  })
  status: UserStatus;

  // Relations
  @OneToOne(() => Wallet, (wallet) => wallet.user)
  wallet: Wallet;

  @OneToOne(() => UserMfa, (userMfa) => userMfa.user)
  userMfa: UserMfa;

  @OneToMany(() => Certificate, (certificate) => certificate.user)
  certificates: Certificate[];

  @OneToMany(() => DocumentType, (documentType) => documentType.user)
  documentTypes: DocumentType[];

  @OneToMany(() => FileUploadHistory, (fileUploadHistory) => fileUploadHistory.user)
  fileUploadHistories: FileUploadHistory[];

  @OneToMany(() => OtpVerify, (otpVerify) => otpVerify.user)
  otpVerifies: OtpVerify[];

  @OneToMany(() => Request, (request) => request.user)
  requests: Request[];

  @OneToMany(() => ScoreBoard, (scoreBoard) => scoreBoard.user)
  scoreBoards: ScoreBoard[];

  @OneToMany(() => SemesterSummary, (semesterSummary) => semesterSummary.user)
  semesterSummaries: SemesterSummary[];

  @OneToMany(() => UserMajor, (userMajor) => userMajor.user)
  userMajors: UserMajor[];
}


