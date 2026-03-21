import { useMemo } from 'react';
import { useStore } from '../store/useStore';
import { Resource, ResourceType } from '../types/resources';

const NODE_W = 160;
const NODE_H = 62;
const ROW_GAP = 24;
const PADDING_Y = 52;
const COL_X = [40, 260, 480, 700];
const CANVAS_W = 900;

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

interface NodePos {
  resource: Resource;
  x: number;
  y: number;
  col: number;
}

interface Edge {
  from: NodePos;
  to: NodePos;
  label: string;
  color: string;
}

function buildEdgePath(from: NodePos, to: NodePos): string {
  const goRight = from.col <= to.col;
  const sx = goRight ? from.x + NODE_W : from.x;
  const sy = from.y + NODE_H / 2;
  const tx = goRight ? to.x : to.x + NODE_W;
  const ty = to.y + NODE_H / 2;
  const dx = Math.abs(tx - sx) * 0.45;
  const c1x = goRight ? sx + dx : sx - dx;
  const c2x = goRight ? tx - dx : tx + dx;
  return `M ${sx} ${sy} C ${c1x} ${sy}, ${c2x} ${ty}, ${tx} ${ty}`;
}

function edgeMidpoint(from: NodePos, to: NodePos): [number, number] {
  const goRight = from.col <= to.col;
  const sx = goRight ? from.x + NODE_W : from.x;
  const sy = from.y + NODE_H / 2;
  const tx = goRight ? to.x : to.x + NODE_W;
  const ty = to.y + NODE_H / 2;
  return [(sx + tx) / 2, (sy + ty) / 2];
}

