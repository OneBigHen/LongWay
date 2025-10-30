import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export async function GET(request: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: pathArray } = await params;
  const filePath = pathArray.join('/');
  const fullPath = path.join(process.cwd(), 'public', 'kml', filePath);

  try {
    // Security: ensure the path is within public/kml
    const normalized = path.normalize(fullPath);
    const publicKml = path.join(process.cwd(), 'public', 'kml');
    if (!normalized.startsWith(publicKml)) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    const content = await fs.readFile(normalized, 'utf-8');
    return new NextResponse(content, {
      headers: {
        'Content-Type': 'application/vnd.google-earth.kml+xml',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[KML API] Error serving file:', filePath, error);
    return new NextResponse('Not Found', { status: 404 });
  }
}

