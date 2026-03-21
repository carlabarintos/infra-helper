import { useState } from 'react';
import { Cloud, Download, Settings, Rocket, FolderOpen, Save } from 'lucide-react';
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
    <header className="flex items-center gap-4 px-6 py-3 border-b border-gray-800 bg-[#0d1117] shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-[#0078d4] flex items-center justify-center">
          <Cloud size={18} className="text-white" />
        </div>
        <span className="text-lg font-bold text-white tracking-tight">InfraHelper</span>
        <span className="text-xs text-gray-500 ml-1 hidden sm:block">Azure Bicep Generator</span>
      </div>

      <div className="w-px h-6 bg-gray-700 hidden md:block" />

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
            className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-[#0078d4] w-32"
          />
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-gray-500 whitespace-nowrap hidden lg:block">Env</label>
          <select
            value={project.environment}
            onChange={(e) => handleChange('environment', e.target.value)}
            className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-[#0078d4]"
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
            className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-[#0078d4] w-36"
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
            className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-sm text-white focus:outline-none focus:border-[#0078d4] w-48 min-w-0"
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
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            >
              <FolderOpen size={14} />
              <span className="hidden sm:block">Load</span>
            </button>
            <button
              onClick={handleSaveToFolder}
              disabled={project.resources.length === 0 || saving}
              title={dirHandle ? `Save to: ${dirHandle.name}` : 'Save to folder'}
              className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
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
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 disabled:bg-gray-800 disabled:text-gray-600 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
        >
          <Download size={14} />
          <span className="hidden sm:block">Download All</span>
        </button>
        <button
          onClick={() => setShowDeploy(true)}
          disabled={project.resources.length === 0}
          className="flex items-center gap-2 bg-[#0078d4] hover:bg-[#006cbf] disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed text-white px-4 py-1.5 rounded-md text-sm font-medium transition-colors"
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
