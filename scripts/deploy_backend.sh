#!/usr/bin/env bash
# Build + push the image, create/update the Lambda, expose it via API Gateway.
# (Function URLs returned 403 on our account despite a correct NONE-auth public
# policy; an HTTP API in front of the Lambda is the portable choice.)
set -euo pipefail
REGION=${AWS_REGION:-us-east-1}
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REPO=colony8
IMG=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest

# Lambda rejects OCI attestation manifests that recent buildx attaches by default.
export BUILDX_NO_DEFAULT_ATTESTATIONS=1

aws ecr describe-repositories --repository-names $REPO --region $REGION >/dev/null 2>&1 \
  || aws ecr create-repository --repository-name $REPO --region $REGION
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin \
  $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
docker build --platform linux/amd64 -t $IMG .
docker push $IMG

if ! aws lambda get-function --function-name colony8 --region $REGION >/dev/null 2>&1; then
  aws iam create-role --role-name colony8-lambda --assume-role-policy-document \
    '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}' || true
  aws iam attach-role-policy --role-name colony8-lambda \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  aws iam attach-role-policy --role-name colony8-lambda \
    --policy-arn arn:aws:iam::aws:policy/AmazonBedrockFullAccess
  sleep 10
  aws lambda create-function --function-name colony8 --package-type Image --code ImageUri=$IMG \
    --role arn:aws:iam::$ACCOUNT:role/colony8-lambda --timeout 900 --memory-size 1024 \
    --region $REGION
else
  aws lambda update-function-code --function-name colony8 --image-uri $IMG --region $REGION
  aws lambda wait function-updated --function-name colony8 --region $REGION
fi

# The CLI's Variables={...} shorthand cannot parse '=' inside values (every
# DATABASE_URL has one), so the environment goes through a JSON file.
ENVFILE=$(mktemp)
python3 - "$ENVFILE" <<'PY'
import json, os, sys
keys = ["DATABASE_URL", "BEDROCK_MODEL_ID", "BEDROCK_EMBED_MODEL_ID", "EMBED_DIM",
        "FLEET_SIZE", "DEMO_MODE", "ALLOW_LAUNCH", "TAVILY_API_KEY",
        "CRDB_MCP_URL", "CRDB_MCP_TOKEN"]
defaults = {"BEDROCK_MODEL_ID": "us.amazon.nova-pro-v1:0",
            "BEDROCK_EMBED_MODEL_ID": "amazon.titan-embed-text-v2:0",
            "EMBED_DIM": "1024", "FLEET_SIZE": "3",
            "DEMO_MODE": "true", "ALLOW_LAUNCH": "false",
            "CRDB_MCP_URL": "https://cockroachlabs.cloud/mcp"}
env = {k: v for k in keys if (v := os.environ.get(k, defaults.get(k, "")))}
json.dump({"Variables": env}, open(sys.argv[1], "w"))
PY
aws lambda update-function-configuration --function-name colony8 --region $REGION \
  --environment file://$ENVFILE >/dev/null
rm -f $ENVFILE

API=$(aws apigatewayv2 get-apis --region $REGION \
  --query "Items[?Name=='colony8'].ApiId | [0]" --output text)
if [ "$API" = "None" ] || [ -z "$API" ]; then
  API=$(aws apigatewayv2 create-api --name colony8 --protocol-type HTTP \
    --target arn:aws:lambda:$REGION:$ACCOUNT:function:colony8 \
    --cors-configuration 'AllowOrigins=*,AllowMethods=*,AllowHeaders=*' \
    --region $REGION --query ApiId --output text)
  aws lambda add-permission --function-name colony8 --statement-id apigw \
    --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT:$API/*" --region $REGION >/dev/null
fi

echo "https://$API.execute-api.$REGION.amazonaws.com"
