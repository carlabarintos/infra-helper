export function downloadFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.split('/').pop() || filename;
  a.click();
  URL.revokeObjectURL(url);
}

export async function downloadAsZip(
  files: Record<string, string>,
  zipName: string
): Promise<void> {
  const JSZip = (await import('jszip')).default;
  const zip = new JSZip();

  // Explicitly create all unique folder entries so extraction tools preserve structure
  const folders = new Set<string>();
  for (const filepath of Object.keys(files)) {
    const parts = filepath.split('/');
    for (let i = 1; i < parts.length; i++) {
      folders.add(parts.slice(0, i).join('/') + '/');
    }
  }
  folders.forEach((folder) => zip.folder(folder));

  for (const [filepath, content] of Object.entries(files)) {
    zip.file(filepath, content);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = zipName;
  a.click();
  URL.revokeObjectURL(url);
}

export function copyToClipboard(text: string): Promise<void> {
  return navigator.clipboard.writeText(text);
}
