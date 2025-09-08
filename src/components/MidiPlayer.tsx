'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Song } from '@/types'
import * as Tone from 'tone'

// Simple MIDI Player class (même que avant)
class SimpleMidiPlayer {
  private song: Song | null = null
  private isPlaying = false  
  private currentTime = 0
  private synth: any = null
  private scheduledNotes: any[] = []
  private rafId: number | null = null

  setSong(song: Song) {
    this.song = song
    this.stop()
  }

  setSynth(synth: any) {
    this.synth = synth
  }

  play() {
    if (!this.song || this.isPlaying) return
    this.isPlaying = true
    this.startPlayback()
  }

  pause() {
    this.isPlaying = false
    this.stopScheduling()
  }

  stop() {
    this.isPlaying = false
    this.currentTime = 0
    this.stopScheduling()
  }

  restart() {
    this.seekTo(0)
    this.play()
  }

  seekTo(time: number) {
    this.currentTime = Math.max(0, Math.min(time, this.getDuration()))
    this.stopAllNotes()
    if (this.isPlaying) {
      this.stopScheduling()
      this.startPlayback()
    }
  }

  getTime() {
    return this.currentTime
  }

  isPlayingState() {
    return this.isPlaying
  }

  getDuration() {
    return this.song?.duration || 0
  }

  private startPlayback() {
    if (!this.song || !this.synth) return

    const startTime = performance.now()
    const startCurrentTime = this.currentTime

    const playLoop = () => {
      if (!this.isPlaying) return

      const elapsed = (performance.now() - startTime) / 1000
      this.currentTime = startCurrentTime + elapsed

      const tolerance = 0.1
      this.song!.notes.forEach(note => {
        if (note.time >= this.currentTime - tolerance && 
            note.time <= this.currentTime + tolerance &&
            !this.scheduledNotes.includes(note)) {
          
          this.scheduledNotes.push(note)
          this.synth.playNote(note.midiNote, note.velocity)
          
          setTimeout(() => {
            this.synth.stopNote(note.midiNote)
            this.scheduledNotes = this.scheduledNotes.filter(n => n !== note)
          }, note.duration * 1000)
        }
      })

      if (this.currentTime >= this.getDuration()) {
        this.stop()
        return
      }

      this.rafId = requestAnimationFrame(playLoop)
    }

    playLoop()
  }

  private stopScheduling() {
    if (this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.stopAllNotes()
  }

  private stopAllNotes() {
    this.scheduledNotes.forEach(note => {
      this.synth?.stopNote(note.midiNote)
    })
    this.scheduledNotes = []
  }
}

interface MidiPlayerProps {
  synth: any
  onSongLoad: (song: Song) => void
}

export default function MidiPlayer({ synth, onSongLoad }: MidiPlayerProps) {
  const [midiPlayer] = useState(() => new SimpleMidiPlayer())
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragTime, setDragTime] = useState(0)
  const [isMounted, setIsMounted] = useState(false)
  
  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  // Fix hydration
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Update synth in midi player
  useEffect(() => {
    if (synth) {
      midiPlayer.setSynth(synth)
    }
  }, [synth, midiPlayer])

