import { SetMetadata } from '@nestjs/common';

export enum UserRole {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  TEACHER = 'Teacher',
  STUDENT = 'Student',
}

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

