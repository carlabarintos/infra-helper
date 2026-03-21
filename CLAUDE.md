# InfraHelper — CLAUDE.md

## Project Overview

InfraHelper is a React + TypeScript UI tool for platform engineers to visually compose Azure infrastructure and generate production-quality modular Bicep files and GitHub Actions workflows. No backend — pure client-side file generation.

## Tech Stack

- **React 18** + **TypeScript** + **Vite**
- **Tailwind CSS** for styling (dark theme, Azure blue accent `#0078d4`)
- **lucide-react** for icons
- No state management library — `useReducer` + React Context (`src/store/useStore.ts`)

## Dev Commands

```bash
npm run dev       # Start dev server at http://localhost:5173
npm run build     # TypeScript check + Vite production build
npm run preview   # Preview production build
```

## Project Structure

```
src/
├── types/
│   └── resources.ts          # All TypeScript interfaces + DEFAULT_CONFIGS + AZURE_REGIONS
├── store/
│   └── useStore.ts           # useReducer store, ProjectConfig state, all actions
├── components/
│   ├── TopBar.tsx            # Project name, environment, region, resource group, Download All
│   ├── ResourcePalette.tsx   # Left panel — clickable resource type cards to add resources
│   ├── NetworkingToggle.tsx  # VNet/private network mode toggle
│   ├── ResourceCard.tsx      # Center panel — per-resource card (inline name edit, delete)
│   ├── ResourceConfigurator.tsx  # Inline configurator shown when a resource is selected
│   └── OutputPanel.tsx       # Right panel — tabbed code viewer, copy, download per file
├── generators/
│   ├── bicep/
│   │   ├── mainBicep.ts      # Orchestrates all modules; exports generateAllFiles()
│   │   ├── functionAppModule.ts
│   │   ├── appServiceModule.ts
│   │   ├── storageModule.ts
│   │   ├── keyVaultModule.ts
│   │   ├── appInsightsModule.ts
│   │   └── networkingModule.ts
│   └── workflowGenerator.ts  # GitHub Actions YAML + parameter files
├── App.tsx                   # Three-column layout
├── main.tsx
└── index.css
```

## Supported Azure Resources

| Resource | Type Key | Notes |
|---|---|---|
| Azure Function App | `functionApp` | dotnet-isolated (10/8/6), node, python, java, powershell; Consumption/EP SKUs |
| App Service | `appService` | dotnet (10/8/6/4.8), node, python, java, php; B/S/P SKUs |
| Storage Account | `storageAccount` | SKU, kind, containers, blob public access |
| Key Vault | `keyVault` | RBAC model (Key Vault Secrets User role), soft delete, private endpoint |
| App Insights | `appInsights` | Workspace-based with Log Analytics Workspace |

## Architecture Rules

### Bicep Generators are Pure Functions
All generators in `src/generators/` are pure functions:
```ts
(config: ProjectConfig) => Record<string, string>  // filename → file content
```
`generateAllFiles()` in `mainBicep.ts` is the single entry point — it calls all module generators and returns every file keyed by its output path (e.g. `infra/modules/functionApp-myFunc.bicep`).

### Adding a New Resource Type
1. Add the type to `ResourceType` union in `src/types/resources.ts`
2. Define its config interface and add to `DEFAULT_CONFIGS`
3. Create `src/generators/bicep/{resourceType}Module.ts`
4. Wire it into `mainBicep.ts` (`generateAllFiles`)
5. Add a configurator branch in `ResourceConfigurator.tsx`
6. Add a palette card in `ResourcePalette.tsx`

### Cross-Resource References
Resources reference each other by name (not ID at design time). The main.bicep generator wires outputs to inputs — e.g. a Function App referencing a Storage Account gets the storage account's name passed as a parameter via `module.outputs.storageAccountName`.

### Networking Mode
When `ProjectConfig.enableNetworking = true`:
- `networkingModule.ts` generates VNet + two subnets (PE subnet `10.0.1.0/24`, app subnet `10.0.2.0/24`) + NSGs + Private DNS Zones
- All resources with `enablePrivateEndpoint: true` receive `subnetId` param in main.bicep
- Private endpoint + DNS zone group resources are conditionally generated inside each module using `if (!empty(subnetId))`

### Bicep Conventions
- API versions: 2023-01-01+ for Web, 2023-05-01+ for Network
- Tags on every resource: `{ environment: environment, project: projectName, managedBy: 'InfraHelper' }`
- Parameters use `@description()` decorators
- Key Vault uses RBAC (`roleAssignments`), not legacy access policies
- App Insights is always workspace-based (Log Analytics Workspace bundled in `appInsightsModule.ts`)
- dotnet in-process model capped at .NET 6 (retired); dotnet-isolated supports 6/8/10

## Generated Output Structure

```
infra/
├── main.bicep
├── modules/
│   ├── networking.bicep          # only if enableNetworking = true
│   ├── appInsights-{name}.bicep
│   ├── storageAccount-{name}.bicep
│   ├── keyVault-{name}.bicep
│   ├── functionApp-{name}.bicep
│   └── appService-{name}.bicep
├── parameters.dev.json
├── parameters.staging.json
└── parameters.prod.json
.github/
└── workflows/
    └── deploy.yml
```

## GitHub Actions Workflow

- OIDC authentication (`azure/login@v2`) — requires `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_SUBSCRIPTION_ID` secrets
- Jobs: `validate` → `what-if` → `deploy`
- `workflow_dispatch` with environment selector (dev/staging/prod)
- Environment gates on the deploy job
- Triggers on push to `main` with path filter `infra/**`
