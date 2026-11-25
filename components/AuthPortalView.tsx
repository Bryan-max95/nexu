export interface AuthenticatedPayload {
 token: string;
 user: { id: string; name: string; email: string; emailVerified: boolean; role: string; isSuperAdmin: boolean; };
 company: Record<string, unknown>;
 verificationToken?: string;
}
