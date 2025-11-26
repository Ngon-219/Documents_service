import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Department } from './department.entity';
import { UserMajor } from './user-major.entity';

@Entity('major')
export class Major {
  @PrimaryGeneratedColumn('uuid')
  major_id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'timestamp' })
  founding_date: Date;

  @CreateDateColumn({ name: 'create_at' })
  create_at: Date;

  @UpdateDateColumn({ name: 'update_at' })
  update_at: Date;

  @Column({ type: 'uuid', nullable: true })
  department_id: string | null;

  // Relations
  @ManyToOne(() => Department, (department) => department.majors)
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @OneToMany(() => UserMajor, (userMajor) => userMajor.major)
  userMajors: UserMajor[];
}


