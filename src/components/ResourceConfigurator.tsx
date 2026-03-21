import { Plus, Trash2, Eye, EyeOff } from 'lucide-react';
import { useStore } from '../store/useStore';
import {
  Resource,
  FunctionAppConfig,
  AppServiceConfig,
  AppServicePlanConfig,
  StorageAccountConfig,
  KeyVaultConfig,
  AppInsightsConfig,
  EnvVar,
  ResourceConfig,
} from '../types/resources';

// ─── helpers ──────────────────────────────────────────────────────────────────

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-gray-400 mb-1">{children}</label>;
}

function Select({
  value,
  onChange,
  children,
  className = '',
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#2ea3f2] ${className}`}
    >
      {children}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer">
      <label className="toggle-switch">
        <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
        <span className="toggle-slider" />
      </label>
      <span className="text-sm text-gray-300">{label}</span>
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  label?: string;
}) {
  return (
    <div>
      {label && <Label>{label}</Label>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#2ea3f2]"
      />
    </div>
  );
}

// ─── Env Vars Table ────────────────────────────────────────────────────────────

function EnvVarsEditor({
  envVars,
  onChange,
}: {
  envVars: EnvVar[];
  onChange: (vars: EnvVar[]) => void;
}) {
  const [showValues, setShowValues] = React.useState(false);

  function addRow() {
    onChange([...envVars, { key: '', value: '', isSecret: false }]);
  }

  function removeRow(i: number) {
    onChange(envVars.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, updates: Partial<EnvVar>) {
    onChange(envVars.map((ev, idx) => (idx === i ? { ...ev, ...updates } : ev)));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <Label>Environment Variables</Label>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowValues(!showValues)}
            className="text-gray-500 hover:text-gray-300 p-1"
            title={showValues ? 'Hide values' : 'Show values'}
          >
            {showValues ? <Eye size={12} /> : <EyeOff size={12} />}
          </button>
          <button
            onClick={addRow}
            className="flex items-center gap-1 text-xs text-[#2ea3f2] hover:text-blue-300 transition-colors"
          >
            <Plus size={12} /> Add
          </button>
        </div>
      </div>
      {envVars.length === 0 ? (
        <div className="text-xs text-gray-600 italic text-center py-3 border border-dashed border-gray-700 rounded-md">
          No environment variables
        </div>
      ) : (
        <div className="space-y-1.5">
          {envVars.map((ev, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input
                type="text"
                value={ev.key}
                onChange={(e) => updateRow(i, { key: e.target.value })}
                placeholder="KEY"
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#2ea3f2]"
              />
              <input
                type={showValues ? 'text' : 'password'}
                value={ev.value}
                onChange={(e) => updateRow(i, { value: e.target.value })}
                placeholder={ev.isSecret ? '(secret ref)' : 'value'}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#2ea3f2]"
              />
              <button
                onClick={() => updateRow(i, { isSecret: !ev.isSecret })}
                title={ev.isSecret ? 'Secret (KeyVault ref)' : 'Plain value'}
                className={`p-1 rounded text-xs transition-colors ${
                  ev.isSecret
                    ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
                    : 'text-gray-600 hover:text-gray-400'
                }`}
              >
                🔑
              </button>
              <button
                onClick={() => removeRow(i)}
                className="p-1 text-gray-600 hover:text-red-400 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
      {envVars.some((ev) => ev.isSecret) && (
        <p className="text-xs text-orange-400/70 mt-1.5">
          Secrets will use Key Vault references. Ensure keyVaultBaseUri param is set.
        </p>
      )}
    </div>
  );
}

// ─── Configurators per resource type ──────────────────────────────────────────

import React, { useState } from 'react';
import { Wifi } from 'lucide-react';

function IpAccessToggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const { state, setProjectConfig } = useStore();
  const [detecting, setDetecting] = useState(false);

  async function detectIp() {
    setDetecting(true);
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      setProjectConfig({ allowedIpAddress: data.ip });
    } catch {
      // silently fail — user can type manually
    } finally {
      setDetecting(false);
    }
  }

  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 cursor-pointer">
        <label className="toggle-switch">
          <input type="checkbox" checked={checked} onChange={(e) => {
            onChange(e.target.checked);
            if (e.target.checked && !state.project.allowedIpAddress) detectIp();
          }} />
          <span className="toggle-slider" />
        </label>
        <span className="text-sm text-gray-300 flex items-center gap-1.5">
          <Wifi size={13} className="text-sky-400" /> Allow my IP to access
        </span>
      </label>
      {checked && (
        <div className="pl-9 flex items-center gap-2">
          <input
            type="text"
            value={state.project.allowedIpAddress}
            onChange={(e) => setProjectConfig({ allowedIpAddress: e.target.value })}
            placeholder="x.x.x.x"
            className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#2ea3f2]"
          />
          <button
            onClick={detectIp}
            disabled={detecting}
            className="text-xs text-sky-400 hover:text-sky-300 whitespace-nowrap disabled:opacity-50"
          >
            {detecting ? 'Detecting…' : 'Detect IP'}
          </button>
        </div>
      )}
    </div>
  );
}

function AppServicePlanConfigurator({
  resource,
  update,
}: {
  resource: Resource;
  update: (c: Partial<ResourceConfig>) => void;
}) {
  const config = resource.config as AppServicePlanConfig;

  const skuOptions: { value: string; label: string }[] = [
    { value: 'EP1', label: 'Elastic Premium EP1 — 1 vCPU, 3.5 GB' },
    { value: 'EP2', label: 'Elastic Premium EP2 — 2 vCPU, 7 GB' },
    { value: 'EP3', label: 'Elastic Premium EP3 — 4 vCPU, 14 GB' },
    { value: 'B1', label: 'Basic B1 — 1 vCPU, 1.75 GB' },
    { value: 'B2', label: 'Basic B2 — 2 vCPU, 3.5 GB' },
    { value: 'B3', label: 'Basic B3 — 4 vCPU, 7 GB' },
    { value: 'S1', label: 'Standard S1 — 1 vCPU, 1.75 GB' },
    { value: 'S2', label: 'Standard S2 — 2 vCPU, 3.5 GB' },
    { value: 'S3', label: 'Standard S3 — 4 vCPU, 7 GB' },
    { value: 'P1v3', label: 'Premium P1v3 — 2 vCPU, 8 GB' },
    { value: 'P2v3', label: 'Premium P2v3 — 4 vCPU, 16 GB' },
    { value: 'P3v3', label: 'Premium P3v3 — 8 vCPU, 32 GB' },
  ];

  return (
    <div className="space-y-4">
      <div>
        <Label>SKU</Label>
        <Select
          value={config.sku}
          onChange={(v) => update({ sku: v as AppServicePlanConfig['sku'] })}
        >
          {skuOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </Select>
      </div>

      <div>
        <Label>OS</Label>
        <Select
          value={config.os}
          onChange={(v) => update({ os: v as AppServicePlanConfig['os'] })}
        >
          <option value="Windows">Windows — .NET (in-process & isolated), Node.js, Java, PowerShell</option>
          <option value="Linux">Linux — Python (required), Node.js, dotnet-isolated</option>
        </Select>
      </div>

      <div className="bg-sky-400/5 border border-sky-400/20 rounded-lg p-3">
        <p className="text-xs text-gray-400">
          Function Apps and App Services can reference this shared plan instead of creating their own.
          Consumption (Y1) plans cannot be shared — use EP1+ for Function Apps or B1+ for App Services.
        </p>
      </div>
    </div>
  );
}

function FunctionAppConfigurator({
  resource,
  update,
}: {
  resource: Resource;
  update: (c: Partial<ResourceConfig>) => void;
}) {
  const config = resource.config as FunctionAppConfig;
  const { state } = useStore();
  const storageAccounts = state.project.resources.filter((r) => r.type === 'storageAccount');
  const appInsights = state.project.resources.filter((r) => r.type === 'appInsights');
  const sharedPlans = state.project.resources.filter((r) => r.type === 'appServicePlan');

  const selectedPlan = sharedPlans.find((r) => r.id === config.sharedPlanRef);
  const planOs = selectedPlan ? (selectedPlan.config as AppServicePlanConfig).os : null;
  const pythonForced = config.runtime === 'python';
  const effectiveOs = pythonForced ? 'Linux' : planOs ?? config.os;

  const runtimeVersions: Record<string, string[]> = {
    'dotnet-isolated': ['10', '8', '6'],
    dotnet: ['6', '4'],
    node: ['20', '18', '16'],
    python: ['3.11', '3.10', '3.9'],
    java: ['17', '11'],
    powershell: ['7.2', '7.0'],
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Runtime</Label>
          <Select
            value={config.runtime}
            onChange={(v) => {
              const rt = v as FunctionAppConfig['runtime'];
              update({ runtime: rt, runtimeVersion: runtimeVersions[rt][0], os: rt === 'python' ? 'Linux' : config.os });
            }}
          >
            <option value="dotnet-isolated">dotnet-isolated</option>
            <option value="dotnet">dotnet (in-process)</option>
            <option value="node">Node.js</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="powershell">PowerShell</option>
          </Select>
        </div>
        <div>
          <Label>Version</Label>
          <Select
            value={config.runtimeVersion}
            onChange={(v) => update({ runtimeVersion: v })}
          >
            {(runtimeVersions[config.runtime] || []).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
        </div>
      </div>

      {/* OS selector — hidden when shared plan (plan determines OS) or Python (always Linux) */}
      {!config.sharedPlanRef && !pythonForced && (
        <div>
          <Label>OS</Label>
          <Select
            value={config.os}
            onChange={(v) => update({ os: v as FunctionAppConfig['os'] })}
          >
            <option value="Windows">Windows — .NET (in-process & isolated), Node.js, Java, PowerShell</option>
            <option value="Linux">Linux — dotnet-isolated, Node.js, Python</option>
          </Select>
        </div>
      )}
      {(config.sharedPlanRef || pythonForced) && (
        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-800/50 border border-gray-700 rounded-md">
          <span className="text-xs text-gray-500">OS:</span>
          <span className="text-xs text-gray-300">{effectiveOs}{planOs ? ` (from shared plan)` : ` (Python requires Linux)`}</span>
        </div>
      )}

      <div>
        <Label>Shared App Service Plan</Label>
        <Select
          value={config.sharedPlanRef || ''}
          onChange={(v) => update({ sharedPlanRef: v || undefined, sku: v ? config.sku === 'Y1' ? 'EP1' : config.sku : config.sku })}
        >
          <option value="">— Dedicated plan (create own) —</option>
          {sharedPlans.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
        {sharedPlans.length === 0 && (
          <p className="text-xs text-sky-400/70 mt-1">Add an App Service Plan resource to share it here.</p>
        )}
      </div>

      {!config.sharedPlanRef && (
        <div>
          <Label>SKU / Plan</Label>
          <Select value={config.sku} onChange={(v) => update({ sku: v as FunctionAppConfig['sku'] })}>
            <option value="Y1">Consumption (Y1) — Pay per execution</option>
            <option value="EP1">Elastic Premium EP1 — 1 vCPU, 3.5 GB</option>
            <option value="EP2">Elastic Premium EP2 — 2 vCPU, 7 GB</option>
            <option value="EP3">Elastic Premium EP3 — 4 vCPU, 14 GB</option>
          </Select>
        </div>
      )}

      <div>
        <Label>Storage Account</Label>
        <Select
          value={config.storageAccountRef || ''}
          onChange={(v) => update({ storageAccountRef: v || undefined })}
        >
          <option value="">— Select a storage account —</option>
          {storageAccounts.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
        {storageAccounts.length === 0 && (
          <p className="text-xs text-amber-400/70 mt-1">Add a Storage Account resource to link it here.</p>
        )}
      </div>

      <div>
        <Label>Application Insights</Label>
        <Select
          value={config.appInsightsRef || ''}
          onChange={(v) => update({ appInsightsRef: v || undefined })}
        >
          <option value="">— None —</option>
          {appInsights.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
      </div>

      <EnvVarsEditor
        envVars={config.envVars}
        onChange={(vars) => update({ envVars: vars })}
      />

      <div className="space-y-2">
        <Toggle
          checked={config.enablePrivateEndpoint}
          onChange={(v) => update({ enablePrivateEndpoint: v })}
          label="Enable Private Endpoint"
        />
        {state.project.enableNetworking && (
          <IpAccessToggle
            checked={config.allowCurrentIp}
            onChange={(v) => update({ allowCurrentIp: v })}
          />
        )}
      </div>
    </div>
  );
}

function AppServiceConfigurator({
  resource,
  update,
}: {
  resource: Resource;
  update: (c: Partial<ResourceConfig>) => void;
}) {
  const config = resource.config as AppServiceConfig;
  const { state } = useStore();
  const appInsights = state.project.resources.filter((r) => r.type === 'appInsights');
  const sharedPlans = state.project.resources.filter((r) => r.type === 'appServicePlan');

  const frameworkVersions: Record<string, string[]> = {
    dotnet: ['10', '8', '6', '4.8'],
    node: ['20', '18', '16'],
    python: ['3.11', '3.10', '3.9'],
    java: ['17', '11'],
    php: ['8.2', '8.1'],
  };

  const skuDescriptions: Record<string, string> = {
    B1: 'Basic B1 — 1 vCPU, 1.75 GB',
    B2: 'Basic B2 — 2 vCPU, 3.5 GB',
    B3: 'Basic B3 — 4 vCPU, 7 GB',
    S1: 'Standard S1 — 1 vCPU, 1.75 GB + scaling',
    S2: 'Standard S2 — 2 vCPU, 3.5 GB + scaling',
    S3: 'Standard S3 — 4 vCPU, 7 GB + scaling',
    P1v3: 'Premium P1v3 — 2 vCPU, 8 GB',
    P2v3: 'Premium P2v3 — 4 vCPU, 16 GB',
    P3v3: 'Premium P3v3 — 8 vCPU, 32 GB',
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Framework</Label>
          <Select
            value={config.framework}
            onChange={(v) => update({ framework: v as AppServiceConfig['framework'], frameworkVersion: frameworkVersions[v as AppServiceConfig['framework']][0] })}
          >
            <option value="dotnet">.NET</option>
            <option value="node">Node.js</option>
            <option value="python">Python</option>
            <option value="java">Java</option>
            <option value="php">PHP</option>
          </Select>
        </div>
        <div>
          <Label>Version</Label>
          <Select
            value={config.frameworkVersion}
            onChange={(v) => update({ frameworkVersion: v })}
          >
            {(frameworkVersions[config.framework] || []).map((v) => (
              <option key={v} value={v}>{v}</option>
            ))}
          </Select>
        </div>
      </div>

      <div>
        <Label>Shared App Service Plan</Label>
        <Select
          value={config.sharedPlanRef || ''}
          onChange={(v) => update({ sharedPlanRef: v || undefined })}
        >
          <option value="">— Dedicated plan (create own) —</option>
          {sharedPlans.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
        {sharedPlans.length === 0 && (
          <p className="text-xs text-sky-400/70 mt-1">Add an App Service Plan resource to share it here.</p>
        )}
      </div>

      {!config.sharedPlanRef && (
        <div>
          <Label>SKU / Plan</Label>
          <Select value={config.sku} onChange={(v) => update({ sku: v as AppServiceConfig['sku'] })}>
            {Object.entries(skuDescriptions).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </Select>
        </div>
      )}

      <div>
        <Label>Application Insights</Label>
        <Select
          value={config.appInsightsRef || ''}
          onChange={(v) => update({ appInsightsRef: v || undefined })}
        >
          <option value="">— None —</option>
          {appInsights.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </Select>
      </div>

      <EnvVarsEditor
        envVars={config.envVars}
        onChange={(vars) => update({ envVars: vars })}
      />

      <div className="space-y-2">
        <Toggle
          checked={config.enableAlwaysOn}
          onChange={(v) => update({ enableAlwaysOn: v })}
          label="Always On"
        />
        <Toggle
          checked={config.enablePrivateEndpoint}
          onChange={(v) => update({ enablePrivateEndpoint: v })}
          label="Enable Private Endpoint"
        />
        {state.project.enableNetworking && (
          <IpAccessToggle
            checked={config.allowCurrentIp}
            onChange={(v) => update({ allowCurrentIp: v })}
          />
        )}
      </div>
    </div>
  );
}

function StorageAccountConfigurator({
  resource,
  update,
}: {
  resource: Resource;
  update: (c: Partial<ResourceConfig>) => void;
}) {
  const config = resource.config as StorageAccountConfig;
  const [newContainer, setNewContainer] = React.useState('');

  function addContainer() {
    const name = newContainer.trim().toLowerCase();
    if (name && !config.containers.includes(name)) {
      update({ containers: [...config.containers, name] });
      setNewContainer('');
    }
  }

  function removeContainer(c: string) {
    update({ containers: config.containers.filter((x) => x !== c) });
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>SKU</Label>
          <Select
            value={config.sku}
            onChange={(v) => update({ sku: v as StorageAccountConfig['sku'] })}
          >
            <option value="Standard_LRS">Standard LRS — Locally redundant</option>
            <option value="Standard_GRS">Standard GRS — Geo-redundant</option>
            <option value="Standard_ZRS">Standard ZRS — Zone-redundant</option>
            <option value="Premium_LRS">Premium LRS — High perf, local</option>
          </Select>
        </div>
        <div>
          <Label>Kind</Label>
          <Select
            value={config.kind}
            onChange={(v) => update({ kind: v as StorageAccountConfig['kind'] })}
          >
            <option value="StorageV2">StorageV2 (recommended)</option>
            <option value="BlobStorage">BlobStorage</option>
            <option value="FileStorage">FileStorage</option>
          </Select>
        </div>
      </div>

      <div>
        <Label>Blob Containers</Label>
        <div className="flex gap-2 mb-2">
          <input
            type="text"
            value={newContainer}
            onChange={(e) => setNewContainer(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addContainer()}
            placeholder="container-name"
            className="flex-1 bg-gray-800 border border-gray-700 rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:border-[#2ea3f2] font-mono"
          />
          <button
            onClick={addContainer}
            className="px-3 py-1.5 bg-gray-700 hover:bg-gray-600 text-white rounded-md text-sm transition-colors"
          >
            <Plus size={14} />
          </button>
        </div>
        {config.containers.length === 0 ? (
          <div className="text-xs text-gray-600 italic text-center py-2 border border-dashed border-gray-700 rounded">
            No containers defined
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {config.containers.map((c) => (
              <span
                key={c}
                className="flex items-center gap-1 bg-emerald-400/10 text-emerald-400 border border-emerald-400/20 text-xs px-2 py-0.5 rounded"
              >
                {c}
                <button onClick={() => removeContainer(c)} className="hover:text-red-400">
                  <Trash2 size={10} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <Toggle
          checked={config.enableBlobPublicAccess}
          onChange={(v) => update({ enableBlobPublicAccess: v })}
          label="Allow blob public access"
        />
        <Toggle
          checked={config.enablePrivateEndpoint}
          onChange={(v) => update({ enablePrivateEndpoint: v })}
          label="Enable Private Endpoint"
        />
      </div>
    </div>
  );
}

function KeyVaultConfigurator({
  resource,
  update,
}: {
  resource: Resource;
  update: (c: Partial<ResourceConfig>) => void;
}) {
  const config = resource.config as KeyVaultConfig;
  const { state } = useStore();
  const otherResources = state.project.resources.filter((r) => r.id !== resource.id);

  function toggleAccess(id: string) {
    const current = config.accessPolicies;
    const updated = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
    update({ accessPolicies: updated });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>SKU</Label>
        <Select
          value={config.sku}
          onChange={(v) => update({ sku: v as KeyVaultConfig['sku'] })}
        >
          <option value="standard">Standard — Software-protected keys</option>
          <option value="premium">Premium — HSM-protected keys</option>
        </Select>
      </div>

      <div className="space-y-2">
        <Toggle
          checked={config.enableSoftDelete}
          onChange={(v) => update({ enableSoftDelete: v })}
          label="Enable Soft Delete"
        />
        {config.enableSoftDelete && (
          <div className="pl-14">
            <NumberInput
              value={config.softDeleteRetentionDays}
              onChange={(v) => update({ softDeleteRetentionDays: Math.min(90, Math.max(7, v)) })}
              min={7}
              max={90}
              label="Retention Days (7-90)"
            />
          </div>
        )}
      </div>

      <div>
        <Label>Resource Access (RBAC — Key Vault Secrets User)</Label>
        {otherResources.length === 0 ? (
          <div className="text-xs text-gray-600 italic text-center py-2 border border-dashed border-gray-700 rounded">
            Add other resources to grant them access
          </div>
        ) : (
          <div className="space-y-1.5 mt-1">
            {otherResources.map((r) => (
              <label key={r.id} className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={config.accessPolicies.includes(r.id)}
                  onChange={() => toggleAccess(r.id)}
                  className="w-3.5 h-3.5 rounded accent-[#2ea3f2]"
                />
                <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                  {r.name}
                </span>
                <span className="text-xs text-gray-600">{r.type}</span>
              </label>
            ))}
          </div>
        )}
      </div>

      <Toggle
        checked={config.enablePrivateEndpoint}
        onChange={(v) => update({ enablePrivateEndpoint: v })}
        label="Enable Private Endpoint"
      />
    </div>
  );
}

function AppInsightsConfigurator({
  resource,
  update,
}: {
  resource: Resource;
  update: (c: Partial<ResourceConfig>) => void;
}) {
  const config = resource.config as AppInsightsConfig;

  return (
    <div className="space-y-4">
      <div>
        <Label>Application Kind</Label>
        <Select
          value={config.kind}
          onChange={(v) => update({ kind: v as AppInsightsConfig['kind'] })}
        >
          <option value="web">Web — Web applications</option>
          <option value="ios">iOS — Mobile apps</option>
          <option value="other">Other — General purpose</option>
        </Select>
      </div>

      <NumberInput
        value={config.retentionDays}
        onChange={(v) => update({ retentionDays: Math.min(730, Math.max(30, v)) })}
        min={30}
        max={730}
        label="Data Retention Days (30-730)"
      />

      <div className="bg-purple-400/5 border border-purple-400/20 rounded-lg p-3">
        <p className="text-xs text-gray-400">
          A Log Analytics Workspace will be created automatically to support workspace-based Application Insights (recommended).
        </p>
      </div>
    </div>
  );
}

// ─── Main Configurator ─────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  functionApp: 'Function App',
  appService: 'App Service',
  appServicePlan: 'App Service Plan',
  storageAccount: 'Storage Account',
  keyVault: 'Key Vault',
  appInsights: 'App Insights',
};

export function ResourceConfigurator({ resource }: { resource: Resource }) {
  const { updateResourceConfig } = useStore();

  function update(config: Partial<ResourceConfig>) {
    updateResourceConfig(resource.id, config);
  }

  return (
    <div className="border-t border-gray-700/50 mt-2 pt-3 px-3 pb-3">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
        Configure — {TYPE_LABELS[resource.type]}
      </div>
      {resource.type === 'appServicePlan' && (
        <AppServicePlanConfigurator resource={resource} update={update} />
      )}
      {resource.type === 'functionApp' && (
        <FunctionAppConfigurator resource={resource} update={update} />
      )}
      {resource.type === 'appService' && (
        <AppServiceConfigurator resource={resource} update={update} />
      )}
      {resource.type === 'storageAccount' && (
        <StorageAccountConfigurator resource={resource} update={update} />
      )}
      {resource.type === 'keyVault' && (
        <KeyVaultConfigurator resource={resource} update={update} />
      )}
      {resource.type === 'appInsights' && (
        <AppInsightsConfigurator resource={resource} update={update} />
      )}
    </div>
  );
}
