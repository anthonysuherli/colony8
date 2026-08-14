#!/usr/bin/env bash
# Build + push the image, create/update the Lambda, expose a function URL.
set -euo pipefail
REGION=${AWS_REGION:-us-east-1}
ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
REPO=colony8
IMG=$ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest

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
  aws lambda create-function-url-config --function-name colony8 --auth-type NONE \
    --cors '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"]}' --region $REGION
  aws lambda add-permission --function-name colony8 --action lambda:InvokeFunctionUrl \
    --principal '*' --function-url-auth-type NONE --statement-id public --region $REGION
else
  aws lambda update-function-code --function-name colony8 --image-uri $IMG --region $REGION
fi

aws lambda update-function-configuration --function-name colony8 --region $REGION \
  --environment "Variables={DATABASE_URL=$DATABASE_URL,BEDROCK_MODEL_ID=${BEDROCK_MODEL_ID:-anthropic.claude-opus-5},BEDROCK_EMBED_MODEL_ID=${BEDROCK_EMBED_MODEL_ID:-amazon.titan-embed-text-v2:0},EMBED_DIM=${EMBED_DIM:-1024},FLEET_SIZE=${FLEET_SIZE:-3},DEMO_MODE=${DEMO_MODE:-true},TAVILY_API_KEY=${TAVILY_API_KEY:-},CRDB_MCP_URL=${CRDB_MCP_URL:-},CRDB_MCP_TOKEN=${CRDB_MCP_TOKEN:-}}"

aws lambda get-function-url-config --function-name colony8 --region $REGION \
  --query FunctionUrl --output text
