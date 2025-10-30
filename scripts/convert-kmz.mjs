// Convert all public/kml/*.kmz into .kml and generate public/kml/index.json
import fs from 'fs/promises';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const AdmZip = require('adm-zip');

function inferMetaFromName(name) {
  const lower = name.toLowerCase();
  let state = undefined;
  if (/(^|[^a-z])pa([^a-z]|$)/.test(lower) || lower.includes('pennsylvania')) state = 'PA';
  if (/(^|[^a-z])nj([^a-z]|$)/.test(lower) || lower.includes('new-jersey') || lower.includes('newjersey')) state = 'NJ';
  let kind;
  // c_1000 or .c_1000 or c1000 = Very Twisty
  if (/c[._-]?1000/.test(lower)) kind = 'twisty';
  // c_300 or .c_300 or c300 = Moderately Twisty/Curvy
  else if (/c[._-]?300/.test(lower)) kind = 'curvy';
  else if (lower.includes('twisty')) kind = 'twisty';
  else if (lower.includes('curvy')) kind = 'curvy';
  return { state, kind };
}

async function main() {
  const root = process.cwd();
  const kmlDir = path.join(root, 'public', 'kml');
  try { await fs.mkdir(kmlDir, { recursive: true }); } catch {}
  const entries = await fs.readdir(kmlDir).catch(() => []);
  // Convert KMZ to KML
  for (const file of entries) {
    if (!file.toLowerCase().endsWith('.kmz')) continue;
    const kmzPath = path.join(kmlDir, file);
    const base = file.replace(/\.kmz$/i, '');
    const outKml = path.join(kmlDir, `${base}.kml`);
    try {
      const zip = new AdmZip(kmzPath);
      const kmlEntry = zip.getEntries().find((e) => e.entryName.toLowerCase().endsWith('.kml'));
      if (!kmlEntry) {
        console.warn(`[KMZ] No .kml inside ${file}`);
        continue;
      }
      const content = kmlEntry.getData();
      await fs.writeFile(outKml, content);
      console.log(`[KMZ] Converted ${file} -> ${path.basename(outKml)}`);
    } catch (e) {
      console.warn(`[KMZ] Failed to convert ${file}:`, e.message || e);
    }
  }
  // Build index.json of KML files
  const after = await fs.readdir(kmlDir).catch(() => []);
  const kmlFiles = after.filter((f) => f.toLowerCase().endsWith('.kml'));
  const items = kmlFiles.map((f) => {
    const { state, kind } = inferMetaFromName(f.replace(/\.kml$/i, ''));
    return {
      id: `${(state || 'XX')}_${(kind || 'layer')}_${f}`,
      state: state || 'PA',
      kind: (kind === 'curvy' || kind === 'twisty') ? kind : 'curvy',
      url: `/kml/${f}`,
      enabled: false,
    };
  });
  const out = path.join(kmlDir, 'index.json');
  await fs.writeFile(out, JSON.stringify(items, null, 2));
  console.log(`[KML] Wrote index with ${items.length} entries to public/kml/index.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


