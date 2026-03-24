export type ResourceType = 'functionApp' | 'appService' | 'appServicePlan' | 'storageAccount' | 'keyVault' | 'appInsights';

export interface EnvVar {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface AppServicePlanConfig {
  sku: 'EP1' | 'EP2' | 'EP3' | 'B1' | 'B2' | 'B3' | 'S1' | 'S2' | 'S3' | 'P1v3' | 'P2v3' | 'P3v3';
  os: 'Windows' | 'Linux';
}

export interface FunctionAppConfig {
  runtime: 'dotnet' | 'dotnet-isolated' | 'node' | 'python' | 'java' | 'powershell';
  runtimeVersion: string;
  os: 'Windows' | 'Linux';
  sku: 'Y1' | 'EP1' | 'EP2' | 'EP3';
  sharedPlanRef?: string;
  storageAccountRef?: string;
  appInsightsRef?: string;
  envVars: EnvVar[];
  enablePrivateEndpoint: boolean;
  allowCurrentIp: boolean;
}

export interface AppServiceConfig {
  framework: 'dotnet' | 'node' | 'python' | 'java' | 'php';
  frameworkVersion: string;
  sku: 'B1' | 'B2' | 'B3' | 'S1' | 'S2' | 'S3' | 'P1v3' | 'P2v3' | 'P3v3';
  sharedPlanRef?: string;
  appInsightsRef?: string;
  envVars: EnvVar[];
  enablePrivateEndpoint: boolean;
  enableAlwaysOn: boolean;
  allowCurrentIp: boolean;
}

export interface StorageAccountConfig {
  sku: 'Standard_LRS' | 'Standard_GRS' | 'Standard_ZRS' | 'Premium_LRS';
  kind: 'StorageV2' | 'BlobStorage' | 'FileStorage';
  enablePrivateEndpoint: boolean;
  enableBlobPublicAccess: boolean;
  containers: string[];
}

export interface KeyVaultConfig {
  sku: 'standard' | 'premium';
  enableSoftDelete: boolean;
  softDeleteRetentionDays: number;
  enablePrivateEndpoint: boolean;
  accessPolicies: string[];
  diagnosticStorageAccountRef?: string;
  diagnosticWorkspaceRef?: string;
}

export interface AppInsightsConfig {
  kind: 'web' | 'ios' | 'other';
  retentionDays: number;
}

export type ResourceConfig =
  | FunctionAppConfig
  | AppServiceConfig
  | AppServicePlanConfig
  | StorageAccountConfig
  | KeyVaultConfig
  | AppInsightsConfig;

export interface Resource {
  id: string;
  type: ResourceType;
  name: string;
  config: ResourceConfig;
}

export interface ProjectConfig {
  projectName: string;
  environment: 'dev' | 'staging' | 'prod';
  location: string;
  enableNetworking: boolean;
  allowedIpAddress: string;
  resourceGroupName: string;
  resources: Resource[];
  diagramPositions?: Record<string, { x: number; y: number }>;
}

export const AZURE_REGIONS = [
  'australiaeast',
  'australiasoutheast',
  'brazilsouth',
  'canadacentral',
  'canadaeast',
  'centralindia',
  'centralus',
  'eastasia',
  'eastus',
  'eastus2',
  'francecentral',
  'germanywestcentral',
  'japaneast',
  'japanwest',
  'koreacentral',
  'northeurope',
  'norwayeast',
  'southafricanorth',
  'southcentralus',
  'southeastasia',
  'swedencentral',
  'switzerlandnorth',
  'uaenorth',
  'uksouth',
  'ukwest',
  'westeurope',
  'westus',
  'westus2',
  'westus3',
];

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  functionApp: 'Function App',
  appService: 'App Service',
  appServicePlan: 'App Service Plan',
  storageAccount: 'Storage Account',
  keyVault: 'Key Vault',
  appInsights: 'App Insights',
};

export const DEFAULT_CONFIGS: Record<ResourceType, ResourceConfig> = {
  appServicePlan: {
    sku: 'EP1',
    os: 'Windows',
  } as AppServicePlanConfig,
  functionApp: {
    runtime: 'dotnet-isolated',
    runtimeVersion: '8',
    os: 'Windows',
    sku: 'Y1',
    storageAccountRef: undefined,
    appInsightsRef: undefined,
    envVars: [],
    enablePrivateEndpoint: false,
    allowCurrentIp: false,
  } as FunctionAppConfig,
  appService: {
    framework: 'dotnet',
    frameworkVersion: '8',
    sku: 'B1',
    appInsightsRef: undefined,
    envVars: [],
    enablePrivateEndpoint: false,
    enableAlwaysOn: true,
    allowCurrentIp: false,
  } as AppServiceConfig,
  storageAccount: {
    sku: 'Standard_LRS',
    kind: 'StorageV2',
    enablePrivateEndpoint: false,
    enableBlobPublicAccess: false,
    containers: [],
  } as StorageAccountConfig,
  keyVault: {
    sku: 'standard',
    enableSoftDelete: true,
    softDeleteRetentionDays: 90,
    enablePrivateEndpoint: false,
    accessPolicies: [],
  } as KeyVaultConfig,
  appInsights: {
    kind: 'web',
    retentionDays: 90,
  } as AppInsightsConfig,
};
