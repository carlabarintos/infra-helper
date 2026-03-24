import { useEffect, useMemo, useRef, useState } from 'react';
import { ImageDown } from 'lucide-react';
import { useStore } from '../store/useStore';
import { Resource, ResourceType } from '../types/resources';

const NODE_W = 160;
const NODE_H = 62;
const ROW_GAP = 24;
const PADDING_Y = 52;
const COL_X = [40, 260, 480, 700];
const CANVAS_W = 920;
const CANVAS_MIN_H = 400;

const TYPE_COL: Record<ResourceType, number> = {
  appServicePlan: 0,
  functionApp: 1,
  appService: 1,
  storageAccount: 2,
  keyVault: 2,
  appInsights: 3,
};

const TYPE_COLORS: Record<ResourceType, { border: string; bg: string; abbr: string }> = {
  appServicePlan: { border: '#2fd5c7', bg: 'rgba(47,213,199,0.07)',  abbr: 'ASP' },
  functionApp:    { border: '#2ea3f2', bg: 'rgba(46,163,242,0.07)',  abbr: 'FA'  },
  appService:     { border: '#7090ff', bg: 'rgba(112,144,255,0.07)', abbr: 'AS'  },
  storageAccount: { border: '#2fd5c7', bg: 'rgba(47,213,199,0.07)',  abbr: 'SA'  },
  keyVault:       { border: '#e5c07b', bg: 'rgba(229,192,123,0.07)', abbr: 'KV'  },
  appInsights:    { border: '#c678dd', bg: 'rgba(198,120,221,0.07)', abbr: 'AI'  },
};

const TYPE_LABELS: Record<ResourceType, string> = {
  appServicePlan: 'App Service Plan',
  functionApp:    'Function App',
  appService:     'App Service',
  storageAccount: 'Storage Account',
  keyVault:       'Key Vault',
  appInsights:    'App Insights',
};

const ARROW_COLORS = ['#2ea3f2', '#2fd5c7', '#c678dd', '#e5c07b', '#7090ff'];

interface NodePos { resource: Resource; x: number; y: number; }
interface Edge { fromId: string; toId: string; label: string; color: string; }
type PosMap = Record<string, { x: number; y: number }>;

function buildPath(px: PosMap, fromId: string, toId: string): string {
  const f = px[fromId]; const t = px[toId];
  if (!f || !t) return '';
  const sy = f.y + NODE_H / 2; const ty = t.y + NODE_H / 2;
  const goRight = t.x >= f.x;
  const sx = goRight ? f.x + NODE_W : f.x;
  const tx = goRight ? t.x : t.x + NODE_W;
  const dx = Math.abs(tx - sx) * 0.5;
  return `M ${sx} ${sy} C ${sx + (goRight ? dx : -dx)} ${sy}, ${tx + (goRight ? -dx : dx)} ${ty}, ${tx} ${ty}`;
}

function midpoint(px: PosMap, fromId: string, toId: string): [number, number] {
  const f = px[fromId]; const t = px[toId];
  if (!f || !t) return [0, 0];
  const goRight = t.x >= f.x;
  return [(goRight ? f.x + NODE_W : f.x) / 2 + (goRight ? t.x : t.x + NODE_W) / 2,
          (f.y + t.y) / 2 + NODE_H / 2];
}

