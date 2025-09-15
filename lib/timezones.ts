// Common timezones organized by region
export const timezones = [
  { label: '🌎 Americas', options: [
    { value: 'America/New_York', label: 'Eastern Time (ET)', offset: '-05:00' },
    { value: 'America/Chicago', label: 'Central Time (CT)', offset: '-06:00' },
    { value: 'America/Denver', label: 'Mountain Time (MT)', offset: '-07:00' },
    { value: 'America/Los_Angeles', label: 'Pacific Time (PT)', offset: '-08:00' },
    { value: 'America/Toronto', label: 'Toronto', offset: '-05:00' },
    { value: 'America/Vancouver', label: 'Vancouver', offset: '-08:00' },
    { value: 'America/Mexico_City', label: 'Mexico City', offset: '-06:00' },
    { value: 'America/Sao_Paulo', label: 'São Paulo', offset: '-03:00' },
    { value: 'America/Buenos_Aires', label: 'Buenos Aires', offset: '-03:00' },
  ]},
  { label: '🌍 Europe & Africa', options: [
    { value: 'Europe/London', label: 'London (GMT)', offset: '+00:00' },
    { value: 'Europe/Paris', label: 'Paris (CET)', offset: '+01:00' },
    { value: 'Europe/Berlin', label: 'Berlin', offset: '+01:00' },
    { value: 'Europe/Rome', label: 'Rome', offset: '+01:00' },
    { value: 'Europe/Madrid', label: 'Madrid', offset: '+01:00' },
    { value: 'Europe/Amsterdam', label: 'Amsterdam', offset: '+01:00' },
    { value: 'Europe/Stockholm', label: 'Stockholm', offset: '+01:00' },
    { value: 'Europe/Moscow', label: 'Moscow', offset: '+03:00' },
    { value: 'Africa/Cairo', label: 'Cairo', offset: '+02:00' },
    { value: 'Africa/Johannesburg', label: 'Johannesburg', offset: '+02:00' },
    { value: 'Africa/Lagos', label: 'Lagos', offset: '+01:00' },
  ]},
  { label: '🌏 Asia & Pacific', options: [
    { value: 'Asia/Dubai', label: 'Dubai', offset: '+04:00' },
    { value: 'Asia/Mumbai', label: 'Mumbai', offset: '+05:30' },
    { value: 'Asia/Singapore', label: 'Singapore', offset: '+08:00' },
    { value: 'Asia/Hong_Kong', label: 'Hong Kong', offset: '+08:00' },
    { value: 'Asia/Shanghai', label: 'Shanghai', offset: '+08:00' },
    { value: 'Asia/Tokyo', label: 'Tokyo', offset: '+09:00' },
    { value: 'Asia/Seoul', label: 'Seoul', offset: '+09:00' },
    { value: 'Australia/Sydney', label: 'Sydney', offset: '+11:00' },
    { value: 'Australia/Melbourne', label: 'Melbourne', offset: '+11:00' },
    { value: 'Pacific/Auckland', label: 'Auckland', offset: '+13:00' },
  ]},
]

// Generate time options for digest (every 30 minutes)
export function getTimeOptions() {
  const times = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, '0')
      const m = minute.toString().padStart(2, '0')
      const time24 = `${h}:${m}`
      
      // Convert to 12-hour format for display
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      const display = `${displayHour}:${m} ${period}`
      
      times.push({ value: time24, label: display })
    }
  }
  return times
}

// Get user's timezone automatically
export function getUserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone
  } catch {
    return 'America/New_York' // Default fallback
  }
}

// Convert time to user's local timezone
export function convertToUserTime(time: string, fromTimezone: string, toTimezone: string): string {
  // This would need a proper implementation with date-fns-tz or similar
  // For now, returning the same time
  return time
}
