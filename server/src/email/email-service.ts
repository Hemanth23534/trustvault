import { Resend } from 'resend';
import type { Env } from '../config/env.js';
import type { Logger } from '../config/logger.js';
import { renderInvitationEmail, type InvitationEmailData } from './invitation-template.js';

export type { InvitationEmailData };

export interface EmailDeliveryResult {
  ok: boolean;
  messageId?: string;
  error?: string;
}

export interface EmailService {
  sendInvitationEmail(data: InvitationEmailData): Promise<EmailDeliveryResult>;
}

export class ResendEmailService implements EmailService {
  private readonly resend: Resend;
  private readonly fromEmail: string;
  private readonly logger?: Logger;

  constructor(options: { apiKey: string; fromEmail: string; logger?: Logger }) {
    this.resend = new Resend(options.apiKey);
    this.fromEmail = options.fromEmail;
    this.logger = options.logger;
  }

  async sendInvitationEmail(data: InvitationEmailData): Promise<EmailDeliveryResult> {
    const { subject, html, text } = renderInvitationEmail(data);

    try {
      const response = await this.resend.emails.send({
        from: this.fromEmail,
        to: data.to,
        subject,
        html,
        text,
      });

      if (response.error) {
        this.logger?.error(
          {
            recipient: data.to,
            company: data.companyName,
            providerError: response.error.message,
            providerName: (response.error as { name?: string }).name,
          },
          'Email delivery rejected by Resend',
        );

        return {
          ok: false,
          error: response.error.message,
        };
      }

      const messageId = response.data?.id;

      this.logger?.info(
        {
          recipient: data.to,
          company: data.companyName,
          messageId,
        },
        'Invitation email accepted by Resend',
      );

      return {
        ok: true,
        messageId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger?.error(
        {
          recipient: data.to,
          company: data.companyName,
          error: message,
        },
        'Exception occurred during Resend email delivery',
      );

      return {
        ok: false,
        error: message,
      };
    }
  }
}

export class ConsoleEmailService implements EmailService {
  private readonly logger?: Logger;

  constructor(logger?: Logger) {
    this.logger = logger;
  }

  async sendInvitationEmail(data: InvitationEmailData): Promise<EmailDeliveryResult> {
    this.logger?.info(
      {
        recipient: data.to,
        company: data.companyName,
        role: data.role,
        inviteUrl: data.inviteUrl,
      },
      '[DEV/TEST] Invitation email simulated (RESEND_API_KEY not configured)',
    );

    return {
      ok: true,
      messageId: `simulated-${Date.now()}`,
    };
  }
}

export function createEmailService(env: Env, logger?: Logger): EmailService {
  if (env.email.resendApiKey && env.email.resendApiKey.trim() !== '') {
    return new ResendEmailService({
      apiKey: env.email.resendApiKey.trim(),
      fromEmail: env.email.fromEmail,
      logger,
    });
  }

  return new ConsoleEmailService(logger);
}
