export interface IAuthProvider {
  id: string;
  name: string;
  type: string;
  isEnabled: boolean;
  allowSignup?: boolean;
  creatorId?: string;
  workspaceId?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
