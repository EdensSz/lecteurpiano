'use client'
import React, { useState } from 'react';
import * as Tone from 'tone';

interface TransportBarProps {
  player?: any;
  onImportMidi?: (file: File) => void;
}

const TransportBar: React.FC<TransportBarProps> = ({ player, onImportMidi }) => {
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = async () => {
    if (Tone.context.state !== 'running') {
      await Tone.start();
    }
    if (isPlaying) {
      Tone.Transport.pause();
      player?.pause();
    } else {
      Tone.Transport.start();
      player?.start();
    }
    setIsPlaying(!isPlaying);
  };

  const handleStop = () => {
    Tone.Transport.stop();
    player?.stop();
    setIsPlaying(false);
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.name.endsWith('.mid')) {
      onImportMidi?.(file);
    } else {
      alert('Please select a valid MIDI file (.mid)');
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      height: '60px',
      backgroundColor: '#1a1a1a',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      padding: '0 20px',
      zIndex: 1000,
      borderBottom: '1px solid #333'
    }}>
      <label style={{
        backgroundColor: '#4CAF50',
        color: 'white',
        padding: '8px 16px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '14px'
      }}>
        📁 Import MIDI
        <input
          type="file"
          accept=".mid,.midi"
          onChange={handleFileImport}
          style={{ display: 'none' }}
        />
      </label>
      
      <button
        onClick={togglePlay}
        style={{
          backgroundColor: isPlaying ? '#f44336' : '#2196F3',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        {isPlaying ? '⏸️ Pause' : '▶️ Play'}
      </button>
      
      <button
        onClick={handleStop}
        style={{
          backgroundColor: '#999',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        ⏹️ Stop
      </button>
    </div>
  );
};

export default TransportBar;