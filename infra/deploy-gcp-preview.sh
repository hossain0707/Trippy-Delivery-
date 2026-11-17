#!/usr/bin/env bash
set -euo pipefail

# DEVELOPMENT PREVIEW ONLY; never repurpose for real customer orders.
# This script deploys exclusively to a dedicated TRIPPY Delivery GCP project.
EXPECTED_PROJECT_ID="trippy-delivery-2026"
SERVICE="trippy-delivery-api-dev"
REGION="asia-south1"
PAGES_ORIGIN="${PAGES_ORIGIN:-https://trippy-delivery.pages.dev}"

if ! command -v gcloud >/dev/null 2>&1; then
  echo "gcloud CLI is required" >&2
  exit 1
fi
ACTUAL_PROJECT_ID="$(gcloud config get-value project 2>/dev/null)"
if [[ "$ACTUAL_PROJECT_ID" != "$EXPECTED_PROJECT_ID" ]]; then
  echo "Refusing deployment: active gcloud project is '$ACTUAL_PROJECT_ID', expected '$EXPECTED_PROJECT_ID'." >&2
  echo "Run: gcloud config set project $EXPECTED_PROJECT_ID" >&2
  exit 1
fi
if [[ ! -f services/api/Dockerfile ]]; then
  echo "Run this from the TRIPPY Delivery repository root." >&2
  exit 1
fi

echo "Deploying $SERVICE only to $EXPECTED_PROJECT_ID, $REGION"
gcloud run deploy "$SERVICE" \
  --project="$EXPECTED_PROJECT_ID" \
  --region="$REGION" \
  --source=services/api \
  --port=8000 \
  --allow-unauthenticated \
  --min-instances=0 \
  --max-instances=1 \
  --cpu=1 \
  --memory=512Mi \
  --concurrency=10 \
  --timeout=30s \
  --set-env-vars="APP_ENV=preview,ALLOW_DEV_AUTH=false,ACTIVE_CITIES=dhaka,CORS_ORIGINS=$PAGES_ORIGIN"

echo "Only the read-only preview API is authorized. Do NOT enable real orders."
