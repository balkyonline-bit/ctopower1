// Email sending seam — dependency-free. The feature/UI layer ONLY calls
// getEmailSender().send(...) from ./index.ts and never constructs a concrete
// provider class. Swapping in a real provider (SMTP, Resend, SendGrid, SES)
// later = implement EmailSender, add one REGISTRY entry, flip the provider.

export interface EmailSendArgs {
  to: string; // recipient address
  toName?: string;
  subject: string;
  html: string;
  text?: string; // plain-text fallback (compliance)
  replyTo?: string;
  metadata?: {
    subscriberId?: string;
    campaignId?: string;
    listId?: string;
    sequenceStepId?: string;
  };
}

export interface EmailSendResult {
  ok: boolean;
  providerMessageId?: string; // filled by a real provider
  error?: string;
}

export interface EmailSender {
  readonly name: string; // 'noop' | 'smtp' | 'resend' | ...
  send(args: EmailSendArgs): Promise<EmailSendResult>;
}