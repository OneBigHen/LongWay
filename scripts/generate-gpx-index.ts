/*
  Simple helper to scan public/gpx/*.gpx and write public/gpx/index.json
  Usage: ts-node scripts/generate-gpx-index.ts (or node after ts->js transpile)
*/
import { promises as fs } from 'fs';
import path from 'path';

type GpxMeta = {
  file: string;
  name: string;
  region?: string;
  miles?: number;
  difficulty?: 'easy' | 'moderate' | 'hard';
  tags?: string[];
};

async function main() {
  const root = process.cwd();
  const gpxDir = path.join(root, 'public', 'gpx');
  const files = await fs.readdir(gpxDir).catch(() => [] as string[]);
  const gpxFiles = files.filter((f) => f.toLowerCase().endsWith('.gpx'));
  const items: GpxMeta[] = gpxFiles.map((file) => {
    const base = file.replace(/\.gpx$/i, '').replace(/[_-]/g, ' ');
    const name = base
      .split(' ')
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' ');
    let region: string | undefined = undefined;
    if (/\bpa\b/i.test(file)) region = 'PA';
    else if (/\bnj\b/i.test(file)) region = 'NJ';
    return { file, name, region };
  });
  const outPath = path.join(gpxDir, 'index.json');
  await fs.writeFile(outPath, JSON.stringify(items, null, 2));
  console.log(`Wrote ${items.length} entries to ${path.relative(root, outPath)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


