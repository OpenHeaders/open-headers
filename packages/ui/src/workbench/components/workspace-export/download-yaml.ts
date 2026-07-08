/**
 * Trigger a browser download of a workspace-export YAML envelope. The
 * double extension (`.openheaders.yaml`) keeps editor syntax-highlighting
 * while making the file recognizable to the importer's drag-drop handler.
 */
export function downloadYaml(filename: string, yaml: string): void {
  const blob = new Blob([yaml], { type: 'application/yaml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1_000);
  }
}
