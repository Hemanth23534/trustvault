import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
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
  sendTestEmail?(to: string): Promise<EmailDeliveryResult>;
  verifyConnection?(): Promise<{ ok: boolean; error?: string }>;
}

export class SmtpEmailService implements EmailService {
  private readonly transporter: Transporter;
  private readonly fromEmail: string;
  private readonly logger?: Logger;

  constructor(options: {
    host: string;
    port: number;
    secure: boolean;
    user?: string;
    pass?: string;
    fromEmail: string;
    logger?: Logger;
    transporter?: Transporter;
  }) {
    this.fromEmail = options.fromEmail;
    this.logger = options.logger;

    if (options.transporter) {
      this.transporter = options.transporter;
    } else {
      this.transporter = nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.secure,
        auth:
          options.user && options.pass
            ? {
                user: options.user,
                // Sanitize Google App Password spaces if present (e.g. "abcd efgh ijkl mnop")
                pass: options.pass.replace(/\s+/g, ''),
              }
            : undefined,
        tls: {
          minVersion: 'TLSv1.2',
          rejectUnauthorized: true,
        },
        connectionTimeout: 4_000,
        greetingTimeout: 4_000,
        socketTimeout: 5_000,
      });
    }
  }

  async verifyConnection(): Promise<{ ok: boolean; error?: string }> {
    try {
      await this.transporter.verify();
      this.logger?.info('SMTP transporter connection verified successfully');
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger?.error({ error: message }, 'SMTP transporter verification failed');
      return { ok: false, error: message };
    }
  }

  async sendInvitationEmail(data: InvitationEmailData): Promise<EmailDeliveryResult> {
    const { subject, html, text } = renderInvitationEmail(data);

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(
          new Error(
            'SMTP delivery timed out after 5 seconds. (Note: Render Free tier blocks outbound SMTP ports 465/587; set RESEND_API_KEY to send via HTTP API or upgrade your Render tier).',
          ),
        );
      }, 5_000);
      timer.unref?.();
    });

    try {
      const sendPromise = this.transporter.sendMail({
        from: this.fromEmail,
        to: data.to,
        subject,
        html,
        text,
      });

      const info = await Promise.race([sendPromise, timeoutPromise]);

      this.logger?.info(
        {
          recipient: data.to,
          company: data.companyName,
          messageId: info.messageId,
        },
        'Invitation email accepted by SMTP server',
      );

      return {
        ok: true,
        messageId: info.messageId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger?.error(
        {
          recipient: data.to,
          company: data.companyName,
          error: message,
        },
        'SMTP email delivery failed',
      );

      return {
        ok: false,
        error: message,
      };
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async sendTestEmail(to: string): Promise<EmailDeliveryResult> {
    try {
      const info = await this.transporter.sendMail({
        from: this.fromEmail,
        to,
        subject: 'TrustVault — Gmail SMTP Test Email',
        text: `This is a test email from TrustVault confirming Gmail SMTP delivery is active and working.\n\nTimestamp: ${new Date().toISOString()}`,
        html: `<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 24px; background: #0b0f19; color: #e2e8f0; border-radius: 8px;">
          <h2 style="color: #6366f1; margin: 0 0 12px 0;">TrustVault &mdash; Gmail SMTP Test</h2>
          <p style="margin: 0 0 16px 0; color: #cbd5e1;">Your Gmail SMTP connection is configured and working properly!</p>
          <div style="background: #151d30; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #94a3b8;">
            <strong>Delivered at:</strong> ${new Date().toUTCString()}
          </div>
        </div>`,
      });

      this.logger?.info({ to, messageId: info.messageId }, 'Test email delivered via Gmail SMTP');
      return { ok: true, messageId: info.messageId };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger?.error({ to, error: message }, 'Failed to deliver test email via Gmail SMTP');
      return { ok: false, error: message };
    }
  }
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

    let timer: NodeJS.Timeout | undefined;
    const timeoutPromise = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error('Resend email delivery timed out after 5 seconds.'));
      }, 5_000);
      timer.unref?.();
    });

    try {
      const sendPromise = this.resend.emails.send({
        from: this.fromEmail,
        to: data.to,
        subject,
        html,
        text,
      });

      const response = await Promise.race([sendPromise, timeoutPromise]);

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
    } finally {
      if (timer) clearTimeout(timer);
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
      '[DEV/TEST] Invitation email simulated (neither Gmail SMTP nor Resend configured)',
    );

    return {
      ok: true,
      messageId: `simulated-${Date.now()}`,
    };
  }
}

export function createEmailService(env: Env, logger?: Logger): EmailService {
  if (env.email.provider === 'smtp' && env.email.smtp?.user && env.email.smtp?.pass) {
    return new SmtpEmailService({
      host: env.email.smtp.host,
      port: env.email.smtp.port,
      secure: env.email.smtp.secure,
      user: env.email.smtp.user,
      pass: env.email.smtp.pass,
      fromEmail: env.email.fromEmail,
      logger,
    });
  }

  if (env.email.provider === 'resend' && env.email.resendApiKey && env.email.resendApiKey.trim() !== '') {
    return new ResendEmailService({
      apiKey: env.email.resendApiKey.trim(),
      fromEmail: env.email.fromEmail,
      logger,
    });
  }

  return new ConsoleEmailService(logger);
}
