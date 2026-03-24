import React, { useState, useMemo } from 'react';
import { Copy, Download, Check, FileCode, GitBranch, Settings2, Network } from 'lucide-react';
import { useStore } from '../store/useStore';
import { generateAllFiles } from '../generators/bicep/mainBicep';
import { generateTerraformFiles } from '../generators/terraform/mainTf';
import { downloadFile, copyToClipboard } from '../utils/download';
import { DiagramPanel } from './DiagramPanel';

interface TabDef {
  id: string;
  label: string;
  filename: string;
  icon?: React.ReactNode;
}

// ─── Syntax Highlighting ──────────────────────────────────────────────────────

function highlightBicep(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Comments
    .replace(/(\/\/[^\n]*)/g, '<span class="token-comment">$1</span>')
    // Decorators
    .replace(/(@[a-zA-Z]+)/g, '<span class="token-decorator">$1</span>')
    // Keywords
    .replace(
      /\b(targetScope|param|var|resource|module|output|if|else|for|in|existing|import|type|func|extends)\b/g,
      '<span class="token-keyword">$1</span>'
    )
    // String literals
    .replace(/(&#39;[^&#39;]*&#39;|'[^']*')/g, '<span class="token-string">$1</span>')
    // Numbers
    .replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');
}

function highlightYaml(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Comments
    .replace(/(#[^\n]*)/g, '<span class="token-comment">$1</span>')
    // Keys
    .replace(/^(\s*)([a-zA-Z_-]+):/gm, '$1<span class="token-param">$2</span>:')
    // Strings
    .replace(/(["'][^"']*["'])/g, '<span class="token-string">$1</span>');
}

function highlightJson(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/("(?:[^"\\]|\\.)*")(\s*:)/g, '<span class="token-param">$1</span>$2')
    .replace(/:\s*("(?:[^"\\]|\\.)*")/g, ': <span class="token-string">$1</span>')
    .replace(/\b(true|false|null)\b/g, '<span class="token-keyword">$1</span>')
    .replace(/\b(\d+(?:\.\d+)?)\b/g, '<span class="token-number">$1</span>');
}

function highlightHcl(code: string): string {
  return code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Comments
    .replace(/(#[^\n]*)/g, '<span class="token-comment">$1</span>')
    // Keywords
    .replace(
      /\b(resource|data|variable|output|locals|provider|terraform|module|required_providers|required_version)\b/g,
      '<span class="token-keyword">$1</span>'
    )
    // String literals
    .replace(/("(?:[^"\\]|\\.)*")/g, '<span class="token-string">$1</span>')
    // Numbers
    .replace(/\b(\d+)\b/g, '<span class="token-number">$1</span>');
}

function getHighlighter(filename: string): (code: string) => string {
  if (filename.endsWith('.bicep')) return highlightBicep;
  if (filename.endsWith('.yml') || filename.endsWith('.yaml')) return highlightYaml;
  if (filename.endsWith('.json')) return highlightJson;
  if (filename.endsWith('.tf') || filename.endsWith('.tfvars')) return highlightHcl;
  return (code: string) => code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── Code Block ────────────────────────────────────────────────────────────────

function CodeBlock({ content, filename }: { content: string; filename: string }) {
  const [copied, setCopied] = useState(false);
  const highlighter = getHighlighter(filename);

  async function handleCopy() {
    await copyToClipboard(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const lines = content.split('\n');

  return (
    <div className="relative flex-1 overflow-hidden flex flex-col">
      {/* File path bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900/60 border-b border-gray-700/50 shrink-0">
        <span className="text-xs text-gray-500 font-mono">{filename}</span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-gray-700"
          >
            {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
            {copied ? 'Copied!' : 'Copy'}
          </button>
          <button
            onClick={() => downloadFile(filename, content)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition-colors px-2 py-0.5 rounded hover:bg-gray-700"
          >
            <Download size={12} />
            Save
          </button>
        </div>
      </div>

      {/* Code area */}
      <div className="flex-1 overflow-auto">
        <pre className="code-block p-0 m-0 text-gray-300 min-h-full">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="hover:bg-gray-800/30">
                  <td className="line-number select-none text-gray-600 text-right pr-3 pl-2 w-10 text-xs border-r border-gray-800 align-top">
                    {i + 1}
                  </td>
                  <td
                    className="pl-4 pr-4 whitespace-pre-wrap break-all align-top"
                    dangerouslySetInnerHTML={{ __html: highlighter(line) || '&nbsp;' }}
                  />
                </tr>
              ))}
            </tbody>
          </table>
        </pre>
      </div>
    </div>
  );
}

// ─── Output Panel ─────────────────────────────────────────────────────────────

type OutputLang = 'bicep' | 'terraform';

export function OutputPanel() {
  const { state } = useStore();
  const { project } = state;
  const [activeTab, setActiveTab] = useState<string>('diagram');
  const [outputLang, setOutputLang] = useState<OutputLang>('bicep');

  const bicepFiles = useMemo(() => generateAllFiles(project), [project]);
  const tfFiles = useMemo(() => generateTerraformFiles(project), [project]);
  const files = outputLang === 'terraform' ? tfFiles : bicepFiles;

  const bicepTabs: TabDef[] = useMemo(() => {
    const result: TabDef[] = [];

    if (bicepFiles['infra/main.bicep']) {
      result.push({ id: 'main.bicep', label: 'main.bicep', filename: 'infra/main.bicep', icon: <FileCode size={12} /> });
    }
    if (bicepFiles['infra/modules/networking.bicep']) {
      result.push({ id: 'networking', label: 'networking', filename: 'infra/modules/networking.bicep', icon: <FileCode size={12} /> });
    }
    project.resources.forEach((r) => {
      const sn = r.name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
      const typePrefix: Record<string, string> = {
        functionApp: 'functionApp',
        appService: 'appService',
        storageAccount: 'storageAccount',
        keyVault: 'keyVault',
        appInsights: 'appInsights',
      };
      const prefix = typePrefix[r.type];
      if (!prefix) return;
      const key = `infra/modules/${prefix}-${sn}.bicep`;
      if (bicepFiles[key]) {
        result.push({ id: key, label: `${prefix}-${sn}`, filename: key, icon: <FileCode size={12} /> });
      }
    });
    if (bicepFiles['.github/workflows/deploy.yml']) {
      result.push({ id: 'github', label: 'GitHub Actions', filename: '.github/workflows/deploy.yml', icon: <GitBranch size={12} /> });
    }
    (['dev', 'staging', 'prod'] as const).forEach((env) => {
      const key = `infra/parameters.${env}.json`;
      if (bicepFiles[key]) {
        result.push({ id: `params-${env}`, label: `params.${env}`, filename: key, icon: <Settings2 size={12} /> });
      }
    });
    return result;
  }, [bicepFiles, project.resources]);

  const tfTabs: TabDef[] = useMemo(() => {
    return Object.keys(tfFiles)
      .filter((k) => k.endsWith('.tf') || k.endsWith('.tfvars'))
      .sort((a, b) => {
        // main.tf first, then variables, outputs, then rest alphabetically
        const order = ['terraform/main.tf', 'terraform/variables.tf', 'terraform/outputs.tf'];
        const ai = order.indexOf(a);
        const bi = order.indexOf(b);
        if (ai !== -1 && bi !== -1) return ai - bi;
        if (ai !== -1) return -1;
        if (bi !== -1) return 1;
        return a.localeCompare(b);
      })
      .map((k) => ({
        id: k,
        label: k.replace('terraform/', ''),
        filename: k,
        icon: <FileCode size={12} />,
      }));
  }, [tfFiles]);

  const codeTabs = outputLang === 'terraform' ? tfTabs : bicepTabs;

  function handleLangChange(lang: OutputLang) {
    setOutputLang(lang);
    const newTabs = lang === 'terraform' ? tfTabs : bicepTabs;
    setActiveTab(newTabs.length > 0 ? newTabs[0].id : 'diagram');
  }

  function handleDownloadAll() {
    Object.entries(files).forEach(([filename, content], i) => {
      setTimeout(() => downloadFile(filename, content), i * 100);
    });
  }

  const allTabs = [
    { id: 'diagram', label: 'Diagram', filename: '', icon: <Network size={12} /> },
    ...codeTabs,
  ];
  const activeTabDef = allTabs.find((t) => t.id === activeTab) ?? allTabs[0];

  return (
    <div className="flex flex-col h-full">
      {/* Language toggle */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-gray-700/50 bg-gray-900/40 shrink-0">
        <span className="text-xs text-gray-500">Output format</span>
        <div className="flex items-center rounded overflow-hidden border border-gray-700">
          <button
            onClick={() => handleLangChange('bicep')}
            className={`px-2.5 py-1 text-xs transition-colors ${
              outputLang === 'bicep'
                ? 'bg-[#2ea3f2] text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            Bicep
          </button>
          <button
            onClick={() => handleLangChange('terraform')}
            className={`px-2.5 py-1 text-xs transition-colors ${
              outputLang === 'terraform'
                ? 'bg-[#7b42bc] text-white'
                : 'text-gray-400 hover:text-gray-200 hover:bg-gray-700/50'
            }`}
          >
            Terraform
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-gray-700/50 overflow-x-auto shrink-0 bg-gray-900/20">
        {allTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs whitespace-nowrap border-b-2 transition-colors ${
              activeTabDef?.id === tab.id
                ? outputLang === 'terraform'
                  ? 'border-[#7b42bc] text-[#9b6bdc] bg-gray-800/30'
                  : 'border-[#2ea3f2] text-[#2ea3f2] bg-gray-800/30'
                : 'border-transparent text-gray-500 hover:text-gray-300 hover:bg-gray-800/20'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Diagram tab */}
      {activeTabDef?.id === 'diagram' && (
        <div className="flex-1 overflow-hidden flex flex-col">
          <DiagramPanel />
        </div>
      )}

      {/* Code content */}
      {activeTabDef?.id !== 'diagram' && activeTabDef && files[activeTabDef.filename] && (
        <CodeBlock
          key={activeTabDef.filename}
          content={files[activeTabDef.filename]}
          filename={activeTabDef.filename}
        />
      )}

      {/* Bottom bar */}
      <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-gray-700/50 bg-gray-900/30">
        <span className="text-xs text-gray-600">
          {Object.keys(files).length} file{Object.keys(files).length !== 1 ? 's' : ''} generated
        </span>
        <button
          onClick={handleDownloadAll}
          className={`flex items-center gap-1.5 text-xs text-white px-3 py-1.5 rounded-md transition-colors ${
            outputLang === 'terraform'
              ? 'bg-[#7b42bc] hover:bg-[#6a35a8]'
              : 'bg-[#2ea3f2] hover:bg-[#1a8fd1]'
          }`}
        >
          <Download size={12} />
          Download All Files
        </button>
      </div>
    </div>
  );
}
