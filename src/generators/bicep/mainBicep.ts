import {
  ProjectConfig,
  Resource,
  FunctionAppConfig,
  AppServiceConfig,
  StorageAccountConfig,
  KeyVaultConfig,
} from '../../types/resources';
import { generateStorageModule } from './storageModule';
import { generateAppInsightsModule } from './appInsightsModule';
import { generateKeyVaultModule } from './keyVaultModule';
import { generateFunctionAppModule } from './functionAppModule';
import { generateAppServiceModule } from './appServiceModule';
import { generateAppServicePlanModule } from './appServicePlanModule';
import { generateNetworkingModule } from './networkingModule';
import {
  generateGitHubWorkflow,
  generateParametersFile,
  generateDeployScriptPs1,
  generateDeployScriptSh,
} from '../github/workflowGenerator';

function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}

function safeVarName(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '');
}

function getStorageRef(resource: Resource, project: ProjectConfig): Resource | undefined {
  const config = resource.config as FunctionAppConfig;
  return config.storageAccountRef
    ? project.resources.find((r) => r.id === config.storageAccountRef)
    : undefined;
}

function getAppInsightsRef(resource: Resource, project: ProjectConfig): Resource | undefined {
  const config = resource.config as FunctionAppConfig | AppServiceConfig;
  const ref = 'appInsightsRef' in config ? config.appInsightsRef : undefined;
  return ref ? project.resources.find((r) => r.id === ref) : undefined;
}

export function generateRoleAssignmentStorageModule(): string {
  return `// modules/roleAssignmentStorage.bicep
// Assigns a single RBAC role on a Storage Account to a principal.
// Using a sub-module avoids BCP120: the storage account name arrives as a
// param (start-of-deployment constant), so 'existing' is valid as a scope.

param storageAccountName string
param principalId string
param roleDefinitionId string

resource storage 'Microsoft.Storage/storageAccounts@2023-01-01' existing = {
  name: storageAccountName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: storage
  name: guid(storage.id, principalId, roleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
`;
}

export function generateRoleAssignmentKeyVaultModule(): string {
  return `// modules/roleAssignmentKeyVault.bicep
// Assigns a single RBAC role on a Key Vault to a principal.

param keyVaultName string
param principalId string
param roleDefinitionId string

resource kv 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource roleAssignment 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  scope: kv
  name: guid(kv.id, principalId, roleDefinitionId)
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleDefinitionId)
    principalId: principalId
    principalType: 'ServicePrincipal'
  }
}
`;
}

function generateRoleAssignments(project: ProjectConfig): string {
  const { resources } = project;
  const blocks: string[] = [];

  const ROLE_STORAGE_BLOB_OWNER    = 'b7e6dc6d-f1e8-4753-8033-0f276bb0955b';
  const ROLE_STORAGE_QUEUE_CONTRIB = '974c5e8b-45b9-4653-ba55-5f855dd0fb88';
  const ROLE_STORAGE_TABLE_CONTRIB = '0a9a7e1f-b9d0-4cc4-a60d-0319b160aaa3';
  const ROLE_KV_SECRETS_USER       = '4633458b-17de-408a-b874-0445c86b69e6';

  // Function App → Storage Account (via sub-module to satisfy BCP120)
  resources.filter((r) => r.type === 'functionApp').forEach((res) => {
    const config = res.config as FunctionAppConfig;
    if (!config.storageAccountRef) return;
    const storageRes = resources.find((r) => r.id === config.storageAccountRef);
    if (!storageRes) return;
    const funcVn = safeVarName(res.name);
    const saVn   = safeVarName(storageRes.name);

    const roles = [
      [ROLE_STORAGE_BLOB_OWNER,    'blob',  'Storage Blob Data Owner'],
      [ROLE_STORAGE_QUEUE_CONTRIB, 'queue', 'Storage Queue Data Contributor'],
      [ROLE_STORAGE_TABLE_CONTRIB, 'table', 'Storage Table Data Contributor'],
    ] as const;

    roles.forEach(([roleId, suffix, roleName]) => {
      blocks.push(
`// ${roleName}: ${res.name} → ${storageRes.name}
module roleAssign_${funcVn}_${saVn}_${suffix} './modules/roleAssignmentStorage.bicep' = {
  name: 'ra-${funcVn}-${saVn}-${suffix}'
  params: {
    storageAccountName: storageAccount${saVn}.outputs.storageAccountName
    principalId: functionApp${funcVn}.outputs.functionAppPrincipalId
    roleDefinitionId: '${roleId}'
  }
}`);
    });
  });

  // Key Vault Secrets User: Function Apps and App Services → Key Vault
  resources.filter((r) => r.type === 'keyVault').forEach((kvRes) => {
    const kvConfig = kvRes.config as KeyVaultConfig;
    const kvVn = safeVarName(kvRes.name);

    kvConfig.accessPolicies.forEach((refId) => {
      const refRes = resources.find((r) => r.id === refId);
      if (!refRes) return;
      const refVn = safeVarName(refRes.name);
      let principalIdRef = '';
      if (refRes.type === 'functionApp') {
        principalIdRef = `functionApp${refVn}.outputs.functionAppPrincipalId`;
      } else if (refRes.type === 'appService') {
        principalIdRef = `appService${refVn}.outputs.appServicePrincipalId`;
      } else {
        return;
      }

      blocks.push(
`// Key Vault Secrets User: ${refRes.name} → ${kvRes.name}
module roleAssign_${refVn}_${kvVn}_kvsecrets './modules/roleAssignmentKeyVault.bicep' = {
  name: 'ra-${refVn}-${kvVn}-kvsecrets'
  params: {
    keyVaultName: keyVault${kvVn}.outputs.keyVaultName
    principalId: ${principalIdRef}
    roleDefinitionId: '${ROLE_KV_SECRETS_USER}'
  }
}`);
    });
  });

  return blocks.length > 0 ? `\n// ── Managed Identity Role Assignments ────────────────────────────────────────\n${blocks.join('\n\n')}` : '';
}

