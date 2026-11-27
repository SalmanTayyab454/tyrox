#!/usr/bin/env bash
# Notify IndexNow (Bing and other engines) that key pages changed.
set -euo pipefail

KEY="c0b366b011ebee38ef816f2c488d9dcc"
HOST="tyrox.net"

payload=$(cat <<EOF
{
  "host": "${HOST}",
  "key": "${KEY}",
  "keyLocation": "https://${HOST}/${KEY}.txt",
  "urlList": [
    "https://${HOST}/",
    "https://${HOST}/Consultants/haroon_tayyab_vascular-surgeon.html",
    "https://${HOST}/Consultants/aaliya_mirza_psychiatrist.html"
  ]
}
EOF
)

echo "Submitting URLs to IndexNow…"
code=$(curl -sS -o /tmp/indexnow-response.txt -w "%{http_code}" \
  -X POST "https://api.indexnow.org/indexnow" \
  -H "Content-Type: application/json; charset=utf-8" \
  -d "$payload")

echo "IndexNow HTTP ${code}"
if [[ -s /tmp/indexnow-response.txt ]]; then
  cat /tmp/indexnow-response.txt
  echo
fi

if [[ "$code" != "200" && "$code" != "202" ]]; then
  exit 1
fi
