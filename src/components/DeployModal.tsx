import { useState } from 'react';
import { X, Copy, Check, Download, Terminal } from 'lucide-react';
import { ProjectConfig } from '../types/resources';
import { generateDeployScriptPs1, generateDeployScriptSh } from '../generators/github/workflowGenerator';
import { downloadFile } from '../utils/download';

interface DeployModalProps {
  project: ProjectConfig;
  onClose: () => void;
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  function handle() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }
  return (
    <button
      onClick={handle}
      className="shrink-0 p-1.5 rounded text-gray-500 hover:text-white hover:bg-gray-700 transition-colors"
      title="Copy"
    >
      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
    </button>
  );
}

function Step({
  number,
  title,
  command,
  note,
}: {
  number: number;
  title: string;
  command: string;
  note?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="w-5 h-5 rounded-full bg-[#2ea3f2] text-white text-xs flex items-center justify-center font-bold shrink-0">
          {number}
        </span>
        <span className="text-sm font-medium text-gray-200">{title}</span>
      </div>
      <div className="flex items-start gap-2 bg-gray-900 border border-gray-700 rounded-md px-3 py-2">
        <code className="flex-1 text-xs text-green-300 font-mono whitespace-pre-wrap break-all">{command}</code>
        <CopyButton text={command} />
      </div>
      {note && <p className="text-xs text-gray-500 pl-7">{note}</p>}
    </div>
  );
}

export function DeployModal({ project, onClose }: DeployModalProps) {
  const [subscriptionId, setSubscriptionId] = useState('');
  const [environment, setEnvironment] = useState<'dev' | 'staging' | 'prod'>(project.environment);
  const [activeTab, setActiveTab] = useState<'steps' | 'ps1' | 'sh'>('steps');

  const rg = project.resourceGroupName;
  const loc = project.location;
  const sub = subscriptionId || '<YOUR-SUBSCRIPTION-ID>';

  const deployCmd =
    `az deployment group create \\\n` +
    `  --name "deploy-$(date +%Y%m%d-%H%M%S)" \\\n` +
    `  --resource-group "${rg}" \\\n` +
    `  --template-file "infra/main.bicep" \\\n` +
    `  --parameters "infra/parameters.${environment}.json"`;

  const ps1 = generateDeployScriptPs1(project, subscriptionId, environment);
  const sh = generateDeployScriptSh(project, subscriptionId, environment);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#161b22] border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-700 shrink-0">
          <div className="flex items-center gap-2">
            <Terminal size={18} className="text-[#2ea3f2]" />
            <span className="text-white font-semibold">Deploy to Azure</span>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Config row */}
        <div className="flex items-center gap-4 px-5 py-3 border-b border-gray-800 shrink-0 bg-gray-900/40">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <label className="text-xs text-gray-500 whitespace-nowrap">Subscription ID</label>
            <input
              type="text"
              value={subscriptionId}
              onChange={(e) => setSubscriptionId(e.target.value)}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              className="flex-1 min-w-0 bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white font-mono focus:outline-none focus:border-[#2ea3f2]"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <label className="text-xs text-gray-500">Environment</label>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value as 'dev' | 'staging' | 'prod')}
              className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-[#2ea3f2]"
            >
              <option value="dev">dev</option>
              <option value="staging">staging</option>
              <option value="prod">prod</option>
            </select>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-5 pt-3 shrink-0">
          {(['steps', 'ps1', 'sh'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`px-3 py-1 text-xs rounded-md font-medium transition-colors ${
                activeTab === t
                  ? 'bg-[#2ea3f2] text-white'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}
            >
              {t === 'steps' ? 'Step-by-step' : t === 'ps1' ? 'PowerShell Script' : 'Bash Script'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {activeTab === 'steps' && (
            <>
              <Step
                number={1}
                title="Login to Azure"
                command="az login"
                note="Opens a browser for interactive login. Use --tenant <id> to specify a tenant."
              />
              <Step
                number={2}
                title="Set Subscription"
                command={`az account set --subscription "${sub}"`}
                note={!subscriptionId ? 'Enter your Subscription ID above to fill this in.' : undefined}
              />
              <Step
                number={3}
                title={`Create Resource Group "${rg}"`}
                command={`az group create \\\n  --name "${rg}" \\\n  --location "${loc}"`}
                note="Safe to re-run — will not overwrite an existing group."
              />
              <Step
                number={4}
                title="Deploy Bicep Template"
                command={deployCmd}
                note={`Deploys infra/main.bicep with infra/parameters.${environment}.json. Run from your repo root.`}
              />
              <div className="bg-amber-400/5 border border-amber-400/20 rounded-lg p-3 text-xs text-amber-300/80">
                Make sure you have run <strong>Download All</strong> first and placed the files in your repository before running these commands.
              </div>
            </>
          )}

          {activeTab === 'ps1' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Run with: <code className="text-green-300">.\deploy.ps1</code> or <code className="text-green-300">.\deploy.ps1 -SubscriptionId "..." -Environment "{environment}"</code></p>
                <CopyButton text={ps1} />
              </div>
              <pre className="bg-gray-900 border border-gray-700 rounded-md p-3 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre">{ps1}</pre>
            </div>
          )}

          {activeTab === 'sh' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs text-gray-400">Run with: <code className="text-green-300">chmod +x deploy.sh && ./deploy.sh</code> or <code className="text-green-300">./deploy.sh "{sub}" "{environment}"</code></p>
                <CopyButton text={sh} />
              </div>
              <pre className="bg-gray-900 border border-gray-700 rounded-md p-3 text-xs text-green-300 font-mono overflow-x-auto whitespace-pre">{sh}</pre>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-gray-700 shrink-0">
          <div className="flex gap-2">
            <button
              onClick={() => downloadFile('deploy.ps1', ps1)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-md transition-colors"
            >
              <Download size={12} /> deploy.ps1
            </button>
            <button
              onClick={() => downloadFile('deploy.sh', sh)}
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 border border-gray-700 px-3 py-1.5 rounded-md transition-colors"
            >
              <Download size={12} /> deploy.sh
            </button>
          </div>
          <button
            onClick={onClose}
            className="text-sm text-gray-400 hover:text-white px-4 py-1.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