export function generateMainBicep(project: ProjectConfig): string {
  const { resources, enableNetworking } = project;

  const needsIpParam = resources.some(
    (r) =>
      (r.type === 'functionApp' && (r.config as FunctionAppConfig).allowCurrentIp) ||
      (r.type === 'appService' && (r.config as AppServiceConfig).allowCurrentIp)
  );

  const sharedPlanResources = resources.filter((r) => r.type === 'appServicePlan');
  const storageResources = resources.filter((r) => r.type === 'storageAccount');
  const appInsightsResources = resources.filter((r) => r.type === 'appInsights');
  const keyVaultResources = resources.filter((r) => r.type === 'keyVault');
  const functionAppResources = resources.filter((r) => r.type === 'functionApp');
  const appServiceResources = resources.filter((r) => r.type === 'appService');

  const moduleBlocks: string[] = [];

  // Networking module
  if (enableNetworking) {
    moduleBlocks.push(`module networking './modules/networking.bicep' = {
  name: 'networking-deployment'
  params: {
    projectName: projectName
    environment: environment
    location: location
  }
}`);
  }

  // Shared App Service Plan modules
  sharedPlanResources.forEach((res) => {
    const sn = safeName(res.name);
    const vn = safeVarName(res.name);
    moduleBlocks.push(`module appServicePlan${vn} './modules/appServicePlan-${sn}.bicep' = {
  name: 'appServicePlan-${sn}-deployment'
  params: {
    projectName: projectName
    environment: environment
    location: location
  }
}`);
  });

  // Storage Account modules
  storageResources.forEach((res) => {
    const sn = safeName(res.name);
    const vn = safeVarName(res.name);
    const config = res.config as StorageAccountConfig;
    moduleBlocks.push(`module storageAccount${vn} './modules/storageAccount-${sn}.bicep' = {
  name: 'storageAccount-${sn}-deployment'
  params: {
    projectName: projectName
    environment: environment
    location: location
    sku: '${config.sku}'
    storageKind: '${config.kind}'
    enableBlobPublicAccess: ${config.enableBlobPublicAccess}
    ${enableNetworking && config.enablePrivateEndpoint ? `subnetId: networking.outputs.peSubnetId\n    privateDnsZoneBlobId: networking.outputs.privateDnsZoneBlobId` : `subnetId: ''\n    privateDnsZoneBlobId: ''`}
  }
}`);
  });

  // App Insights modules
  appInsightsResources.forEach((res) => {
    const sn = safeName(res.name);
    const vn = safeVarName(res.name);
    moduleBlocks.push(`module appInsights${vn} './modules/appInsights-${sn}.bicep' = {
  name: 'appInsights-${sn}-deployment'
  params: {
    projectName: projectName
    environment: environment
    location: location
  }
}`);
  });

  // Key Vault modules
  keyVaultResources.forEach((res) => {
    const sn = safeName(res.name);
    const vn = safeVarName(res.name);
    const config = res.config as KeyVaultConfig;
    moduleBlocks.push(`module keyVault${vn} './modules/keyVault-${sn}.bicep' = {
  name: 'keyVault-${sn}-deployment'
  params: {
    projectName: projectName
    environment: environment
    location: location
    kvSku: '${config.sku}'
    enableSoftDelete: ${config.enableSoftDelete}
    softDeleteRetentionDays: ${config.softDeleteRetentionDays}
    ${enableNetworking && config.enablePrivateEndpoint ? `subnetId: networking.outputs.peSubnetId\n    privateDnsZoneKeyVaultId: networking.outputs.privateDnsZoneKeyVaultId` : `subnetId: ''\n    privateDnsZoneKeyVaultId: ''`}
  }
}`);
  });

  // Function App modules
  functionAppResources.forEach((res) => {
    const sn = safeName(res.name);
    const vn = safeVarName(res.name);
    const config = res.config as FunctionAppConfig;
    const storageRef = getStorageRef(res, project);
    const aiRef = getAppInsightsRef(res, project);

    const storageConnStr = storageRef
      ? `storageAccount${safeVarName(storageRef.name)}.outputs.storageAccountConnectionString`
      : `''`;
    const aiConnStr = aiRef
      ? `appInsights${safeVarName(aiRef.name)}.outputs.appInsightsConnectionString`
      : `''`;

    const sharedPlanRef = config.sharedPlanRef
      ? project.resources.find((r) => r.id === config.sharedPlanRef)
      : undefined;
    const planIdParam = sharedPlanRef
      ? `appServicePlan${safeVarName(sharedPlanRef.name)}.outputs.appServicePlanId`
      : `''`;

    moduleBlocks.push(`module functionApp${vn} './modules/functionApp-${sn}.bicep' = {
  name: 'functionApp-${sn}-deployment'
  params: {
    projectName: projectName
    environment: environment
    location: location
    runtime: '${config.runtime}'
    runtimeVersion: '${config.runtimeVersion}'
    sku: '${config.sku}'
    appServicePlanId: ${planIdParam}
    storageAccountConnectionString: ${storageConnStr}
    appInsightsConnectionString: ${aiConnStr}
    ${enableNetworking ? `subnetId: networking.outputs.appSubnetId\n    peSubnetId: ${config.enablePrivateEndpoint ? `networking.outputs.peSubnetId` : `''`}\n    privateDnsZoneWebId: ${config.enablePrivateEndpoint ? `networking.outputs.privateDnsZoneWebId` : `''`}` : `subnetId: ''\n    peSubnetId: ''\n    privateDnsZoneWebId: ''`}
    allowedIpAddress: ${config.allowCurrentIp && enableNetworking ? 'allowedIpAddress' : "''"}
  }
}`);
  });

  // App Service modules
  appServiceResources.forEach((res) => {
    const sn = safeName(res.name);
    const vn = safeVarName(res.name);
    const config = res.config as AppServiceConfig;
    const aiRef = getAppInsightsRef(res, project);
    const aiConnStr = aiRef
      ? `appInsights${safeVarName(aiRef.name)}.outputs.appInsightsConnectionString`
      : `''`;

    const sharedPlanRefApp = config.sharedPlanRef
      ? project.resources.find((r) => r.id === config.sharedPlanRef)
      : undefined;
    const planIdParamApp = sharedPlanRefApp
      ? `appServicePlan${safeVarName(sharedPlanRefApp.name)}.outputs.appServicePlanId`
      : `''`;

    moduleBlocks.push(`module appService${vn} './modules/appService-${sn}.bicep' = {
  name: 'appService-${sn}-deployment'
  params: {
    projectName: projectName
    environment: environment
    location: location
    framework: '${config.framework}'
    frameworkVersion: '${config.frameworkVersion}'
    sku: '${config.sku}'
    enableAlwaysOn: ${config.enableAlwaysOn}
    appServicePlanId: ${planIdParamApp}
    appInsightsConnectionString: ${aiConnStr}
    ${enableNetworking ? `subnetId: networking.outputs.appSubnetId\n    peSubnetId: ${config.enablePrivateEndpoint ? `networking.outputs.peSubnetId` : `''`}\n    privateDnsZoneWebId: ${config.enablePrivateEndpoint ? `networking.outputs.privateDnsZoneWebId` : `''`}` : `subnetId: ''\n    peSubnetId: ''\n    privateDnsZoneWebId: ''`}
    allowedIpAddress: ${config.allowCurrentIp && enableNetworking ? 'allowedIpAddress' : "''"}
  }
}`);
  });

  // Build outputs
  const outputs: string[] = [];
  storageResources.forEach((res) => {
    const vn = safeVarName(res.name);
    outputs.push(`output storageAccount${vn}Name string = storageAccount${vn}.outputs.storageAccountName`);
  });
  appInsightsResources.forEach((res) => {
    const vn = safeVarName(res.name);
    outputs.push(`output appInsights${vn}ConnectionString string = appInsights${vn}.outputs.appInsightsConnectionString`);
  });
  keyVaultResources.forEach((res) => {
    const vn = safeVarName(res.name);
    outputs.push(`output keyVault${vn}Uri string = keyVault${vn}.outputs.keyVaultUri`);
  });
  functionAppResources.forEach((res) => {
    const vn = safeVarName(res.name);
    outputs.push(`output functionApp${vn}Hostname string = functionApp${vn}.outputs.functionAppHostname`);
    outputs.push(`output functionApp${vn}PrincipalId string = functionApp${vn}.outputs.functionAppPrincipalId`);
  });
  appServiceResources.forEach((res) => {
    const vn = safeVarName(res.name);
    outputs.push(`output appService${vn}Hostname string = appService${vn}.outputs.appServiceHostname`);
    outputs.push(`output appService${vn}PrincipalId string = appService${vn}.outputs.appServicePrincipalId`);
  });
  if (enableNetworking) {
    outputs.push(`output vnetId string = networking.outputs.vnetId`);
    outputs.push(`output peSubnetId string = networking.outputs.peSubnetId`);
  }

  return `// main.bicep
// Generated by InfraHelper
// Project: ${project.projectName}
// Environment: ${project.environment}
// Location: ${project.location}

targetScope = 'resourceGroup'

@description('Project name prefix for all resources')
param projectName string = '${project.projectName}'

@description('Environment (dev, staging, prod)')
@allowed([
  'dev'
  'staging'
  'prod'
])
param environment string = '${project.environment}'

@description('Azure region for all resources')
param location string = '${project.location}'
${needsIpParam ? `\n@description('IP address allowed through web app access restrictions (your machine IP)')\nparam allowedIpAddress string = '${project.allowedIpAddress}'` : ''}

${moduleBlocks.join('\n\n')}
${generateRoleAssignments(project)}

${outputs.join('\n')}
`;
}

