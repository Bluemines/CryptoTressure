import { Role, UserStatus } from 'generated/prisma';

export interface UserListView {
  id: number;
  createdAt: Date;
  updatedAt: Date;
  username: string;
  phone: string | null;
  email: string;
  emailVerified: boolean;
  referralCode: string | null;
  role: Role;
  status: UserStatus;
}
