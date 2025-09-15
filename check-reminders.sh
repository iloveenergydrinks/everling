#!/bin/bash
# Check for due reminders every 5 minutes
curl -X GET 'http://localhost:3000/api/cron/reminders?secret=your-secret-key-here'
