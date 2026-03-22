import { createContext, useContext, useReducer, ReactNode, createElement } from 'react';
import {
  Resource,
  ResourceType,
  ProjectConfig,
  DEFAULT_CONFIGS,
  ResourceConfig,
} from '../types/resources';

interface StoreState {
  project: ProjectConfig;
  selectedResourceId: string | null;
}

type Action =
  | { type: 'ADD_RESOURCE'; resourceType: ResourceType }
  | { type: 'REMOVE_RESOURCE'; id: string }
  | { type: 'UPDATE_RESOURCE'; id: string; updates: Partial<Resource> }
  | { type: 'UPDATE_RESOURCE_CONFIG'; id: string; config: Partial<ResourceConfig> }
  | { type: 'SET_PROJECT_CONFIG'; config: Partial<ProjectConfig> }
  | { type: 'SELECT_RESOURCE'; id: string | null }
  | { type: 'LOAD_PROJECT'; project: ProjectConfig }
  | { type: 'UPDATE_DIAGRAM_POSITIONS'; positions: Record<string, { x: number; y: number }> };

function generateName(type: ResourceType, existing: Resource[]): string {
  const prefixes: Record<ResourceType, string> = {
    functionApp: 'myFunc',
    appService: 'myApp',
    appServicePlan: 'myPlan',
    storageAccount: 'mystorage',
    keyVault: 'myKeyVault',
    appInsights: 'myInsights',
  };
  const prefix = prefixes[type];
  const count = existing.filter((r) => r.type === type).length + 1;
  return count === 1 ? prefix : `${prefix}${count}`;
}

function reducer(state: StoreState, action: Action): StoreState {
  switch (action.type) {
    case 'ADD_RESOURCE': {
      const newResource: Resource = {
        id: crypto.randomUUID(),
        type: action.resourceType,
        name: generateName(action.resourceType, state.project.resources),
        config: { ...DEFAULT_CONFIGS[action.resourceType] },
      };
      return {
        ...state,
        project: {
          ...state.project,
          resources: [...state.project.resources, newResource],
        },
        selectedResourceId: newResource.id,
      };
    }

    case 'REMOVE_RESOURCE': {
      return {
        ...state,
        project: {
          ...state.project,
          resources: state.project.resources.filter((r) => r.id !== action.id),
        },
        selectedResourceId:
          state.selectedResourceId === action.id ? null : state.selectedResourceId,
      };
    }

    case 'UPDATE_RESOURCE': {
      return {
        ...state,
        project: {
          ...state.project,
          resources: state.project.resources.map((r) =>
            r.id === action.id ? { ...r, ...action.updates } : r
          ),
        },
      };
    }

    case 'UPDATE_RESOURCE_CONFIG': {
      return {
        ...state,
        project: {
          ...state.project,
          resources: state.project.resources.map((r) =>
            r.id === action.id
              ? { ...r, config: { ...r.config, ...action.config } as ResourceConfig }
              : r
          ),
        },
      };
    }

    case 'SET_PROJECT_CONFIG': {
      return {
        ...state,
        project: { ...state.project, ...action.config },
      };
    }

    case 'SELECT_RESOURCE': {
      return {
        ...state,
        selectedResourceId: action.id,
      };
    }

    case 'LOAD_PROJECT': {
      return {
        ...state,
        project: action.project,
        selectedResourceId: null,
      };
    }

    case 'UPDATE_DIAGRAM_POSITIONS': {
      return {
        ...state,
        project: { ...state.project, diagramPositions: action.positions },
      };
    }

    default:
      return state;
  }
}

const initialState: StoreState = {
  project: {
    projectName: 'myproject',
    environment: 'dev',
    location: 'australiaeast',
    enableNetworking: false,
    allowedIpAddress: '',
    resourceGroupName: 'myproject-dev-rg',
    resources: [],
  },
  selectedResourceId: null,
};

interface StoreContextValue {
  state: StoreState;
  addResource: (type: ResourceType) => void;
  removeResource: (id: string) => void;
  updateResource: (id: string, updates: Partial<Resource>) => void;
  updateResourceConfig: (id: string, config: Partial<ResourceConfig>) => void;
  setProjectConfig: (config: Partial<ProjectConfig>) => void;
  selectResource: (id: string | null) => void;
  loadProject: (project: ProjectConfig) => void;
  updateDiagramPositions: (positions: Record<string, { x: number; y: number }>) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  const value: StoreContextValue = {
    state,
    addResource: (type) => dispatch({ type: 'ADD_RESOURCE', resourceType: type }),
    removeResource: (id) => dispatch({ type: 'REMOVE_RESOURCE', id }),
    updateResource: (id, updates) => dispatch({ type: 'UPDATE_RESOURCE', id, updates }),
    updateResourceConfig: (id, config) =>
      dispatch({ type: 'UPDATE_RESOURCE_CONFIG', id, config }),
    setProjectConfig: (config) => dispatch({ type: 'SET_PROJECT_CONFIG', config }),
    selectResource: (id) => dispatch({ type: 'SELECT_RESOURCE', id }),
    loadProject: (project) => dispatch({ type: 'LOAD_PROJECT', project }),
    updateDiagramPositions: (positions) =>
      dispatch({ type: 'UPDATE_DIAGRAM_POSITIONS', positions }),
  };

  return createElement(StoreContext.Provider, { value }, children);
}

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used within StoreProvider');
  return ctx;
}
