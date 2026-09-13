import type { EmailSender, EmailSendArgs, EmailSendResult } from "./types";

/** PLACEHOLDER — no network send. Real provider replaces this. */
export class NoopSender implements EmailSender {
  readonly name = "noop";

  async send(_args: EmailSendArgs): Promise<EmailSendResult> {
    // Nothing leaves this machine. The feature layer records the outgoing
    // email_sends row (status 'pending') in its own transaction — this class
    // exists so the seam contract is exercised end-to-end without a provider.
    return { ok: true };
  }
}