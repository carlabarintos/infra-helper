import { Zap, Globe, HardDrive, Key, BarChart2, Trash2, ChevronRight, Server } from 'lucide-react';
import { Resource, ResourceType, FunctionAppConfig, AppServiceConfig, AppServicePlanConfig, StorageAccountConfig, KeyVaultConfig, AppInsightsConfig } from '../types/resources';
import { useStore } from '../store/useStore';

function ResourceIcon({ type, className }: { type: ResourceType; className?: string }) {
  const props = { size: 16, className };
  switch (type) {
    case 'functionApp': return <Zap {...props} />;
    case 'appService': return <Globe {...props} />;
    case 'appServicePlan': return <Server {...props} />;
    case 'storageAccount': return <HardDrive {...props} />;
    case 'keyVault': return <Key {...props} />;
    case 'appInsights': return <BarChart2 {...props} />;
  }
}

const TYPE_STYLES: Record<ResourceType, { color: string; bg: string; border: string }> = {
  functionApp: { color: 'text-amber-400', bg: 'bg-amber-400/10', border: 'border-amber-400/30' },
  appService: { color: 'text-blue-400', bg: 'bg-blue-400/10', border: 'border-blue-400/30' },
  appServicePlan: { color: 'text-sky-400', bg: 'bg-sky-400/10', border: 'border-sky-400/30' },
  storageAccount: { color: 'text-emerald-400', bg: 'bg-emerald-400/10', border: 'border-emerald-400/30' },
  keyVault: { color: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30' },
  appInsights: { color: 'text-purple-400', bg: 'bg-purple-400/10', border: 'border-purple-400/30' },
};

function getConfigSummary(resource: Resource): string[] {
  const tags: string[] = [];
  switch (resource.type) {
    case 'functionApp': {
      const c = resource.config as FunctionAppConfig;
      tags.push(c.runtime);
      tags.push(c.sku === 'Y1' ? 'Consumption' : c.sku);
      if (c.enablePrivateEndpoint) tags.push('Private EP');
      break;
    }
    case 'appService': {
      const c = resource.config as AppServiceConfig;
      tags.push(c.framework);
      tags.push(c.sku);
      if (c.enableAlwaysOn) tags.push('Always On');
      break;
    }
    case 'storageAccount': {
      const c = resource.config as StorageAccountConfig;
      tags.push(c.sku);
      tags.push(c.kind);
      if (c.containers.length > 0) tags.push(`${c.containers.length} containers`);
      break;
    }
    case 'keyVault': {
      const c = resource.config as KeyVaultConfig;
      tags.push(c.sku);
      if (c.enableSoftDelete) tags.push(`Soft delete ${c.softDeleteRetentionDays}d`);
      break;
    }
    case 'appInsights': {
      const c = resource.config as AppInsightsConfig;
      tags.push(c.kind);
      tags.push(`${c.retentionDays}d retention`);
      break;
    }
    case 'appServicePlan': {
      const c = resource.config as AppServicePlanConfig;
      tags.push(c.sku);
      tags.push(c.os);
      break;
    }
  }
  return tags;
}

const TYPE_LABELS: Record<ResourceType, string> = {
  functionApp: 'Function App',
  appService: 'App Service',
  appServicePlan: 'App Service Plan',
  storageAccount: 'Storage Account',
  keyVault: 'Key Vault',
  appInsights: 'App Insights',
};

interface ResourceCardProps {
  resource: Resource;
  isSelected: boolean;
}

export function ResourceCard({ resource, isSelected }: ResourceCardProps) {
  const { removeResource, selectResource, updateResource } = useStore();
  const style = TYPE_STYLES[resource.type];
  const summary = getConfigSummary(resource);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    removeResource(resource.id);
  }

  function handleSelect() {
    selectResource(isSelected ? null : resource.id);
  }

  function handleNameChange(e: React.ChangeEvent<HTMLInputElement>) {
    updateResource(resource.id, { name: e.target.value });
  }

  return (
    <div
      onClick={handleSelect}
      className={`group relative rounded-lg border p-3 cursor-pointer transition-all ${
        isSelected
          ? `${style.border} ${style.bg} border-opacity-60`
          : 'border-gray-700 bg-gray-800/40 hover:border-gray-600'
      }`}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${style.bg} ${style.border} border`}>
          <ResourceIcon type={resource.type} className={style.color} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={resource.name}
              onChange={handleNameChange}
              onClick={(e) => e.stopPropagation()}
              className="bg-transparent text-sm font-medium text-white focus:outline-none focus:ring-1 focus:ring-[#2ea3f2] rounded px-1 -mx-1 w-full"
            />
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{TYPE_LABELS[resource.type]}</div>
        </div>

        {/* Chevron for selected state */}
        <ChevronRight
          size={14}
          className={`text-gray-600 transition-transform ${isSelected ? 'rotate-90' : ''}`}
        />

        {/* Delete button */}
        <button
          onClick={handleDelete}
          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {/* Tags */}
      {summary.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 pl-11">
          {summary.map((tag) => (
            <span
              key={tag}
              className="text-xs bg-gray-700/60 text-gray-400 px-1.5 py-0.5 rounded"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
