export function safeTfName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
  return /^[0-9]/.test(clean) ? `r_${clean}` : clean || 'resource';
}

export function safeTfStorageName(name: string): string {
  const clean = name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const trimmed = clean.length > 24 ? clean.substring(0, 24) : clean;
  return trimmed || 'storage';
}

export function safeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-]/g, '-').toLowerCase();
}
