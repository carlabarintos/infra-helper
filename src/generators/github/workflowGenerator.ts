import { ProjectConfig, FunctionAppConfig, AppServiceConfig } from '../../types/resources';

export function generateGitHubWorkflow(project: ProjectConfig): string {
  return `name: Deploy Azure Infrastructure

on:
  push:
    branches: [main]
    paths:
      - 'infra/**'
  workflow_dispatch:
    inputs:
      environment:
        description: 'Environment to deploy'
        required: true
        default: 'dev'
        type: choice
        options:
          - dev
          - staging
          - prod

permissions:
  id-token: write
  contents: read

env:
  PROJECT_NAME: ${project.projectName}

jobs:
  validate:
    name: Validate Bicep Templates
    runs-on: ubuntu-latest
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: \${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: \${{ secrets.AZURE_TENANT_ID }}
          subscription-id: \${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Install Bicep CLI
        run: az bicep install

      - name: Lint Bicep files
        run: |
          echo "Linting all Bicep files..."
          find infra -name "*.bicep" | while read f; do
            echo "Linting: \$f"
            az bicep lint --file "\$f"
          done

      - name: Validate Bicep deployment
        run: |
          ENVIRONMENT=\${{ inputs.environment || 'dev' }}
          RESOURCE_GROUP=\${{ vars.RESOURCE_GROUP }}
          echo "Validating deployment for environment: \$ENVIRONMENT"
          az deployment group validate \\
            --resource-group "\$RESOURCE_GROUP" \\
            --template-file infra/main.bicep \\
            --parameters infra/parameters.\${ENVIRONMENT}.json \\
            --verbose

      - name: What-if analysis
        run: |
          ENVIRONMENT=\${{ inputs.environment || 'dev' }}
          RESOURCE_GROUP=\${{ vars.RESOURCE_GROUP }}
          echo "Running what-if analysis for environment: \$ENVIRONMENT"
          az deployment group what-if \\
            --resource-group "\$RESOURCE_GROUP" \\
            --template-file infra/main.bicep \\
            --parameters infra/parameters.\${ENVIRONMENT}.json

  deploy:
    name: Deploy Infrastructure
    needs: validate
    runs-on: ubuntu-latest
    environment: \${{ inputs.environment || 'dev' }}
    concurrency:
      group: deploy-\${{ inputs.environment || 'dev' }}
      cancel-in-progress: false
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Azure Login (OIDC)
        uses: azure/login@v2
        with:
          client-id: \${{ secrets.AZURE_CLIENT_ID }}
          tenant-id: \${{ secrets.AZURE_TENANT_ID }}
          subscription-id: \${{ secrets.AZURE_SUBSCRIPTION_ID }}

      - name: Install Bicep CLI
        run: az bicep install

      - name: Deploy Bicep templates
        id: deploy
        run: |
          ENVIRONMENT=\${{ inputs.environment || 'dev' }}
          RESOURCE_GROUP=\${{ vars.RESOURCE_GROUP }}
          DEPLOYMENT_NAME="deploy-\$(date +%Y%m%d-%H%M%S)"
          echo "Deploying to resource group: \$RESOURCE_GROUP"
          echo "Deployment name: \$DEPLOYMENT_NAME"
          az deployment group create \\
            --resource-group "\$RESOURCE_GROUP" \\
            --template-file infra/main.bicep \\
            --parameters infra/parameters.\${ENVIRONMENT}.json \\
            --name "\$DEPLOYMENT_NAME" \\
            --output json \\
            --verbose

      - name: Show deployment outputs
        run: |
          ENVIRONMENT=\${{ inputs.environment || 'dev' }}
          RESOURCE_GROUP=\${{ vars.RESOURCE_GROUP }}
          echo "Deployment outputs:"
          az deployment group show \\
            --resource-group "\$RESOURCE_GROUP" \\
            --name \$(az deployment group list --resource-group "\$RESOURCE_GROUP" --query "[0].name" -o tsv) \\
            --query "properties.outputs" \\
            --output table
`;
}

export function generateParametersFile(
  project: ProjectConfig,
  environment: 'dev' | 'staging' | 'prod'
): string {
  const needsIpParam = project.resources.some(
    (r) =>
      (r.type === 'functionApp' && (r.config as FunctionAppConfig).allowCurrentIp) ||
      (r.type === 'appService' && (r.config as AppServiceConfig).allowCurrentIp)
  );

  const parameters: Record<string, { value: string }> = {
    projectName: { value: project.projectName },
    environment: { value: environment },
    location: { value: project.location },
  };

  if (needsIpParam) {
    parameters.allowedIpAddress = { value: project.allowedIpAddress || '' };
  }

  return JSON.stringify(
    {
      $schema: 'https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#',
      contentVersion: '1.0.0.0',
      parameters,
    },
    null,
    2
  );
}

