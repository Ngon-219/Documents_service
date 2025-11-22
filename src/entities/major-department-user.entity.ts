import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Major } from './major.entity';
import { Department } from './department.entity';
import { User } from './user.entity';

@Entity('major_department_user')
export class MajorDepartmentUser {
  @PrimaryColumn({ type: 'uuid' })
  major_id: string;

  @PrimaryColumn({ type: 'uuid' })
  department_id: string;

  @PrimaryColumn({ type: 'uuid' })
  user_id: string;

  @CreateDateColumn({ name: 'create_at' })
  create_at: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updated_at: Date;

  // Relations
  @ManyToOne(() => Major)
  @JoinColumn({ name: 'major_id' })
  major: Major;

  @ManyToOne(() => Department)
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'user_id' })
  user: User;
}

