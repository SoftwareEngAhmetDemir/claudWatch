# claudWatch: project notes for Claude

Hello World Express API deployed to AWS (Lambda + API Gateway) with CloudWatch monitoring.
Deploys automatically from GitHub Actions on every push / merge to `main`.

## Secrets policy
- No AWS access keys or IAM users exist or should be created. GitHub signs in to AWS with OIDC.
- Never write secret values into this repo. Only names and non-secret identifiers are listed here.
- The local machine has **no AWS credentials configured** (`aws configure` was never run). AWS work
  was done in the AWS Console (CloudFormation UI / CloudShell). To use the CLI locally, the user must sign in first.

## Accounts and identifiers
| Item | Value |
|---|---|
| GitHub repo | `SoftwareEngAhmetDemir/claudWatch` (branch `main`) |
| AWS account ID | `087134855638` |
| AWS region | `us-east-1` (N. Virginia) |
| Deploy role | `arn:aws:iam::087134855638:role/claudwatch-github-deploy` |
| OIDC provider | `token.actions.githubusercontent.com` (already existed in the account, audience `sts.amazonaws.com`) |
| Live API URL | https://ac7kzndm64.execute-api.us-east-1.amazonaws.com/ |
| CloudWatch dashboard | https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#dashboards:name=claudwatch-api-dashboard |

## GitHub configuration (Settings > Secrets and variables > Actions)
- Secret `AWS_ROLE_ARN` = the deploy role ARN above (set).
- Variable `AWS_REGION` (optional, defaults to `us-east-1` in the workflow). Not set.
- Variable `ALARM_EMAIL` (optional). Not set, so alarm emails are not sent. If set, AWS sends a
  confirmation email that must be clicked.

- Deploy emails (sent by the last workflow steps via Gmail SMTP): secrets `GMAIL_USERNAME` and
  `GMAIL_APP_PASSWORD` (a Google App Password), variable `NOTIFY_EMAILS` (comma-separated recipients).
  If these are not set, the email steps fail (after the deploy has already succeeded).

## CloudFormation stacks
1. `claudwatch-github-oidc` (one-time bootstrap, template `bootstrap/github-oidc.yaml`)
   - Created in the console with parameters `GitHubRepo=SoftwareEngAhmetDemir/claudWatch`, `CreateProvider=false`.
   - Creates IAM role `claudwatch-github-deploy` (currently has `AdministratorAccess`; tighten later).
   - Update it via CloudFormation > Update stack > replace template; tick the IAM acknowledgement.
2. `claudwatch-api` (the app, template `template.yaml`), created and updated by the GitHub Actions workflow.
   Contains the Lambda function, HTTP API, log groups (30-day retention), SNS topic, three alarms
   (API 5xx, p95 latency > 1s, Lambda errors) and the dashboard `claudwatch-api-dashboard`.

## Code layout
- `src/app.js`: Express app. Routes: `GET /` ({"message":"Hello World!"}), `GET /health`, 404 and 500 handlers.
  Logs one JSON line per request (`msg:"request"`, `method`, `path`, `status`, `durationMs`).
- `src/server.js`: local server (`npm start`, port 3000).
- `src/lambda.js`: Lambda handler (`serverless-http` wrapping the Express app).
- `template.yaml`: SAM template. `bootstrap/github-oidc.yaml`: one-time IAM/OIDC role.
- `.github/workflows/deploy.yml`: on push to `main` (and manual run): npm ci, setup SAM, assume role via OIDC,
  `sam build`, `sam deploy` (stack `claudwatch-api`), smoke test the API URL.

## What was done (timeline)
1. Built the Express API and tested it locally and through the Lambda wrapper.
2. Wrote the SAM template with CloudWatch logs, alarms and dashboard, and the GitHub Actions deploy workflow.
3. Pushed to `main`. The first run failed because the `AWS_ROLE_ARN` secret was missing.
4. Created the `claudwatch-github-oidc` stack in the AWS Console. The first attempt failed with
   "Resource name conflict" because the GitHub OIDC provider already existed. Deleted the failed stack and
   recreated it with `CreateProvider=false`.
5. Added the `AWS_ROLE_ARN` GitHub secret.
6. `Not authorized to perform sts:AssumeRoleWithWebIdentity` error. Cause: GitHub now sends the `sub` claim in the
   new format `repo:OWNER@<ownerId>/REPO@<repoId>:ref:refs/heads/main` (for this repo
   `repo:SoftwareEngAhmetDemir@43875085/claudWatch@1424845949:ref:refs/heads/main`). The role trust policy only
   matched the old format. Fixed `bootstrap/github-oidc.yaml` to accept both and updated the stack in the console.
   (`role-skip-session-tagging: true` was also added to the workflow; it was not the cause but is harmless.)
7. `sam deploy` failed because an empty `AlarmEmail=""` was passed. Fixed the workflow to pass the parameter only
   when `ALARM_EMAIL` is set.
8. Deploy run #5 succeeded. API verified live (`/` 200, `/health` 200, unknown path 404). Dashboard and 3 alarms exist (state OK).

## Useful commands
- Local run: `npm install && npm start`.
- Redeploy: push to `main` or GitHub > Actions > Deploy > Run workflow.
- Stack outputs (needs AWS login): `aws cloudformation describe-stacks --stack-name claudwatch-api --query "Stacks[0].Outputs"`.
- Logs Insights query (log group `/aws/lambda/claudwatch-api-ApiFunction-...`):
  `filter msg = "request" | stats count() as requests, avg(durationMs) as avgMs by path, status`

## Possible next steps
- Set `ALARM_EMAIL` to receive alarm emails.
- Replace `AdministratorAccess` on the deploy role with a least-privilege policy.
- Add a `/slow` route to practise latency graphs, the p95 alarm and Logs Insights.
- Add tests and a CI check on pull requests (the deploy workflow only runs on `main`).
- The Actions annotations warn that Node.js 20 is deprecated for some actions; bump action versions when newer ones exist.