export function generateAllFiles(project: ProjectConfig): Record<string, string> {
  const files: Record<string, string> = {};

  if (project.resources.length === 0) return files;

  // bicepconfig.json — suppress noisy linter rules that don't apply here
  files['infra/bicepconfig.json'] = JSON.stringify(
    {
      analyzers: {
        core: {
          rules: {
            'outputs-should-not-contain-secrets': { level: 'off' },
            'no-hardcoded-env-urls': { level: 'off' },
          },
        },
      },
    },
    null,
    2
  );

  // main.bicep
  files['infra/main.bicep'] = generateMainBicep(project);

  // Networking module
  if (project.enableNetworking) {
    files['infra/modules/networking.bicep'] = generateNetworkingModule(project);
  }

  // Role assignment helper modules (only when needed)
  const hasStorageRoles = project.resources.some(
    (r) => r.type === 'functionApp' && !!(r.config as FunctionAppConfig).storageAccountRef
  );
  const hasKvRoles = project.resources.some(
    (r) => r.type === 'keyVault' && (r.config as KeyVaultConfig).accessPolicies.length > 0
  );
  if (hasStorageRoles) {
    files['infra/modules/roleAssignmentStorage.bicep'] = generateRoleAssignmentStorageModule();
  }
  if (hasKvRoles) {
    files['infra/modules/roleAssignmentKeyVault.bicep'] = generateRoleAssignmentKeyVaultModule();
  }

  // Resource modules
  project.resources.forEach((resource) => {
    const sn = resource.name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
    switch (resource.type) {
      case 'appServicePlan':
        files[`infra/modules/appServicePlan-${sn}.bicep`] = generateAppServicePlanModule(resource);
        break;
      case 'storageAccount':
        files[`infra/modules/storageAccount-${sn}.bicep`] = generateStorageModule(resource);
        break;
      case 'appInsights':
        files[`infra/modules/appInsights-${sn}.bicep`] = generateAppInsightsModule(resource);
        break;
      case 'keyVault':
        files[`infra/modules/keyVault-${sn}.bicep`] = generateKeyVaultModule(resource);
        break;
      case 'functionApp':
        files[`infra/modules/functionApp-${sn}.bicep`] = generateFunctionAppModule(resource, project);
        break;
      case 'appService':
        files[`infra/modules/appService-${sn}.bicep`] = generateAppServiceModule(resource, project);
        break;
    }
  });

  // GitHub Actions workflow
  files['.github/workflows/deploy.yml'] = generateGitHubWorkflow(project);

  // Parameter files for each environment
  (['dev', 'staging', 'prod'] as const).forEach((env) => {
    files[`infra/parameters.${env}.json`] = generateParametersFile(project, env);
  });

  // Deployment scripts
  files['deploy.ps1'] = generateDeployScriptPs1(project, '', project.environment);
  files['deploy.sh'] = generateDeployScriptSh(project, '', project.environment);

  // Project state — used by InfraHelper's Load Folder feature
  files['infrahelper.json'] = JSON.stringify({ version: '1', project }, null, 2);

  return files;
}