function exportAsPng(
  nodes: NodePos[], edges: Edge[], px: PosMap,
  peIds: Set<string>, projectName: string
) {
  const PAD = 24;
  const allX = nodes.map(n => px[n.resource.id]?.x ?? 0);
  const allY = nodes.map(n => px[n.resource.id]?.y ?? 0);
  const minX = Math.min(...allX, 0) - PAD;
  const minY = Math.min(...allY, 0) - PAD;
  const maxX = Math.max(...allX.map(x => x + NODE_W), CANVAS_W) + PAD;
  const maxY = Math.max(...allY.map(y => y + NODE_H), CANVAS_MIN_H) + PAD;
  const W = maxX - minX;
  const H = maxY - minY;
  const ox = -minX; const oy = -minY;

  const arrowDefs = ARROW_COLORS.map(c =>
    `<marker id="a${c.slice(1)}" markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">` +
    `<path d="M0,0 L0,6 L7,3 z" fill="${c}" opacity="0.65"/></marker>`
  ).join('');

  const peRects = nodes.filter(n => peIds.has(n.resource.id)).map(n => {
    const p = px[n.resource.id]; if (!p) return '';
    return `<rect x="${p.x+ox-6}" y="${p.y+oy-6}" width="${NODE_W+12}" height="${NODE_H+12}" ` +
      `fill="#2ea3f210" stroke="#2ea3f2" stroke-width="1.5" stroke-dasharray="5 3" rx="10"/>` +
      `<text x="${p.x+ox+NODE_W+8}" y="${p.y+oy+10}" fill="#2ea3f2" font-size="9" ` +
      `font-family="Montserrat,sans-serif" font-weight="600" opacity="0.75">PE</text>`;
  }).join('');

  const edgePaths = edges.map(e => {
    const f = px[e.fromId]; const t = px[e.toId]; if (!f || !t) return '';
    const sy = f.y+oy+NODE_H/2; const ty2 = t.y+oy+NODE_H/2;
    const goRight = t.x >= f.x;
    const sx = (goRight ? f.x+NODE_W : f.x)+ox;
    const tx2 = (goRight ? t.x : t.x+NODE_W)+ox;
    const dx = Math.abs(tx2-sx)*0.5;
    const d = `M ${sx} ${sy} C ${sx+(goRight?dx:-dx)} ${sy}, ${tx2+(goRight?-dx:dx)} ${ty2}, ${tx2} ${ty2}`;
    const mx = (sx+tx2)/2; const my = (sy+ty2)/2;
    return `<path d="${d}" stroke="${e.color}" stroke-width="1.5" stroke-opacity="0.55" fill="none" marker-end="url(#a${e.color.slice(1)})"/>` +
      `<text x="${mx}" y="${my-5}" fill="${e.color}" font-size="9" font-family="Montserrat,sans-serif" text-anchor="middle" opacity="0.65">${e.label}</text>`;
  }).join('');

  const nodeCards = nodes.map(n => {
    const p = px[n.resource.id]; if (!p) return '';
    const c = TYPE_COLORS[n.resource.type];
    const x = p.x+ox; const y = p.y+oy;
    const name = n.resource.name.length > 14 ? n.resource.name.slice(0,13)+'…' : n.resource.name;
    return `<rect x="${x}" y="${y}" width="${NODE_W}" height="${NODE_H}" rx="8" fill="#0f2840" stroke="${c.border}" stroke-width="1"/>` +
      `<rect x="${x}" y="${y}" width="3" height="${NODE_H}" rx="2" fill="${c.border}"/>` +
      `<rect x="${x+12}" y="${y+13}" width="32" height="32" rx="4" fill="${c.border}" opacity="0.12"/>` +
      `<text x="${x+28}" y="${y+33}" text-anchor="middle" font-size="10" font-weight="700" fill="${c.border}" font-family="Montserrat,sans-serif">${c.abbr}</text>` +
      `<text x="${x+52}" y="${y+27}" font-size="11" font-weight="600" fill="#f3f4f6" font-family="Montserrat,sans-serif">${name}</text>` +
      `<text x="${x+52}" y="${y+43}" font-size="9" fill="${c.border}" font-family="Montserrat,sans-serif" opacity="0.7">${TYPE_LABELS[n.resource.type]}</text>`;
  }).join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">` +
    `<rect width="100%" height="100%" fill="#071525"/>` +
    `<defs>${arrowDefs}</defs>` +
    `${peRects}${edgePaths}${nodeCards}</svg>`;

  const blob = new Blob([svg], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#071525'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(img, 0, 0);
    URL.revokeObjectURL(url);
    const a = document.createElement('a');
    a.download = `${projectName || 'infra'}-architecture.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
  };
  img.src = url;
}

export function DiagramPanel() {
  const { state, updateDiagramPositions } = useStore();
  const { project } = state;
  const { resources, enableNetworking } = project;

  // Computed base layout
  const { nodes, edges, basePositions, canvasHeight, peIds } = useMemo(() => {
    const colCounts = [0, 0, 0, 0];
    const nodeList: NodePos[] = [];
    const byId = new Map<string, NodePos>();

    for (const resource of resources) {
      const col = TYPE_COL[resource.type] ?? 1;
      const row = colCounts[col]++;
      const pos: NodePos = { resource, x: COL_X[col], y: PADDING_Y + row * (NODE_H + ROW_GAP) };
      nodeList.push(pos);
      byId.set(resource.id, pos);
    }

    const canvasH = Math.max(
      CANVAS_MIN_H,
      Math.max(...colCounts, 1) * (NODE_H + ROW_GAP) - ROW_GAP + PADDING_Y * 2
    );

    const firstOfType = new Map<ResourceType, NodePos>();
    for (const n of nodeList) if (!firstOfType.has(n.resource.type)) firstOfType.set(n.resource.type, n);

    const edgeList: Edge[] = [];
    const edgeSet = new Set<string>();
    function pushEdge(from: NodePos, to: NodePos, label: string) {
      const key = `${from.resource.id}→${to.resource.id}`;
      if (edgeSet.has(key) || from === to) return;
      edgeSet.add(key);
      edgeList.push({ fromId: from.resource.id, toId: to.resource.id, label, color: TYPE_COLORS[to.resource.type]?.border ?? '#4a7090' });
    }

    for (const node of nodeList) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = node.resource.config as any;
      function resolve(refId: string | undefined, fallback: ResourceType) {
        return refId ? byId.get(refId) : firstOfType.get(fallback);
      }
      if (node.resource.type === 'functionApp') {
        const plan = cfg.sharedPlanRef ? byId.get(cfg.sharedPlanRef) : undefined;
        const storage = resolve(cfg.storageAccountRef, 'storageAccount');
        const ai = resolve(cfg.appInsightsRef, 'appInsights');
        if (plan) pushEdge(node, plan, 'plan');
        if (storage) pushEdge(node, storage, 'storage');
        if (ai) pushEdge(node, ai, 'monitor');
      } else if (node.resource.type === 'appService') {
        const plan = cfg.sharedPlanRef ? byId.get(cfg.sharedPlanRef) : undefined;
        const ai = resolve(cfg.appInsightsRef, 'appInsights');
        if (plan) pushEdge(node, plan, 'plan');
        if (ai) pushEdge(node, ai, 'monitor');
      } else if (node.resource.type === 'keyVault') {
        (cfg.accessPolicies as string[] ?? []).forEach((id: string) => {
          const source = byId.get(id);
          if (source) pushEdge(source, node, 'secrets');
        });
        const diagStorage = cfg.diagnosticStorageAccountRef ? byId.get(cfg.diagnosticStorageAccountRef) : undefined;
        const diagWorkspace = cfg.diagnosticWorkspaceRef ? byId.get(cfg.diagnosticWorkspaceRef) : undefined;
        if (diagStorage) pushEdge(node, diagStorage, 'diag');
        if (diagWorkspace) pushEdge(node, diagWorkspace, 'diag');
      }
    }

    const base: PosMap = {};
    for (const n of nodeList) base[n.resource.id] = { x: n.x, y: n.y };

    const peIdSet = new Set(
      enableNetworking
        ? nodeList.filter(n => (n.resource.config as any).enablePrivateEndpoint === true).map(n => n.resource.id)
        : []
    );

    return { nodes: nodeList, edges: edgeList, basePositions: base, canvasHeight: canvasH, peIds: peIdSet };
  }, [resources, enableNetworking]);

  // Position overrides (dragged positions)
  const [posOverrides, setPosOverrides] = useState<PosMap>({});

  // Track previous base positions to freeze existing nodes when new ones are added
  // IMPORTANT: this effect must come BEFORE the freeze effect so it captures old values
  const prevBaseRef = useRef<PosMap>({});

  // When resources change: freeze existing nodes at their current position, keep new ones at basePositions
  useEffect(() => {
    setPosOverrides(prev => {
      const next: PosMap = {};
      for (const resource of resources) {
        if (prev[resource.id]) {
          next[resource.id] = prev[resource.id]; // keep dragged
        } else if (prevBaseRef.current[resource.id]) {
          next[resource.id] = prevBaseRef.current[resource.id]; // freeze auto-position
        }
        // new resource → no override → uses basePositions
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources]);

  // Capture base positions AFTER the freeze effect (runs after every render)
  useEffect(() => {
    prevBaseRef.current = basePositions;
  });

  // Init from saved project diagramPositions when a project is loaded
  const internalUpdate = useRef(false);
  useEffect(() => {
    if (internalUpdate.current) { internalUpdate.current = false; return; }
    if (project.diagramPositions && Object.keys(project.diagramPositions).length > 0) {
      setPosOverrides({ ...project.diagramPositions });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.diagramPositions]);

  // Merged positions: base + overrides
  const positions: PosMap = { ...basePositions, ...posOverrides };

  // Keep a live ref to positions for reading in drag callbacks
  const positionsRef = useRef<PosMap>(positions);
  positionsRef.current = positions;

  // Drag
  const dragging = useRef<string | null>(null);
  const dragStart = useRef({ mx: 0, my: 0, nx: 0, ny: 0 });

  function handleNodeMouseDown(e: React.MouseEvent, id: string) {
    e.preventDefault();
    const pos = positionsRef.current[id];
    dragging.current = id;
    dragStart.current = { mx: e.clientX, my: e.clientY, nx: pos.x, ny: pos.y };

    function onMove(ev: MouseEvent) {
      if (!dragging.current) return;
      setPosOverrides(prev => ({
        ...prev,
        [dragging.current!]: {
          x: dragStart.current.nx + ev.clientX - dragStart.current.mx,
          y: dragStart.current.ny + ev.clientY - dragStart.current.my,
        },
      }));
    }

    function onUp() {
      if (dragging.current) {
        internalUpdate.current = true;
        updateDiagramPositions(positionsRef.current);
      }
      dragging.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  if (resources.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-14 h-14 rounded-xl border-2 border-dashed border-[#1a3a52] flex items-center justify-center mb-3">
          <span className="text-2xl">🔷</span>
        </div>
        <div className="text-sm text-gray-500 font-medium">No resources to diagram</div>
        <div className="text-xs text-gray-600 mt-1">Add resources to see the architecture diagram.</div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-5 bg-[#071525]">
      {/* Column headers */}
      <div className="relative mb-1" style={{ width: CANVAS_W }}>
        {(['Plans', 'Compute', 'Data', 'Monitoring'] as const).map((label, i) => (
          <div key={label} className="absolute text-xs font-medium text-[#4a7090] uppercase tracking-widest"
            style={{ left: COL_X[i], width: NODE_W, textAlign: 'center', top: 0 }}>
            {label}
          </div>
        ))}
        <div style={{ height: 20 }} />
      </div>

      {/* Canvas */}
      <div className="relative" style={{ width: CANVAS_W, height: canvasHeight }}>
        <svg className="absolute inset-0 pointer-events-none" width={CANVAS_W} height={canvasHeight} style={{ overflow: 'visible' }}>
          <defs>
            {ARROW_COLORS.map(color => (
              <marker key={color} id={`arr-${color.slice(1)}`} markerWidth="7" markerHeight="7" refX="6" refY="3" orient="auto">
                <path d="M0,0 L0,6 L7,3 z" fill={color} opacity="0.65" />
              </marker>
            ))}
          </defs>

          {/* PE indicators */}
          {nodes.filter(n => peIds.has(n.resource.id)).map(n => {
            const pos = positions[n.resource.id];
            return (
              <g key={`pe-${n.resource.id}`}>
                <rect x={pos.x-6} y={pos.y-6} width={NODE_W+12} height={NODE_H+12}
                  fill="rgba(46,163,242,0.05)" stroke="#2ea3f2" strokeWidth="1.5" strokeDasharray="5 3" rx="10" />
                <text x={pos.x+NODE_W+8} y={pos.y+10} fill="#2ea3f2" fontSize="9"
                  fontFamily="Montserrat, sans-serif" fontWeight="600" opacity="0.75">PE</text>
              </g>
            );
          })}

          {/* Edges */}
          {edges.map((edge, i) => {
            const [mx, my] = midpoint(positions, edge.fromId, edge.toId);
            return (
              <g key={i}>
                <path d={buildPath(positions, edge.fromId, edge.toId)} stroke={edge.color}
                  strokeWidth="1.5" strokeOpacity="0.55" fill="none"
                  markerEnd={`url(#arr-${edge.color.slice(1)})`} />
                <text x={mx} y={my-5} fill={edge.color} fontSize="9"
                  fontFamily="Montserrat, sans-serif" textAnchor="middle" opacity="0.65">
                  {edge.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Node cards */}
        {nodes.map(node => {
          const c = TYPE_COLORS[node.resource.type];
          const pos = positions[node.resource.id];
          return (
            <div key={node.resource.id}
              className="absolute rounded-lg flex items-center gap-2.5 px-3 select-none"
              style={{
                left: pos.x, top: pos.y, width: NODE_W, height: NODE_H,
                backgroundColor: c.bg,
                border: `1px solid ${c.border}`,
                borderLeft: `3px solid ${c.border}`,
                cursor: 'grab',
                zIndex: dragging.current === node.resource.id ? 10 : 1,
              }}
              onMouseDown={e => handleNodeMouseDown(e, node.resource.id)}
            >
              <div className="shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: `${c.border}18`, color: c.border }}>
                {c.abbr}
              </div>
              <div className="min-w-0">
                <div className="text-white text-xs font-semibold truncate" style={{ maxWidth: 100 }} title={node.resource.name}>
                  {node.resource.name}
                </div>
                <div className="text-xs mt-0.5 truncate" style={{ color: c.border, opacity: 0.7, maxWidth: 100 }}>
                  {TYPE_LABELS[node.resource.type]}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend + export */}
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#0b3c5d] pt-4 items-center">
        {(Object.entries(TYPE_COLORS) as [ResourceType, (typeof TYPE_COLORS)[ResourceType]][])
          .filter(([type]) => resources.some(r => r.type === type))
          .map(([type, c]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.border }} />
              <span className="text-xs text-gray-500">{TYPE_LABELS[type]}</span>
            </div>
          ))}
        {peIds.size > 0 && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm border border-dashed border-[#2ea3f2]" />
            <span className="text-xs text-gray-500">Private Endpoint</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-3">
          <span className="text-xs text-[#4a7090] italic">drag to rearrange</span>
          <button
            onClick={() => exportAsPng(nodes, edges, positions, peIds, project.projectName)}
            className="flex items-center gap-1.5 text-xs bg-[#0f2840] hover:bg-[#1a3a52] border border-[#1a3a52] text-gray-300 px-2.5 py-1 rounded-md transition-colors"
          >
            <ImageDown size={12} />
            Export PNG
          </button>
        </div>
      </div>
    </div>
  );
}
