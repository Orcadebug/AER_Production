#!/bin/bash
# Test script for MCP endpoint
# Usage: ./test-mcp-endpoint.sh <your_aer_token>

if [ -z "$1" ]; then
  echo "Usage: $0 <aer_token>"
  echo "Example: $0 aer_jd7abc123def456"
  exit 1
fi

TOKEN="$1"
BASE_URL="https://brilliant-caribou-800.convex.site"

echo "Testing MCP endpoint with token: $TOKEN"
echo ""

echo "1. Testing get_user_stats..."
curl -X POST "$BASE_URL/api/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool":"get_user_stats","args":{}}' \
  | jq '.'

echo ""
echo "2. Testing list_contexts..."
curl -X POST "$BASE_URL/api/mcp" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"tool":"list_contexts","args":{"limit":10}}' \
  | jq '.'

echo ""
echo "Done!"
