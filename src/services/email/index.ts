import type { EmailSender } from "./types";
import { NoopSender } from "./noop";

// Registry of available senders keyed by provider name. Feature code resolves
// a sender by name via getEmailSender() — never `new` a concrete class.
const REGISTRY: Record<string, () => EmailSender> = {
  noop: () => new NoopSender(),
  // 'smtp': () => new SmtpSender(), 'resend': () => new ResendSender(), ... // ← future
};

export function getEmailSender(provider: string = "noop"): EmailSender {
  const create = REGISTRY[provider] ?? REGISTRY.noop;
  return create();
}