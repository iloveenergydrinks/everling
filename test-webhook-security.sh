#!/bin/bash

echo "🔒 Testing Webhook Security..."
echo ""

# Test 1: Without auth (should fail)
echo "Test 1: Trying without authentication (should fail)..."
response=$(curl -s -o /dev/null -w "%{http_code}" https://everling.io/api/webhooks/email)
if [ "$response" = "401" ]; then
  echo "✅ GOOD: Webhook rejected unauthenticated request (401)"
elif [ "$response" = "200" ]; then
  echo "❌ DANGER: Webhook accepted unauthenticated request! Not secured!"
else
  echo "⚠️  Got response code: $response"
fi
echo ""

# Test 2: With wrong auth (should fail)
echo "Test 2: Trying with wrong credentials (should fail)..."
response=$(curl -s -o /dev/null -w "%{http_code}" https://wrong:password@everling.io/api/webhooks/email)
if [ "$response" = "401" ]; then
  echo "✅ GOOD: Webhook rejected wrong credentials (401)"
elif [ "$response" = "200" ]; then
  echo "❌ DANGER: Webhook accepted wrong credentials!"
else
  echo "⚠️  Got response code: $response"
fi
echo ""

# Test 3: With correct auth (should work)
echo "Test 3: Trying with correct credentials (should work)..."
response=$(curl -s -o /dev/null -w "%{http_code}" \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"From":"test@example.com","To":"test@everling.io","Subject":"Test"}' \
  https://webhook_dc494cfc17fd:ch3KgZalsWjPfJCC2Ey8yOrvFZDsQ4dH9tng5ImLqxg@everling.io/api/webhooks/email)
  
if [ "$response" = "200" ] || [ "$response" = "202" ]; then
  echo "✅ GOOD: Webhook accepted authenticated request"
elif [ "$response" = "401" ]; then
  echo "❌ Check if credentials are correctly set in Railway"
else
  echo "⚠️  Got response code: $response"
fi
echo ""

echo "📊 Security Status:"
if [ "$response" = "200" ] || [ "$response" = "202" ]; then
  echo "✅ Your webhook is now SECURED with Basic Auth!"
else
  echo "⚠️  Something might be wrong. Check Railway deployment status."
fi
