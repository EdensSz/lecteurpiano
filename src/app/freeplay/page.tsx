'use client'

import { useState } from 'react';
import TransportBar from '@/components/TransportBar';
import * as Tone from 'tone';

export default function FreeplayPage() {
  const [player, setPlayer] = useState<Tone.Player | null>(null);
  
  const handleMidiImport = (file: File) => {
    // Handle MIDI file import logic here
    console.log('MIDI file imported:', file.name);
  };

  return (
    <div>
      <TransportBar 
        player={player} 
        onImportMidi={handleMidiImport} 
      />
      {/* Rest of your freeplay page content */}
      <div style={{ marginTop: '60px', padding: '20px' }}>
        <h1>Freeplay Mode</h1>
        {/* Your freeplay content here */}
      </div>
    </div>
  );
}