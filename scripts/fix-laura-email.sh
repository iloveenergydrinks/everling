#!/bin/bash

echo "🔍 First, let's find Laura's organization details..."

# Look up the organization by email prefix
curl -s "https://everling.io/api/admin/add-allowed-email?emailPrefix=antoniacomilaura&userEmail=antoniacomi.laura@gmail.com" \
  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" | jq '.'

echo ""
echo "📧 To add antoniacomi.laura@gmail.com to the allowed emails list:"
echo ""
echo "1. Log into https://everling.io as an admin"
echo "2. Open browser DevTools (F12) > Network tab"
echo "3. Find any request and copy the 'Cookie' header value"
echo "4. Run this command with your session token:"
echo ""
echo 'curl -X POST https://everling.io/api/admin/add-allowed-email \'
echo '  -H "Content-Type: application/json" \'
echo '  -H "Cookie: next-auth.session-token=YOUR_SESSION_TOKEN" \'
echo '  -d "{"email":"antoniacomi.laura@gmail.com","organizationId":"ORGANIZATION_ID","note":"Laura - organization owner"}"'
echo ""
echo "OR simply:"
echo ""
echo "1. Log into https://everling.io"
echo "2. Go to Settings"
echo "3. Under 'Email Forwarding' > 'Allowed senders'"
echo "4. Click 'Add Email'"
echo "5. Enter: antoniacomi.laura@gmail.com"
echo "6. Add note: 'Laura - organization owner'"
echo "7. Click 'Add'"