  // Update time
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isPlaying && currentSong && isMounted) {
      interval = setInterval(() => {
        const time = midiPlayer.getTime()
        setCurrentTime(time)
        
        if (time >= duration) {
          setIsPlaying(false)
          midiPlayer.stop()
        }
      }, 50)
    }
    return () => clearInterval(interval)
  }, [isPlaying, currentSong, duration, midiPlayer, isMounted])

  // Load MIDI file
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const { Midi } = await import('@tonejs/midi')
      const arrayBuffer = await file.arrayBuffer()
      const midi = new Midi(arrayBuffer)
      
      const song: Song = {
        bpms: [{ time: 0, bpm: 120 }],
        tracks: { 1: { instrument: 'piano' } },
        measures: [],
        notes: [],
        duration: midi.duration,
        items: [],
        keySignature: 'C',
      }

      midi.tracks.forEach((track) => {
        track.notes.forEach(note => {
          song.notes.push({
            midiNote: note.midi,
            velocity: Math.round(note.velocity * 127),
            type: 'note',
            track: 1,
            time: note.time,
            duration: note.duration,
            measure: 0,
          })
        })
      })

      song.notes.sort((a, b) => a.time - b.time)
      song.items = song.notes
      
      setCurrentSong(song)
      setDuration(song.duration)
      midiPlayer.setSong(song)
      setCurrentTime(0)
      onSongLoad(song)
      
      console.log('MIDI loaded:', song.notes.length, 'notes')
    } catch (error) {
      console.error('Error loading MIDI:', error)
      alert('Error loading MIDI file')
    }
  }

  const handlePlay = () => {
    if (!currentSong) return
    
    if (isPlaying) {
      midiPlayer.pause()
      setIsPlaying(false)
    } else {
      midiPlayer.play()
      setIsPlaying(true)
    }
  }

  const handleStop = () => {
    midiPlayer.stop()
    setIsPlaying(false)
    setCurrentTime(0)
  }

  const handleRestart = () => {
    midiPlayer.restart()
    setIsPlaying(true)
    setCurrentTime(0)
  }

  const calculateTimeFromPosition = (clientX: number) => {
    if (!progressBarRef.current || duration === 0) return 0
    
    const rect = progressBarRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return percentage * duration
  }

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging) return
    
    const newTime = calculateTimeFromPosition(event.clientX)
    setCurrentTime(newTime)
    midiPlayer.seekTo(newTime)
  }

  const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragging(true)
    
    const newTime = calculateTimeFromPosition(event.clientX)
    setDragTime(newTime)
    setCurrentTime(newTime)

    const handleMouseMove = (e: MouseEvent) => {
      const moveTime = calculateTimeFromPosition(e.clientX)
      setDragTime(moveTime)
      setCurrentTime(moveTime)
    }
    
    const handleMouseUp = () => {
      setIsDragging(false)
      midiPlayer.seekTo(dragTime)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Pas de rendu côté serveur
  if (!isMounted) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        background: '#1a1a1a',
        padding: '10px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        zIndex: 1000,
        borderBottom: '1px solid #333'
      }}>
        <span style={{ color: '#ccc' }}>Loading...</span>
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      background: '#1a1a1a',
      padding: '10px 20px',
      display: 'flex',
      alignItems: 'center',
      gap: '15px',
      zIndex: 1000,
      borderBottom: '1px solid #333'
    }}>
      {/* Import MIDI */}
      <input
        type="file"
        accept=".mid,.midi"
        onChange={handleFileUpload}
        ref={fileInputRef}
        style={{ display: 'none' }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          background: '#4CAF50',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px'
        }}
      >
        📁 Import MIDI
      </button>

      {/* Player Controls */}
      {currentSong && (
        <>
          <button
            onClick={handlePlay}
            style={{
              background: isPlaying ? '#f44336' : '#2196F3',
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
              background: '#666',
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
          <button
            onClick={handleRestart}
            style={{
              background: '#FF9800',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            ⏮️ Restart
          </button>

          {/* Progress Bar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flex: 1,
            maxWidth: '400px'
          }}>
            <span style={{ color: '#ccc', fontSize: '12px', minWidth: '40px' }}>
              {formatTime(currentTime)}
            </span>
            <div 
              ref={progressBarRef}
              onClick={handleProgressClick}
              onMouseDown={handleMouseDown}
              style={{
                flex: 1,
                height: '20px',
                background: '#333',
                borderRadius: '10px',
                cursor: 'pointer',
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                padding: '0 4px'
              }}
            >
              <div style={{
                width: '100%',
                height: '6px',
                background: '#555',
                borderRadius: '3px',
                position: 'relative'
              }}>
                <div style={{
                  height: '100%',
                  background: isDragging ? '#1976D2' : '#2196F3',
                  width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
                  borderRadius: '3px',
                  position: 'relative',
                  transition: 'none'
                }}>
                  <div style={{
                    position: 'absolute',
                    right: '-8px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    width: '16px',
                    height: '16px',
                    background: isDragging ? '#1976D2' : '#2196F3',
                    borderRadius: '50%',
                    cursor: 'pointer',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    border: '2px solid white'
                  }} />
                </div>
              </div>
            </div>
            <span style={{ color: '#ccc', fontSize: '12px', minWidth: '40px' }}>
              {formatTime(duration)}
            </span>
          </div>
        </>
      )}

      {/* Status */}
      <span style={{ color: '#ccc', fontSize: '12px' }}>
        {currentSong ? `🎵 MIDI loaded (${currentSong.notes.length} notes)` : 'Import MIDI or play piano below'}
      </span>
    </div>
  )
}
