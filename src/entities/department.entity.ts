import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Major } from './major.entity';

@Entity('department')
export class Department {
  @PrimaryGeneratedColumn('uuid')
  department_id: string;

  @Column({ type: 'varchar' })
  name: string;

  @Column({ type: 'timestamp' })
  founding_date: Date;

  @Column({ type: 'varchar' })
  dean: string;

  @CreateDateColumn({ name: 'create_at' })
  create_at: Date;

  @UpdateDateColumn({ name: 'update_at' })
  update_at: Date;

  // Relations
  @OneToMany(() => Major, (major) => major.department)
  majors: Major[];
}


