#!/usr/bin/env bash
# Build the UI against the API URL, ship to S3, front with CloudFront.
set -euo pipefail
REGION=${AWS_REGION:-us-east-1}
BUCKET=colony8-ui-$(aws sts get-caller-identity --query Account --output text)
API_URL=$1  # the API Gateway URL deploy_backend.sh printed, no trailing slash

cd frontend
echo "VITE_API_BASE=$API_URL" > .env.production
npm run build
aws s3 mb s3://$BUCKET --region $REGION 2>/dev/null || true
aws s3 website s3://$BUCKET --index-document index.html
aws s3 sync dist/ s3://$BUCKET --delete
# New buckets ship with Block Public Access on, which rejects the public
# read policy below — clear it first (this bucket exists only to serve the UI).
aws s3api put-public-access-block --bucket $BUCKET --public-access-block-configuration \
  BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false
aws s3api put-bucket-policy --bucket $BUCKET --policy "{
  \"Version\":\"2012-10-17\",\"Statement\":[{\"Effect\":\"Allow\",\"Principal\":\"*\",
  \"Action\":\"s3:GetObject\",\"Resource\":\"arn:aws:s3:::$BUCKET/*\"}]}"
DIST=$(aws cloudfront list-distributions --query \
  "DistributionList.Items[?Origins.Items[0].DomainName=='$BUCKET.s3.amazonaws.com'].Id | [0]" \
  --output text)
if [ "$DIST" = "None" ] || [ -z "$DIST" ]; then
  aws cloudfront create-distribution --origin-domain-name $BUCKET.s3.amazonaws.com \
    --default-root-object index.html --query "Distribution.DomainName" --output text
else
  aws cloudfront create-invalidation --distribution-id $DIST --paths "/*" >/dev/null
  aws cloudfront get-distribution --id $DIST --query "Distribution.DomainName" --output text
fi
