import { useState } from 'react';
import { Download, Settings, Rocket, FolderOpen, Save } from 'lucide-react';
import { useStore } from '../store/useStore';
import { AZURE_REGIONS, ProjectConfig } from '../types/resources';
import { generateAllFiles } from '../generators/bicep/mainBicep';
import { downloadAsZip } from '../utils/download';
import { DeployModal } from './DeployModal';
import { isFileSystemAccessSupported, pickFolder, readProjectFromFolder, saveFilesToFolder } from '../utils/fileSystem';

export function TopBar() {
  const { state, setProjectConfig, loadProject } = useStore();
  const { project } = state;
  const [showDeploy, setShowDeploy] = useState(false);
  const [dirHandle, setDirHandle] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle');

  function handleDownloadAll() {
    const files = generateAllFiles(project);
    const zipName = `${project.projectName || 'infra'}-${project.environment}.zip`;
    downloadAsZip(files, zipName);
  }

  function handleChange(field: keyof ProjectConfig, value: string) {
    setProjectConfig({ [field]: value } as Partial<ProjectConfig>);
    if (field === 'projectName' || field === 'environment') {
      const newProject = field === 'projectName' ? value : project.projectName;
      const newEnv = field === 'environment' ? value : project.environment;
      setProjectConfig({
        resourceGroupName: `${newProject}-${newEnv}-rg`,
      });
    }
  }

  async function handleLoadFolder() {
    const dir = await pickFolder();
    if (!dir) return;
    const loaded = await readProjectFromFolder(dir);
    if (!loaded) {
      alert('No infrahelper.json found in this folder.\nGenerate and download a project first, then load that folder.');
      return;
    }
    loadProject(loaded);
    setDirHandle(dir);
    setSaveStatus('idle');
  }

  async function handleSaveToFolder() {
    let dir = dirHandle;
    if (!dir) {
      dir = await pickFolder();
      if (!dir) return;
      setDirHandle(dir);
    }
    setSaving(true);
    setSaveStatus('idle');
    try {
      const files = generateAllFiles(project);
      await saveFilesToFolder(dir, files);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <header className="flex items-center gap-4 px-6 py-3 border-b border-[#0b3c5d] bg-[#071525] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 shrink-0">
        <img
          src="https://interprit.com.au/wp-content/uploads/2025/06/interprit-white.svg"
          alt="Interprit"
          className="h-7 w-auto"
        />
        <div className="w-px h-5 bg-[#1a3a52]" />
        <span className="text-sm font-semibold text-white tracking-tight">InfraHelper</span>
        <span className="text-xs text-[#4a7090] hidden sm:block">Azure Bicep Generator</span>
      </div>

      <div className="w-px h-6 bg-[#1a3a52] hidden md:block" />

      {/* Project Settings */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Settings size={14} className="text-gray-500 shrink-0" />

        <div className="flex items-center gap-2 min-w-0">
          <label className="text-xs text-gray-500 whitespace-nowrap hidden lg:block">Project</label>
          <input
            type="text"
            value={project.projectName}
            onChange={(e) => handleChange('projectName', e.target.value)}
            placeholder="projectname"
            className="bg-[#0f2840] border border-[#1a3a52] rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-[#2ea3f2] w-32"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap hidden lg:block">Env</label>
          <select
            value={project.environment}
            onChange={(e) => handleChange('environment', e.target.value)}
            className="bg-[#0f2840] border border-[#1a3a52] rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-[#2ea3f2]"
          >
            <option value="dev">dev</option>
            <option value="staging">staging</option>
            <option value="prod">prod</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap hidden lg:block">Region</label>
          <select
            value={project.location}
            onChange={(e) => handleChange('location', e.target.value)}
            className="bg-[#0f2840] border border-[#1a3a52] rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-[#2ea3f2] w-36"
          >
            {AZURE_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2 min-w-0">
          <label className="text-xs text-gray-500 whitespace-nowrap hidden lg:block">RG</label>
          <input
            type="text"
            value={project.resourceGroupName}
            onChange={(e) => setProjectConfig({ resourceGroupName: e.target.value })}
            placeholder="resource-group"
            className="bg-[#0f2840] border border-[#1a3a52] rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-[#2ea3f2] w-48 min-w-0"
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="text-xs text-gray-500 hidden xl:block">
          {project.resources.length} resource{project.resources.length !== 1 ? 's' : ''}
        </div>
        {isFileSystemAccessSupported() && (
          <>
            <button
              onClick={handleLoadFolder}
              title="Load project from folder"
              className="flex items-center gap-2 bg-[#0f2840] hover:bg-[#1a3a52] border border-[#1a3a52] text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              <FolderOpen size={14} />
              <span className="hidden sm:block">Load</span>
            </button>
            <button
              onClick={handleSaveToFolder}
              disabled={project.resources.length === 0 || saving}
              title={dirHandle ? `Save to: ${dirHandle.name}` : 'Save to folder'}
              className="flex items-center gap-2 bg-[#0f2840] hover:bg-[#1a3a52] border border-[#1a3a52] disabled:bg-[#0f2840] disabled:text-gray-600 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              <Save size={14} className={saveStatus === 'saved' ? 'text-green-400' : saveStatus === 'error' ? 'text-red-400' : ''} />
              <span className="hidden sm:block">
                {saving ? 'Saving…' : saveStatus === 'saved' ? 'Saved!' : saveStatus === 'error' ? 'Error' : dirHandle ? `Save (${dirHandle.name})` : 'Save'}
              </span>
            </button>
          </>
        )}
        <button
          onClick={handleDownloadAll}
          disabled={project.resources.length === 0}
          className="flex items-center gap-2 bg-[#0f2840] hover:bg-[#1a3a52] border border-[#1a3a52] disabled:bg-[#0f2840] disabled:text-gray-600 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
        >
          <Download size={14} />
          <span className="hidden sm:block">Download All</span>
        </button>
        <button
          onClick={() => setShowDeploy(true)}
          disabled={project.resources.length === 0}
          className="flex items-center gap-2 bg-[#2ea3f2] hover:bg-[#1a8fd1] disabled:bg-[#1a3a52] disabled:text-gray-500 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
        >
          <Rocket size={14} />
          <span className="hidden sm:block">Deploy</span>
        </button>
      </div>

      {showDeploy && (
        <DeployModal project={project} onClose={() => setShowDeploy(false)} />
      )}
    </header>
  );
}
