import { Zap, Globe, HardDrive, Key, BarChart2, Plus, Server } from 'lucide-react';
import { useStore } from '../store/useStore';
import { ResourceType } from '../types/resources';

interface PaletteItem {
  type: ResourceType;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  borderColor: string;
}

const PALETTE_ITEMS: PaletteItem[] = [
  {
    type: 'appServicePlan',
    label: 'App Service Plan',
    description: 'Shared hosting plan',
    icon: <Server size={16} />,
    color: 'text-sky-400',
    bgColor: 'bg-sky-400/10',
    borderColor: 'border-sky-400/20 hover:border-sky-400/50',
  },
  {
    type: 'functionApp',
    label: 'Function App',
    description: 'Serverless compute',
    icon: <Zap size={16} />,
    color: 'text-amber-400',
    bgColor: 'bg-amber-400/10',
    borderColor: 'border-amber-400/20 hover:border-amber-400/50',
  },
  {
    type: 'appService',
    label: 'App Service',
    description: 'Web hosting',
    icon: <Globe size={16} />,
    color: 'text-blue-400',
    bgColor: 'bg-blue-400/10',
    borderColor: 'border-blue-400/20 hover:border-blue-400/50',
  },
  {
    type: 'storageAccount',
    label: 'Storage Account',
    description: 'Blob, file, queue',
    icon: <HardDrive size={16} />,
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-400/10',
    borderColor: 'border-emerald-400/20 hover:border-emerald-400/50',
  },
  {
    type: 'keyVault',
    label: 'Key Vault',
    description: 'Secrets & certs',
    icon: <Key size={16} />,
    color: 'text-orange-400',
    bgColor: 'bg-orange-400/10',
    borderColor: 'border-orange-400/20 hover:border-orange-400/50',
  },
  {
    type: 'appInsights',
    label: 'App Insights',
    description: 'Monitoring & APM',
    icon: <BarChart2 size={16} />,
    color: 'text-purple-400',
    bgColor: 'bg-purple-400/10',
    borderColor: 'border-purple-400/20 hover:border-purple-400/50',
  },
];

export function ResourcePalette() {
  const { addResource } = useStore();

  return (
    <div>
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Resources
      </div>
      <div className="space-y-1.5">
        {PALETTE_ITEMS.map((item) => (
          <button
            key={item.type}
            onClick={() => addResource(item.type)}
            className={`w-full flex items-center gap-3 p-2.5 rounded-lg border ${item.borderColor} ${item.bgColor} bg-opacity-50 transition-all group`}
          >
            <span className={item.color}>{item.icon}</span>
            <div className="flex-1 text-left min-w-0">
              <div className="text-sm font-medium text-white">{item.label}</div>
              <div className="text-xs text-gray-500">{item.description}</div>
            </div>
            <span className={`${item.color} opacity-0 group-hover:opacity-100 transition-opacity`}>
              <Plus size={14} />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
