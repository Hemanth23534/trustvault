import { loadEnv } from '../src/config/env.js';
import { SmtpEmailService } from '../src/email/email-service.js';

async function main() {
  console.log('====================================================');
  console.log(' TrustVault — Gmail SMTP Configuration Diagnostics');
  console.log('====================================================\n');

  const { env, warnings } = loadEnv();

  for (const warning of warnings) {
    console.warn(`[WARN] ${warning}`);
  }

  const { smtp, fromEmail } = env.email;
  const targetEmail = process.argv[2];

  if (!smtp?.user || !smtp?.pass) {
    console.error('❌ Gmail SMTP is not configured.\n');
    console.error('Missing required environment variables:');
    if (!smtp?.user) console.error('  - SMTP_USER: not set (e.g. yourname@gmail.com)');
    if (!smtp?.pass) {
      console.error(
        '  - SMTP_PASS: not set (16-character Google App Password from https://myaccount.google.com/apppasswords)',
      );
    }
    console.error('\nCurrent values:');
    console.error(`  - SMTP_HOST: ${smtp?.host ?? 'smtp.gmail.com'}`);
    console.error(`  - SMTP_PORT: ${smtp?.port ?? 465}`);
    console.error(`  - SMTP_SECURE: ${smtp?.secure ?? true}`);
    console.error(`  - MAIL_FROM: ${fromEmail}`);
    console.error('\nTo fix: Set SMTP_USER and SMTP_PASS in your environment or .env file.\n');
    process.exit(1);
  }

  console.log('Active Configuration:');
  console.log(`  - Provider: ${env.email.provider}`);
  console.log(`  - Host: ${smtp.host}`);
  console.log(`  - Port: ${smtp.port}`);
  console.log(`  - Secure TLS: ${smtp.secure}`);
  console.log(`  - User: ${smtp.user}`);
  console.log(`  - Password: [REDACTED ${smtp.pass.length} chars]`);
  console.log(`  - From Address: ${fromEmail}\n`);

  console.log(`Connecting to ${smtp.host}:${smtp.port} and verifying credentials...`);

  const service = new SmtpEmailService({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    user: smtp.user,
    pass: smtp.pass,
    fromEmail,
  });

  const verifyResult = await service.verifyConnection();

  if (!verifyResult.ok) {
    console.error(`\n❌ SMTP Connection failed: ${verifyResult.error}`);
    console.error('\nTroubleshooting tips for Gmail:');
    console.error('  1. Ensure 2-Step Verification is turned ON for your Google account.');
    console.error('  2. Generate a dedicated App Password at: https://myaccount.google.com/apppasswords');
    console.error('  3. Do NOT use your normal Google account password.');
    console.error('  4. Set SMTP_HOST=smtp.gmail.com and SMTP_PORT=465 (secure TLS: true).');
    process.exit(1);
  }

  console.log('✅ SMTP connection and TLS authentication successful!');

  if (targetEmail) {
    console.log(`\nDispatching real test email to: ${targetEmail}...`);
    const sendResult = await service.sendTestEmail(targetEmail);
    if (!sendResult.ok) {
      console.error(`\n❌ Failed to deliver test email: ${sendResult.error}`);
      process.exit(1);
    }
    console.log(`✅ Test email delivered successfully!`);
    console.log(`   Message ID: ${sendResult.messageId}`);
  } else {
    console.log('\n💡 Tip: To send an actual test email to an inbox, run:');
    console.log('   npm run test:smtp <your-email@example.com>');
  }

  console.log('\nAll checks passed. TrustVault is ready to deliver workspace invitations via Gmail SMTP.');
}

void main();
