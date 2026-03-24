import { Resource, FunctionAppConfig } from '../../types/resources';
import { safeTfName, safeName } from './utils';

interface FuncTfOptions {
  enableNetworking: boolean;
  storageTfName?: string;
  aiTfName?: string;
  planTfName?: string;
}

function getApplicationStack(runtime: string, runtimeVersion: string, isLinux: boolean): string {
  if (isLinux) {
    switch (runtime) {
      case 'dotnet':
        return `    application_stack {
      dotnet_version = "${runtimeVersion}.0"
    }`;
      case 'dotnet-isolated':
        return `    application_stack {
      dotnet_version              = "${runtimeVersion}.0"
      use_dotnet_isolated_runtime = true
    }`;
      case 'node':
        return `    application_stack {
      node_version = "~${runtimeVersion}"
    }`;
      case 'python':
        return `    application_stack {
      python_version = "${runtimeVersion}"
    }`;
      case 'java':
        return `    application_stack {
      java_version = "${runtimeVersion}"
    }`;
      case 'powershell':
        return `    application_stack {
      powershell_core_version = "${runtimeVersion}"
    }`;
    }
  } else {
    switch (runtime) {
      case 'dotnet':
        return `    application_stack {
      dotnet_version = "v${runtimeVersion}.0"
    }`;
      case 'dotnet-isolated':
        return `    application_stack {
      dotnet_version              = "v${runtimeVersion}.0"
      use_dotnet_isolated_runtime = true
    }`;
      case 'node':
        return `    application_stack {
      node_version = "~${runtimeVersion}"
    }`;
      case 'powershell':
        return `    application_stack {
      powershell_core_version = "${runtimeVersion}"
    }`;
      case 'java':
        return `    application_stack {
      java_version = "${runtimeVersion}"
    }`;
    }
  }
  return '';
}

export function generateFunctionAppTf(resource: Resource, options: FuncTfOptions): string {
  const config = resource.config as FunctionAppConfig;
  const tfn = safeTfName(resource.name);
  const sn = safeName(resource.name);

  const isLinux = config.runtime === 'python' || config.os === 'Linux';
  const usePrivateEndpoint = options.enableNetworking && config.enablePrivateEndpoint;
  const resourceType = isLinux ? 'azurerm_linux_function_app' : 'azurerm_windows_function_app';

  const dedicatedPlanBlock = !options.planTfName
    ? `
resource "azurerm_service_plan" "${tfn}_plan" {
  name                = "\${var.project_name}-\${var.environment}-asp-func-${sn}"
  resource_group_name = var.resource_group_name
  location            = var.location
  os_type             = "${isLinux ? 'Linux' : 'Windows'}"
  sku_name            = "${config.sku}"
  tags                = local.tags
}
`
    : '';

  const planIdRef = options.planTfName
    ? `azurerm_service_plan.${options.planTfName}.id`
    : `azurerm_service_plan.${tfn}_plan.id`;

  const storageNameRef = options.storageTfName
    ? `azurerm_storage_account.${options.storageTfName}.name`
    : `"" # TODO: link a storage account`;

  const storageKeyRef = options.storageTfName
    ? `azurerm_storage_account.${options.storageTfName}.primary_access_key`
    : `"" # TODO: link a storage account`;

  const aiConnStr = options.aiTfName
    ? `azurerm_application_insights.${options.aiTfName}.connection_string`
    : `""`;

  const customEnvVars = config.envVars
    .map((ev) => `    "${ev.key}" = "${ev.isSecret ? `@Microsoft.KeyVault(SecretUri=<kv-uri>/secrets/${ev.key}/)` : ev.value}"`)
    .join('\n');

  const appSettings = [
    `    "FUNCTIONS_EXTENSION_VERSION"          = "~4"`,
    `    "APPLICATIONINSIGHTS_CONNECTION_STRING" = ${aiConnStr}`,
    ...(config.sku === 'Y1'
      ? [
          `    "WEBSITE_CONTENTAZUREFILECONNECTIONSTRING" = ${options.storageTfName ? `azurerm_storage_account.${options.storageTfName}.primary_connection_string` : '""'}`,
          `    "WEBSITE_CONTENTSHARE"                     = "\${var.project_name}-\${var.environment}-func-${sn}"`,
        ]
      : []),
    ...(customEnvVars ? [customEnvVars] : []),
  ].join('\n');

  const vnetIntegration = options.enableNetworking
    ? `
  virtual_network_subnet_id = azurerm_subnet.app_subnet.id`
    : '';

  const peBlock = usePrivateEndpoint
    ? `
resource "azurerm_private_endpoint" "${tfn}_pe" {
  name                = "\${var.project_name}-\${var.environment}-func-${sn}-pe"
  resource_group_name = var.resource_group_name
  location            = var.location
  subnet_id           = azurerm_subnet.pe_subnet.id

  private_service_connection {
    name                           = "\${var.project_name}-\${var.environment}-func-${sn}-pe-connection"
    private_connection_resource_id = ${resourceType}.${tfn}.id
    subresource_names              = ["sites"]
    is_manual_connection           = false
  }

  private_dns_zone_group {
    name                 = "default"
    private_dns_zone_ids = [azurerm_private_dns_zone.web.id]
  }
}`
    : '';

  const applicationStack = getApplicationStack(config.runtime, config.runtimeVersion, isLinux);

  return `# Function App: ${resource.name}
# Generated by InfraHelper
${dedicatedPlanBlock}
resource "${resourceType}" "${tfn}" {
  name                       = "\${var.project_name}-\${var.environment}-func-${sn}"
  resource_group_name        = var.resource_group_name
  location                   = var.location
  storage_account_name       = ${storageNameRef}
  storage_account_access_key = ${storageKeyRef}
  service_plan_id            = ${planIdRef}
  https_only                 = true${vnetIntegration}

  identity {
    type = "SystemAssigned"
  }

  site_config {
    ftps_state       = "Disabled"
    min_tls_version  = "1.2"
    http2_enabled    = true
    always_on        = ${config.sku !== 'Y1'}
${applicationStack}
  }

  app_settings = {
${appSettings}
  }

  tags = local.tags
}
${peBlock}
`;
}
