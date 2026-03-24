import { useRef, useState } from 'react';
import { TopBar } from './components/TopBar';
import { ResourcePalette } from './components/ResourcePalette';
import { NetworkingToggle } from './components/NetworkingToggle';
import { ResourceCard } from './components/ResourceCard';
import { ResourceConfigurator } from './components/ResourceConfigurator';
import { OutputPanel } from './components/OutputPanel';
import { useStore } from './store/useStore';
import { Layers } from 'lucide-react';

export function App() {
  const { state } = useStore();
  const { project, selectedResourceId } = state;
  const selectedResource = project.resources.find((r) => r.id === selectedResourceId);

  const [rightWidth, setRightWidth] = useState(420);
  const [paletteCompact, setPaletteCompact] = useState(false);
  const dragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartW = useRef(0);

  function handleResizeStart(e: React.MouseEvent) {
    dragging.current = true;
    dragStartX.current = e.clientX;
    dragStartW.current = rightWidth;

    function onMove(e: MouseEvent) {
      if (!dragging.current) return;
      const delta = dragStartX.current - e.clientX;
      setRightWidth(Math.max(300, Math.min(900, dragStartW.current + delta)));
    }
    function onUp() {
      dragging.current = false;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div className="flex flex-col h-screen bg-[#0a0a0f] overflow-hidden">
      <TopBar />

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside
          className="shrink-0 flex flex-col border-r border-gray-800 bg-[#0d1117] overflow-y-auto transition-all duration-200"
          style={{ width: paletteCompact ? 60 : 280 }}
        >
          <div className={`p-4 ${paletteCompact ? 'px-2.5' : ''}`}>
            <ResourcePalette
              compact={paletteCompact}
              onToggleCompact={() => setPaletteCompact((v) => !v)}
            />
          </div>
        </aside>

        {/* Center panel */}
        <main className="flex-1 flex flex-col overflow-hidden border-r border-gray-800">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-800 bg-[#0d1117] shrink-0">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-gray-500" />
              <span className="text-sm font-medium text-gray-300">Resources</span>
              {project.resources.length > 0 && (
                <span className="text-xs bg-gray-700 text-gray-400 px-1.5 py-0.5 rounded-full">
                  {project.resources.length}
                </span>
              )}
            </div>
            <NetworkingToggle variant="inline" />
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {project.resources.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center py-20">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-gray-700 flex items-center justify-center mb-4">
                  <Layers size={24} className="text-gray-700" />
                </div>
                <div className="text-sm text-gray-500 font-medium">No resources yet</div>
                <div className="text-xs text-gray-600 mt-1 max-w-[220px]">
                  Click a resource type in the left panel to add it to your project.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {project.resources.map((resource) => (
                  <div key={resource.id}>
                    <ResourceCard
                      resource={resource}
                      isSelected={resource.id === selectedResourceId}
                    />
                    {resource.id === selectedResourceId && selectedResource && (
                      <div className="mt-1 rounded-lg border border-gray-700/50 bg-gray-900/40">
                        <ResourceConfigurator resource={selectedResource} />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>

        {/* Drag handle */}
        <div
          className="w-1 shrink-0 cursor-col-resize hover:bg-[#2ea3f2] transition-colors group relative"
          style={{ background: 'transparent' }}
          onMouseDown={handleResizeStart}
        >
          <div className="absolute inset-y-0 -left-1 -right-1" />
        </div>

        {/* Right panel — Output */}
        <aside className="shrink-0 flex flex-col bg-[#0d1117]" style={{ width: rightWidth }}>
          <div className="flex items-center px-4 py-2.5 border-b border-gray-800 shrink-0">
            <span className="text-sm font-medium text-gray-300">Generated Files</span>
          </div>
          <div className="flex-1 overflow-hidden flex flex-col">
            <OutputPanel />
          </div>
        </aside>
      </div>
    </div>
  );
}
