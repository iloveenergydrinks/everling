#!/usr/bin/env node

// Simple cron script for Railway
// This can be deployed as a separate Railway service with cron schedule

const https = require('https')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
const CRON_SECRET = process.env.CRON_SECRET

if (!APP_URL || !CRON_SECRET) {
  console.error('Missing required environment variables: APP_URL, CRON_SECRET')
  process.exit(1)
}

console.log(`Running cron job at ${new Date().toISOString()}`)

// Call the daily digest endpoint
const url = `${APP_URL}/api/cron/daily-digest?secret=${CRON_SECRET}`

https.get(url, (res) => {
  let data = ''
  
  res.on('data', (chunk) => {
    data += chunk
  })
  
  res.on('end', () => {
    console.log('Cron response status:', res.statusCode)
    console.log('Cron response:', data)
    
    if (res.statusCode === 200) {
      console.log('✅ Daily digest cron completed successfully')
      process.exit(0)
    } else {
      console.error('❌ Daily digest cron failed')
      process.exit(1)
    }
  })
}).on('error', (err) => {
  console.error('❌ Cron request failed:', err)
  process.exit(1)
})
