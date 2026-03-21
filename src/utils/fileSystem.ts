import { ProjectConfig } from '../types/resources';

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      mode?: 'read' | 'readwrite';
      startIn?: string;
    }) => Promise<FileSystemDirectoryHandle>;
  }
}

export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
}

export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  if (!window.showDirectoryPicker) return null;
  try {
    return await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch {
    return null; // user cancelled
  }
}

export async function readProjectFromFolder(
  dir: FileSystemDirectoryHandle
): Promise<ProjectConfig | null> {
  try {
    const fileHandle = await dir.getFileHandle('infrahelper.json');
    const file = await (fileHandle as any).getFile();
    const text = await file.text();
    const parsed = JSON.parse(text);
    return (parsed.project ?? parsed) as ProjectConfig;
  } catch {
    return null;
  }
}

export async function saveFilesToFolder(
  dir: FileSystemDirectoryHandle,
  files: Record<string, string>
): Promise<void> {
  for (const [filepath, content] of Object.entries(files)) {
    const parts = filepath.split('/');
    let currentDir: FileSystemDirectoryHandle = dir;
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await (currentDir as any).getDirectoryHandle(parts[i], { create: true });
    }
    const filename = parts[parts.length - 1];
    const fileHandle = await (currentDir as any).getFileHandle(filename, { create: true });
    const writable = await (fileHandle as any).createWritable();
    await writable.write(content);
    await writable.close();
  }
}
