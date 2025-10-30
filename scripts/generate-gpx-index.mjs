// Generate public/gpx/index.json based on GPX files
import fs from 'fs/promises';
import path from 'path';

// Calculate total distance in meters along a path using Haversine formula
function calculatePathDistance(points) {
  if (points.length < 2) return 0;
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const R = 6371000; // Earth radius in meters
    const dLat = (p2.lat - p1.lat) * Math.PI / 180;
    const dLng = (p2.lng - p1.lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    total += R * c;
  }
  return total;
}

// Parse GPX file and extract coordinates
function parseGpx(xmlText) {
  const pts = [];
  const trkptMatches = xmlText.matchAll(/<trkpt[^>]*lat=["']([^"']+)["'][^>]*lon=["']([^"']+)["']/gi);
  for (const match of trkptMatches) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng)) {
      pts.push({ lat, lng });
    }
  }
  return pts;
}

async function main() {
  const root = process.cwd();
  const gpxDir = path.join(root, 'public', 'gpx');
  try { await fs.mkdir(gpxDir, { recursive: true }); } catch {}
  const files = await fs.readdir(gpxDir).catch(() => []);
  const gpxFiles = files.filter((f) => f.toLowerCase().endsWith('.gpx'));
  
  const items = [];
  
  for (const file of gpxFiles) {
    const base = file.replace(/\.gpx$/i, '').replace(/[_-]/g, ' ');
    const name = base.split(' ').map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s)).join(' ');
    let region;
    if (/\bpa\b/i.test(file)) region = 'PA';
    else if (/\bnj\b/i.test(file)) region = 'NJ';
    
    // Parse GPX file to get distance
    let miles = undefined;
    let estimatedMinutes = undefined;
    try {
      const filePath = path.join(gpxDir, file);
      const xmlText = await fs.readFile(filePath, 'utf-8');
      const pts = parseGpx(xmlText);
      if (pts.length >= 2) {
        const distanceMeters = calculatePathDistance(pts);
        const km = distanceMeters / 1000;
        miles = Math.round((km * 0.621371) * 10) / 10; // Round to 1 decimal
        // Calculate estimated time at 45 mph average
        const hours = miles / 45;
        estimatedMinutes = Math.round(hours * 60);
      }
    } catch (err) {
      console.warn(`[GPX] Could not parse ${file}:`, err.message);
    }
    
    items.push({ file, name, region, miles, estimatedMinutes });
  }
  
  const outPath = path.join(gpxDir, 'index.json');
  await fs.writeFile(outPath, JSON.stringify(items, null, 2));
  console.log(`[GPX] Wrote ${items.length} entries to public/gpx/index.json`);
  console.log(`[GPX] Parsed distance/time for ${items.filter(i => i.miles !== undefined).length} routes`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


