import nodemailer from 'nodemailer'
import { env } from './env'

export function createTransport() {
  // Hostinger (mr3x.com.br) SMTP over SSL (465)
  return nodemailer.createTransport({
    host: env.MAIL_HOST || 'smtp.hostinger.com',
    port: Number(env.MAIL_PORT || 465),
    secure: Number(env.MAIL_PORT || 465) === 465, // true for 465
    auth: {
      user: env.MAIL_USER,
      pass: env.MAIL_PASS,
    },
  })
}

export async function sendEmail(options: { to: string; subject: string; html?: string; text?: string; fromName?: string }) {
  const transporter = createTransport()
  const from = `${options.fromName || 'MR3X'} <${env.MAIL_USER}>`
  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
  })
}


