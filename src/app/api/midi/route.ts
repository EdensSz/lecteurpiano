// src/app/api/midi/route.ts
import fs from 'fs';
import path from 'path';
import { SongMetadata } from '@/types';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';



const songManifest: SongMetadata[] = require('@/manifest.json');
const map: Map<string, SongMetadata> = new Map(songManifest.map((s: SongMetadata) => [s.id, s]));

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const { id, source } = Object.fromEntries(searchParams);
  const supportedSources = new Set(['builtin', 'midishare']);

  // Validation des paramètres
  if (!id || !source || Array.isArray(id) || Array.isArray(source) || !supportedSources.has(source)) {
    return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
  }

  // Gestion Midishare
  if (source === 'midishare') {
    try {
      const response = await fetch(`https://assets.midishare.dev/scores/${id}/${id}.mid`);
      if (!response.ok) throw new Error(response.statusText);

      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'audio/midi',
          'Content-Disposition': `attachment; filename="${id}.mid"`,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  // Gestion des fichiers locaux (builtin)
  const song = map.get(id);
  if (!song?.file) {
    return NextResponse.json({ error: 'MIDI not found' }, { status: 404 });
  }

  // Sécurise le chemin
  const safePath = path.join('public', path.normalize(song.file).replace(/^(\.\.(\/|\\|$))+/, ''));
  if (!safePath.startsWith('public/')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Développement : lit le fichier localement
  if (process.env.NODE_ENV === 'development') {
    try {
      const body = fs.readFileSync(safePath);
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'audio/midi',
          'Content-Disposition': `attachment; filename="${path.basename(safePath)}"`,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }

  // Production : utilise fetch standard
  else {
    try {
      const host = process.env.VERCEL_URL || 'localhost:3000';
      const fileUrl = `https://${host}/${song.file}`;
      const response = await fetch(fileUrl);
      if (!response.ok) throw new Error(response.statusText);

      const buffer = await response.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'audio/midi',
          'Content-Disposition': `attachment; filename="${path.basename(song.file)}"`,
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      );
    }
  }
}