export function generateDeployScriptPs1(
  project: ProjectConfig,
  subscriptionId: string,
  environment: 'dev' | 'staging' | 'prod'
): string {
  const rg = project.resourceGroupName;
  const loc = project.location;
  const sub = subscriptionId || '<YOUR-SUBSCRIPTION-ID>';
  return `# deploy.ps1 — Generated by InfraHelper
# Project : ${project.projectName}
# Environment : ${environment}
# Run from the root of your repository

param(
  [string]$SubscriptionId = "${sub}",
  [string]$Environment    = "${environment}"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "==> Logging in to Azure..." -ForegroundColor Cyan
az login

Write-Host "==> Setting subscription: $SubscriptionId" -ForegroundColor Cyan
az account set --subscription $SubscriptionId

Write-Host "==> Active subscription:" -ForegroundColor Cyan
az account show --query "{name:name, id:id, state:state}" --output table

Write-Host "==> Creating resource group '${rg}' in '${loc}' (if not exists)..." -ForegroundColor Cyan
az group create \`
  --name "${rg}" \`
  --location "${loc}" \`
  --output table

Write-Host "==> Deploying Bicep template (environment: $Environment)..." -ForegroundColor Cyan
\$deploymentName = "deploy-\$(Get-Date -Format 'yyyyMMdd-HHmmss')"
az deployment group create \`
  --name \$deploymentName \`
  --resource-group "${rg}" \`
  --template-file "infra/main.bicep" \`
  --parameters "infra/parameters.\$Environment.json" \`
  --output table

Write-Host "==> Deployment complete!" -ForegroundColor Green
`;
}

export function generateDeployScriptSh(
  project: ProjectConfig,
  subscriptionId: string,
  environment: 'dev' | 'staging' | 'prod'
): string {
  const rg = project.resourceGroupName;
  const loc = project.location;
  const sub = subscriptionId || '<YOUR-SUBSCRIPTION-ID>';
  return `#!/usr/bin/env bash
# deploy.sh — Generated by InfraHelper
# Project     : ${project.projectName}
# Environment : ${environment}
# Run from the root of your repository

set -euo pipefail

SUBSCRIPTION_ID="\${1:-${sub}}"
ENVIRONMENT="\${2:-${environment}}"
RESOURCE_GROUP="${rg}"
LOCATION="${loc}"

echo "==> Logging in to Azure..."
az login

echo "==> Setting subscription: \$SUBSCRIPTION_ID"
az account set --subscription "\$SUBSCRIPTION_ID"

echo "==> Active subscription:"
az account show --query "{name:name,id:id,state:state}" --output table

echo "==> Creating resource group '\$RESOURCE_GROUP' in '\$LOCATION' (if not exists)..."
az group create \\
  --name "\$RESOURCE_GROUP" \\
  --location "\$LOCATION" \\
  --output table

echo "==> Deploying Bicep template (environment: \$ENVIRONMENT)..."
DEPLOYMENT_NAME="deploy-\$(date +%Y%m%d-%H%M%S)"
az deployment group create \\
  --name "\$DEPLOYMENT_NAME" \\
  --resource-group "\$RESOURCE_GROUP" \\
  --template-file "infra/main.bicep" \\
  --parameters "infra/parameters.\$ENVIRONMENT.json" \\
  --output table

echo "==> Deployment complete!"
`;
}

export function generateAzureLoginReadme(project: ProjectConfig): string {
  return `# Azure Deployment Setup

## Prerequisites

1. An Azure subscription
2. A service principal with federated credentials (OIDC) configured for GitHub Actions

## Setting Up OIDC Authentication

### 1. Create a Service Principal

\`\`\`bash
az ad app create --display-name "${project.projectName}-github-actions"
\`\`\`

### 2. Create Federated Credentials

In the Azure Portal or via CLI, configure federated credentials for your GitHub repository.

### 3. Assign Roles

\`\`\`bash
az role assignment create \\
  --assignee <service-principal-id> \\
  --role "Contributor" \\
  --scope /subscriptions/<subscription-id>/resourceGroups/${project.resourceGroupName}
\`\`\`

## GitHub Secrets Required

| Secret | Description |
|--------|-------------|
| \`AZURE_CLIENT_ID\` | Service principal client/app ID |
| \`AZURE_TENANT_ID\` | Azure AD tenant ID |
| \`AZURE_SUBSCRIPTION_ID\` | Azure subscription ID |

## GitHub Variables Required

| Variable | Description |
|----------|-------------|
| \`RESOURCE_GROUP\` | Target resource group name |

## Resource Group Creation

\`\`\`bash
# Create resource groups for each environment
az group create --name ${project.projectName}-dev-rg --location ${project.location}
az group create --name ${project.projectName}-staging-rg --location ${project.location}
az group create --name ${project.projectName}-prod-rg --location ${project.location}
\`\`\`
`;
}
