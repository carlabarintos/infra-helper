import { Shield, ShieldOff } from 'lucide-react';
import { useStore } from '../store/useStore';

export function NetworkingToggle() {
  const { state, setProjectConfig } = useStore();
  const { enableNetworking } = state.project;

  function handleToggle() {
    setProjectConfig({ enableNetworking: !enableNetworking });
  }

  return (
    <div
      className={`rounded-lg border p-3 cursor-pointer transition-all ${
        enableNetworking
          ? 'border-blue-500/50 bg-blue-950/30'
          : 'border-gray-700 bg-gray-800/30 hover:border-gray-600'
      }`}
      onClick={handleToggle}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {enableNetworking ? (
            <Shield size={16} className="text-blue-400" />
          ) : (
            <ShieldOff size={16} className="text-gray-500" />
          )}
          <div>
            <div className="text-sm font-medium text-white">Private Network</div>
            <div className="text-xs text-gray-500">VNet + Private Endpoints</div>
          </div>
        </div>
        <label className="toggle-switch" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={enableNetworking}
            onChange={handleToggle}
          />
          <span className="toggle-slider" />
        </label>
      </div>

      {enableNetworking && (
        <div className="mt-2 pt-2 border-t border-blue-500/20">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full font-medium">
              <Shield size={10} />
              Private Network Mode
            </span>
          </div>
          <ul className="mt-2 space-y-1">
            <li className="text-xs text-gray-400 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
              VNet with 10.0.0.0/16
            </li>
            <li className="text-xs text-gray-400 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
              Private endpoint subnet
            </li>
            <li className="text-xs text-gray-400 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
              App integration subnet
            </li>
            <li className="text-xs text-gray-400 flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-blue-400 inline-block" />
              Private DNS zones
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
