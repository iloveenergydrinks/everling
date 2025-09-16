#!/usr/bin/env node

// Simple cron script for Railway
// This can be deployed as a separate Railway service with cron schedule

const https = require('https')
const url = require('url')

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL
const CRON_SECRET = process.env.CRON_SECRET

if (!APP_URL || !CRON_SECRET) {
  console.error('Missing required environment variables: APP_URL, CRON_SECRET')
  process.exit(1)
}

console.log(`Running cron jobs at ${new Date().toISOString()}`)

// Helper function to call an endpoint
function callEndpoint(endpoint, name) {
  return new Promise((resolve, reject) => {
    const fullUrl = `${APP_URL}${endpoint}?secret=${CRON_SECRET}`
    const parsedUrl = url.parse(fullUrl)
    
    https.get(parsedUrl, (res) => {
      let data = ''
      
      res.on('data', (chunk) => {
        data += chunk
      })
      
      res.on('end', () => {
        console.log(`${name} - Status: ${res.statusCode}`)
        console.log(`${name} - Response: ${data}`)
        
        if (res.statusCode === 200) {
          console.log(`✅ ${name} completed successfully`)
          resolve(true)
        } else {
          console.error(`❌ ${name} failed`)
          resolve(false)
        }
      })
    }).on('error', (err) => {
      console.error(`❌ ${name} request failed:`, err)
      resolve(false)
    })
  })
}

// Run all cron tasks
async function runAllTasks() {
  const results = await Promise.all([
    callEndpoint('/api/cron/daily-digest', 'Daily Digest'),
    callEndpoint('/api/cron/cleanup-links', 'Cleanup Short Links')
  ])
  
  const allSuccess = results.every(r => r === true)
  
  if (allSuccess) {
    console.log('\n✅ All cron tasks completed successfully')
    process.exit(0)
  } else {
    console.log('\n⚠️ Some cron tasks failed')
    process.exit(1)
  }
}

runAllTasks()