export function DiagramPanel() {
  const { state } = useStore();
  const { project } = state;
  const { resources, enableNetworking } = project;

  const { nodes, edges, canvasHeight, vnetBox } = useMemo(() => {
    const colCounts = [0, 0, 0, 0];
    const nodeList: NodePos[] = [];
    const byName = new Map<string, NodePos>();

    for (const resource of resources) {
      const col = TYPE_COL[resource.type] ?? 1;
      const row = colCounts[col]++;
      const pos: NodePos = {
        resource,
        x: COL_X[col],
        y: PADDING_Y + row * (NODE_H + ROW_GAP),
        col,
      };
      nodeList.push(pos);
      byName.set(resource.name, pos);
    }

    const canvasH =
      Math.max(...colCounts, 1) * (NODE_H + ROW_GAP) - ROW_GAP + PADDING_Y * 2;

    const edgeList: Edge[] = [];
    for (const node of nodeList) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const cfg = node.resource.config as any;

      const addEdge = (refName: string | undefined, label: string) => {
        if (!refName) return;
        const target = byName.get(refName);
        if (!target) return;
        edgeList.push({
          from: node,
          to: target,
          label,
          color: TYPE_COLORS[target.resource.type]?.border ?? '#4a7090',
        });
      };

      if (node.resource.type === 'functionApp') {
        addEdge(cfg.sharedPlanRef, 'plan');
        addEdge(cfg.storageAccountRef, 'storage');
        addEdge(cfg.appInsightsRef, 'monitor');
      } else if (node.resource.type === 'appService') {
        addEdge(cfg.sharedPlanRef, 'plan');
        addEdge(cfg.appInsightsRef, 'monitor');
      }
    }

    let vnetBoxResult: { x: number; y: number; w: number; h: number } | null = null;
    if (enableNetworking) {
      const peNodes = nodeList.filter(
        (n) => (n.resource.config as any).enablePrivateEndpoint === true
      );
      if (peNodes.length > 0) {
        const PAD = 18;
        const minX = Math.min(...peNodes.map((n) => n.x)) - PAD;
        const minY = Math.min(...peNodes.map((n) => n.y)) - PAD;
        const maxX = Math.max(...peNodes.map((n) => n.x + NODE_W)) + PAD;
        const maxY = Math.max(...peNodes.map((n) => n.y + NODE_H)) + PAD;
        vnetBoxResult = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
      }
    }

    return { nodes: nodeList, edges: edgeList, canvasHeight: canvasH, vnetBox: vnetBoxResult };
  }, [resources, enableNetworking]);

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
          <div
            key={label}
            className="absolute text-xs font-medium text-[#4a7090] uppercase tracking-widest"
            style={{ left: COL_X[i], width: NODE_W, textAlign: 'center', top: 0 }}
          >
            {label}
          </div>
        ))}
        <div style={{ height: 20 }} />
      </div>

      {/* Canvas */}
      <div className="relative" style={{ width: CANVAS_W, height: canvasHeight }}>
        {/* SVG layer */}
        <svg
          className="absolute inset-0 pointer-events-none"
          width={CANVAS_W}
          height={canvasHeight}
          style={{ overflow: 'visible' }}
        >
          <defs>
            {ARROW_COLORS.map((color) => (
              <marker
                key={color}
                id={`arr-${color.slice(1)}`}
                markerWidth="7"
                markerHeight="7"
                refX="6"
                refY="3"
                orient="auto"
              >
                <path d="M0,0 L0,6 L7,3 z" fill={color} opacity="0.65" />
              </marker>
            ))}
          </defs>

          {/* VNet box */}
          {vnetBox && (
            <>
              <rect
                x={vnetBox.x}
                y={vnetBox.y}
                width={vnetBox.w}
                height={vnetBox.h}
                fill="rgba(46,163,242,0.04)"
                stroke="#2ea3f2"
                strokeWidth="1.5"
                strokeDasharray="6 4"
                rx="10"
              />
              <text
                x={vnetBox.x + 10}
                y={vnetBox.y - 7}
                fill="#2ea3f2"
                fontSize="11"
                fontFamily="Montserrat, sans-serif"
                fontWeight="600"
                opacity="0.8"
              >
                VNet
              </text>
            </>
          )}

          {/* Edges */}
          {edges.map((edge, i) => {
            const [mx, my] = edgeMidpoint(edge.from, edge.to);
            return (
              <g key={i}>
                <path
                  d={buildEdgePath(edge.from, edge.to)}
                  stroke={edge.color}
                  strokeWidth="1.5"
                  strokeOpacity="0.55"
                  fill="none"
                  markerEnd={`url(#arr-${edge.color.slice(1)})`}
                />
                <text
                  x={mx}
                  y={my - 5}
                  fill={edge.color}
                  fontSize="9"
                  fontFamily="Montserrat, sans-serif"
                  textAnchor="middle"
                  opacity="0.65"
                >
                  {edge.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Node cards */}
        {nodes.map((node) => {
          const c = TYPE_COLORS[node.resource.type];
          return (
            <div
              key={node.resource.id}
              className="absolute rounded-lg flex items-center gap-2.5 px-3 select-none"
              style={{
                left: node.x,
                top: node.y,
                width: NODE_W,
                height: NODE_H,
                backgroundColor: c.bg,
                border: `1px solid ${c.border}`,
                borderLeft: `3px solid ${c.border}`,
              }}
            >
              <div
                className="shrink-0 w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: `${c.border}18`, color: c.border }}
              >
                {c.abbr}
              </div>
              <div className="min-w-0">
                <div
                  className="text-white text-xs font-semibold truncate"
                  style={{ maxWidth: 100 }}
                  title={node.resource.name}
                >
                  {node.resource.name}
                </div>
                <div
                  className="text-xs mt-0.5 truncate"
                  style={{ color: c.border, opacity: 0.7, maxWidth: 100 }}
                >
                  {TYPE_LABELS[node.resource.type]}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-[#0b3c5d] pt-4">
        {(Object.entries(TYPE_COLORS) as [ResourceType, (typeof TYPE_COLORS)[ResourceType]][])
          .filter(([type]) => resources.some((r) => r.type === type))
          .map(([type, c]) => (
            <div key={type} className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: c.border }} />
              <span className="text-xs text-gray-500">{TYPE_LABELS[type]}</span>
            </div>
          ))}
        {enableNetworking && (
          <div className="flex items-center gap-1.5">
            <div className="w-2.5 h-2.5 rounded-sm border border-dashed border-[#2ea3f2]" />
            <span className="text-xs text-gray-500">VNet boundary</span>
          </div>
        )}
      </div>
    </div>
  );
}
