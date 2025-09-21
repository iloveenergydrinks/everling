import { prisma } from '@/lib/prisma'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_API_BASE = 'https://www.googleapis.com/calendar/v3'

async function getAccessTokenFromRefresh(refreshToken: string): Promise<string | null> {
  try {
    const params = new URLSearchParams()
    params.set('client_id', process.env.GOOGLE_CLIENT_ID || '')
    params.set('client_secret', process.env.GOOGLE_CLIENT_SECRET || '')
    params.set('grant_type', 'refresh_token')
    params.set('refresh_token', refreshToken)

    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString()
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.access_token || null
  } catch (e) {
    console.error('Google token refresh error:', e)
    return null
  }
}

export async function listGoogleCalendars(userId: string): Promise<Array<{ id: string; summary: string }>> {
  const user = await prisma.user.findUnique({ where: { id: userId } })
  if (!user?.googleRefreshToken) return []
  const accessToken = await getAccessTokenFromRefresh(user.googleRefreshToken)
  if (!accessToken) return []
  try {
    const res = await fetch(`${GOOGLE_API_BASE}/users/me/calendarList`, {
      headers: { Authorization: `Bearer ${accessToken}` }
    })
    if (!res.ok) return []
    const data = await res.json()
    const items = Array.isArray(data.items) ? data.items : []
    return items.map((c: any) => ({ id: String(c.id), summary: String(c.summary) }))
  } catch (e) {
    console.error('List calendars error:', e)
    return []
  }
}

export async function upsertGoogleCalendarEvent(userId: string, taskId: string): Promise<void> {
  try {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user || !user.calendarAutoPush || user.calendarProvider !== 'google' || !user.googleRefreshToken) return

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task || !task.dueDate) return

    const accessToken = await getAccessTokenFromRefresh(user.googleRefreshToken)
    if (!accessToken) return

    const calendarId = user.calendarDefaultId || 'primary'
    const start = new Date(task.dueDate)
    const end = new Date(start.getTime() + 30 * 60 * 1000)
    const timeZone = user.timezone || 'UTC'

    const eventBody = {
      summary: task.title,
      description: task.description || '',
      start: { dateTime: start.toISOString(), timeZone },
      end: { dateTime: end.toISOString(), timeZone },
      reminders: { useDefault: true }
    }

    let eventId = task.externalEventId
    let method = 'POST'
    let url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`
    if (task.externalProvider === 'google' && task.externalCalendarId === calendarId && eventId) {
      method = 'PATCH'
      url = `${GOOGLE_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`
    }

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(eventBody)
    })
    if (!res.ok) {
      console.warn('Google event upsert failed', await res.text())
      return
    }
    const created = await res.json()
    const newEventId = created.id as string

    await prisma.task.update({
      where: { id: task.id },
      data: {
        externalProvider: 'google',
        externalCalendarId: calendarId,
        externalEventId: newEventId,
        lastCalendarSyncAt: new Date()
      }
    })
  } catch (e) {
    console.error('upsertGoogleCalendarEvent error:', e)
  }
}


