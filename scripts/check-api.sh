#!/bin/bash

# Simple script to check if the API is healthy
# Usage: 
#   ./scripts/check-api.sh                          # Check localhost:3000
#   ./scripts/check-api.sh https://your-app.com     # Check production

URL="${1:-http://localhost:3000}"
ENDPOINT="$URL/api/health"

echo "🏥 Checking API health at: $ENDPOINT"
echo ""

RESPONSE=$(curl -s -w "\n%{http_code}" "$ENDPOINT")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ API is UP and healthy!"
    echo ""
    echo "Response:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    exit 0
else
    echo "❌ API is DOWN or unhealthy"
    echo "HTTP Status: $HTTP_CODE"
    echo "Response: $BODY"
    exit 1
fi

