import { ServerClient } from 'postmark'

const postmark = process.env.POSTMARK_SERVER_TOKEN 
  ? new ServerClient(process.env.POSTMARK_SERVER_TOKEN)
  : null

export interface SendEmailOptions {
  to: string
  subject: string
  html: string
  text?: string
  from?: string
}

/**
 * Generic email sending function
 */
export async function sendEmail(options: SendEmailOptions) {
  const { to, subject, html, text, from = 'noreply@everling.io' } = options

  if (!postmark) {
    console.log('[MOCK EMAIL]')
    console.log('To:', to)
    console.log('Subject:', subject)
    console.log('Text:', text || 'No text version')
    return { success: true, mock: true }
  }

  try {
    const result = await postmark.sendEmail({
      From: from,
      To: to,
      Subject: subject,
      HtmlBody: html,
      TextBody: text || html.replace(/<[^>]*>/g, ''), // Strip HTML if no text provided
      MessageStream: 'outbound'
    })

    return { success: true, messageId: result.MessageID }
  } catch (error) {
    console.error('Failed to send email:', error)
    throw error
  }
}

