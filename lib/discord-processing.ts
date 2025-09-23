// In-memory Discord processing state (server-only)

type RecentItem = {
  id: string
  title?: string
  at: Date
}

let inFlightCount = 0
let recent: RecentItem[] = []
let lastActivityAt: number = 0
const GRACE_MS = 2000 // keep "processing" true briefly so UI can catch it

export function startDiscordProcessing(messageId: string) {
  inFlightCount = Math.max(0, inFlightCount + 1)
  lastActivityAt = Date.now()
}

export function finishDiscordProcessing(messageId: string, createdTitles?: string[]) {
  inFlightCount = Math.max(0, inFlightCount - 1)
  const now = new Date()
  lastActivityAt = now.getTime()
  if (createdTitles && createdTitles.length > 0) {
    for (const t of createdTitles.slice(0, 3)) {
      recent.unshift({ id: messageId, title: t, at: now })
    }
  } else {
    recent.unshift({ id: messageId, at: now })
  }
  // Keep last 5
  recent = recent.slice(0, 5)
}

export function getDiscordProcessingStatus() {
  // Trim very old items (older than 10s) from recent
  const cutoff = Date.now() - 10_000
  recent = recent.filter(r => r.at.getTime() >= cutoff)
  const withinGrace = Date.now() - lastActivityAt < GRACE_MS
  const isProcessing = inFlightCount > 0 || withinGrace
  const count = inFlightCount > 0 ? inFlightCount : (withinGrace ? 1 : 0)
  return {
    isProcessing,
    processingCount: count,
    recentlyProcessed: recent
  }
}


