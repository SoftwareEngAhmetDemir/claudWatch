# claudWatch

Hello World Express API on AWS Lambda + API Gateway, monitored with CloudWatch
(access logs, structured app logs, metrics, alarms, dashboard).

## Run locally
    npm install && npm start      # http://localhost:3000

## Deploy (CI/CD)
1. One-time, with admin AWS credentials:

       aws cloudformation deploy --template-file bootstrap/github-oidc.yaml \
         --stack-name claudwatch-github-oidc --capabilities CAPABILITY_NAMED_IAM \
         --parameter-overrides GitHubRepo=<owner>/<repo>

   Copy the `RoleArn` output.
2. In GitHub repo settings: add secret `AWS_ROLE_ARN` (that ARN); optionally variables
   `AWS_REGION` (default us-east-1) and `ALARM_EMAIL`.
3. Push to `main` — `.github/workflows/deploy.yml` builds, deploys and smoke-tests.

## Monitoring
The stack outputs `ApiUrl` and `DashboardUrl`. Logs: `/aws/lambda/<fn>` and
`/aws/apigateway/claudwatch-api-access`. Alarms (5xx, p95 latency, Lambda errors) notify via SNS email.
