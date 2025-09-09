'use client'

import { MidiModal } from '@/app/play/components/MidiModal'
import midiState, { useRecordMidi } from '@/features/midi'
import { SongVisualizer } from '@/features/SongVisualization'
import { InstrumentName, useSynth } from '@/features/synth'
import { useSingleton } from '@/hooks'
import { MidiStateEvent, Song, SongConfig } from '@/types'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import RecordingModal from '@/app/freeplay/components/RecordingModal'
import TopBar from '@/app/freeplay/components/TopBar'
import FreePlayer from '@/app/freeplay/utils/freePlayer'
import * as Tone from 'tone'

// ===================== Player simple + gestion de boucle =====================
class SimpleMidiPlayer {
  private song: Song | null = null
  private isPlaying = false
  private currentTime = 0
  private synth: any = null
  private rafId: number | null = null
  private currentNoteIndex = 0
  private playbackRate = 1

  // Loop state
  private loopEnabled = false
  private loopStart = 0
  private loopEnd = Infinity

  setTempoFactor(factor: number) {
    this.playbackRate = factor
  }

  setSong(song: Song) {
    this.song = song
    this.stop()
    // Réinitialise la boucle au morceau
    this.loopStart = 0
    this.loopEnd = song.duration ?? Infinity
  }

  setSynth(synth: any) {
    this.synth = synth
  }

  // API boucle
  setLoop(start: number, end: number) {
    if (!this.song) return
    const dur = this.getDuration()
    this.loopStart = Math.max(0, Math.min(start, dur))
    // Laisse une marge min pour éviter start==end
    this.loopEnd = Math.max(this.loopStart + 0.05, Math.min(end, dur))
    if (this.currentTime < this.loopStart || this.currentTime > this.loopEnd) {
      this.seekTo(this.loopStart)
    }
  }
  enableLoop(flag: boolean) { this.loopEnabled = flag }
  getLoop() { return { enabled: this.loopEnabled, start: this.loopStart, end: this.loopEnd } }

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
    this.currentNoteIndex = 0
    this.stopScheduling()
  }

  restart() {
    this.seekTo(0)
    this.play()
  }

  seekTo(time: number) {
    this.currentTime = Math.max(0, Math.min(time, this.getDuration()))
    this.currentNoteIndex = this.song
      ? Math.max(0, this.song.notes.findIndex(n => n.time >= this.currentTime))
      : 0
    if (this.currentNoteIndex < 0) this.currentNoteIndex = this.song?.notes.length || 0
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

    let startTime = performance.now()
    let startCurrentTime = this.currentTime

    const playLoop = () => {
      if (!this.isPlaying || !this.song) return

      const elapsed = (performance.now() - startTime) / 1000 * this.playbackRate
      this.currentTime = startCurrentTime + elapsed

      // Gestion de la fin (boucle ou fin morceau)
      if (this.loopEnabled) {
        if (this.currentTime >= this.loopEnd) {
          // Wrap au début de boucle
          this.stopAllNotes()
          this.currentTime = this.loopStart
          this.currentNoteIndex = Math.max(0, this.song.notes.findIndex(n => n.time >= this.currentTime))
          if (this.currentNoteIndex < 0) this.currentNoteIndex = this.song.notes.length
          startTime = performance.now()
          startCurrentTime = this.currentTime
        }
      } else {
        if (this.currentTime >= this.getDuration()) {
          this.stop()
          return
        }
      }

      // Déclenche les notes dues jusqu'à currentTime
      while (
        this.currentNoteIndex < this.song.notes.length &&
        this.song.notes[this.currentNoteIndex].time <= this.currentTime
      ) {
        const note = this.song.notes[this.currentNoteIndex]
        if (!this.loopEnabled || (note.time >= this.loopStart && note.time < this.loopEnd)) {
          this.synth.playNote(note.midiNote, note.velocity)
          const dur = Math.max(0, note.duration)
          const remaining = this.loopEnabled ? Math.max(0, this.loopEnd - this.currentTime) : dur
          const actualDur = Math.min(dur, remaining)
          setTimeout(() => this.synth.stopNote(note.midiNote), (actualDur * 1000) / this.playbackRate)
        }
        this.currentNoteIndex++
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
    if (!this.song || !this.synth) return
    for (let i = 0; i < 128; i++) {
      this.synth.stopNote(i)
    }
  }
}

// =============================== Composant UI ===============================
export default function Home() {
  const [instrumentName, setInstrumentName] = useState<InstrumentName>('acoustic_grand_piano')
  const synthState = useSynth(instrumentName)
  const freePlayer = useSingleton(() => new FreePlayer())
  const midiPlayer = useSingleton(() => new SimpleMidiPlayer())
  const [isMidiModalOpen, setMidiModal] = useState(false)
  const { isRecording, startRecording, stopRecording } = useRecordMidi(midiState)
  const [recordingPreview, setRecordingPreview] = useState('')

  // États MIDI
  const [currentSong, setCurrentSong] = useState<Song | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [isDragging, setIsDragging] = useState(false)
  const [dragTime, setDragTime] = useState(0)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [tempo, setTempo] = useState(120)

  // États boucle
  const [loopEnabled, setLoopEnabled] = useState(false)
  const [loopStart, setLoopStart] = useState(0)
  const [loopEnd, setLoopEnd] = useState(0)
  const [draggingHandle, setDraggingHandle] = useState<null | 'start' | 'end'>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const progressBarRef = useRef<HTMLDivElement>(null)

  // =========================== Effets principaux ===========================
  // Rafraîchit l'horloge d'affichage
  useEffect(() => {
    let interval: NodeJS.Timeout
    if (isPlaying && currentSong) {
      interval = setInterval(() => {
        const time = midiPlayer.getTime()
        setCurrentTime(time)
        // Si pas de boucle, stoppe à la fin
        if (!loopEnabled && time >= duration) {
          setIsPlaying(false)
          midiPlayer.stop()
        }
      }, 50)
    }
    return () => clearInterval(interval)
  }, [isPlaying, currentSong, duration, midiPlayer, loopEnabled])

  // Branche le synth dans le player
  useEffect(() => {
    if (synthState.synth) {
      midiPlayer.setSynth(synthState.synth)
    }
  }, [synthState.synth, midiPlayer])

  // Applique le tempo (facteur)
  useEffect(() => {
    midiPlayer.setTempoFactor(tempo / 120)
  }, [tempo, midiPlayer])

  // Init boucle quand un morceau est chargé
  useEffect(() => {
    if (!currentSong) return
    const defaultStart = 0
    const defaultEnd = Math.min(5, currentSong.duration || 0)
    setLoopStart(defaultStart)
    setLoopEnd(defaultEnd)
    midiPlayer.setLoop(defaultStart, defaultEnd)
    midiPlayer.enableLoop(loopEnabled)
  }, [currentSong, midiPlayer]) // loopEnabled sync plus bas

  // Sync bornes player quand l'UI change
  useEffect(() => {
    midiPlayer.setLoop(loopStart, loopEnd)
  }, [loopStart, loopEnd, midiPlayer])

  // Sync on/off de la boucle
  useEffect(() => {
    midiPlayer.enableLoop(loopEnabled)
  }, [loopEnabled, midiPlayer])

  // =========================== Handlers clavier/piano ===========================
  const handleNoteDown = useCallback(
    (note: number, velocity: number = 80) => {
      synthState.synth.playNote(note, velocity)
      freePlayer.addNote(note, velocity)
    },
    [freePlayer, synthState.synth],
  )

  const handleNoteUp = useCallback(
    (note: number) => {
      synthState.synth.stopNote(note)
      freePlayer.releaseNote(note)
    },
    [freePlayer, synthState.synth],
  )

  useEffect(() => {
    const handleMidiEvent = ({ type, note, velocity }: MidiStateEvent) => {
      if (type === 'down') handleNoteDown(note, velocity)
      else if (type === 'up') handleNoteUp(note)
    }
    midiState.subscribe(handleMidiEvent)
    return () => midiState.unsubscribe(handleMidiEvent)
  }, [handleNoteDown, handleNoteUp])

  // ============================= Import de MIDI =============================
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
      console.log('MIDI loaded:', song.notes.length, 'notes')
    } catch (error) {
      console.error('Error loading MIDI:', error)
      alert('Error loading MIDI file')
    }
  }

  // ============================== Transport ==============================
  const handlePlay = () => {
    if (!currentSong) return
    if (isPlaying) {
      midiPlayer.pause()
      setIsPlaying(false)
    } else {
      // Si boucle active et playhead hors de la région, on se replace sur loopStart
      if (loopEnabled && (currentTime < loopStart || currentTime > loopEnd)) {
        midiPlayer.seekTo(loopStart)
        setCurrentTime(loopStart)
      }
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

  // ========================== Barre de progression ==========================
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v))
  const HANDLE_PX = 12
  const MIN_LOOP_SEC = 0.05

  const calculateTimeFromPosition = (clientX: number) => {
    if (!progressBarRef.current || duration === 0) return 0
    const rect = progressBarRef.current.getBoundingClientRect()
    const percentage = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return percentage * duration
  }

  const getProgressMetrics = () => {
    if (!progressBarRef.current || duration === 0) return null
    const rect = progressBarRef.current.getBoundingClientRect()
    return { rect, width: rect.width, left: rect.left }
  }

  const positionToTime = (clientX: number) => {
    const metrics = getProgressMetrics()
    if (!metrics) return 0
    const pct = clamp((clientX - metrics.left) / metrics.width, 0, 1)
    return pct * duration
  }

  const isNearHandle = (clientX: number, handleTime: number) => {
    const metrics = getProgressMetrics()
    if (!metrics) return false
    const handleX = metrics.left + (handleTime / duration) * metrics.width
    return Math.abs(clientX - handleX) <= HANDLE_PX
  }

  const handleProgressClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (isDragging || draggingHandle) return
    let newTime = calculateTimeFromPosition(event.clientX)
    if (loopEnabled) newTime = clamp(newTime, loopStart, loopEnd)
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

  const onProgressMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault()
    const x = event.clientX
    if (loopEnabled) {
      const onStart = isNearHandle(x, loopStart)
      const onEnd = isNearHandle(x, loopEnd)
      if (onStart || onEnd) {
        setDraggingHandle(onStart ? 'start' : 'end')
        return
      }
    }
    // sinon drag du playhead
    handleMouseDown(event)
  }

  useEffect(() => {
    if (!draggingHandle) return
    const onMove = (e: MouseEvent) => {
      const t = positionToTime(e.clientX)
      if (draggingHandle === 'start') {
        const newStart = clamp(t, 0, loopEnd - MIN_LOOP_SEC)
        setLoopStart(newStart)
        // Option: snap du playhead si avant la nouvelle borne
        // if (currentTime < newStart) midiPlayer.seekTo(newStart)
      } else {
        const newEnd = clamp(t, loopStart + MIN_LOOP_SEC, duration)
        setLoopEnd(newEnd)
        // if (currentTime > newEnd) midiPlayer.seekTo(loopStart)
      }
    }
    const onUp = () => setDraggingHandle(null)

    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    return () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
  }, [draggingHandle, loopStart, loopEnd, duration])

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const newTime = calculateTimeFromPosition(event.clientX)
    setHoverTime(newTime)
  }

  const handleMouseLeave = () => setHoverTime(null)

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60)
    const seconds = Math.floor(time % 60)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // ================================ Rendu =================================
  return (
    <>
      {/* MIDI Controls Bar */}
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
        borderBottom: '1px solid #333',
        flexWrap: 'wrap'
      }}>
        <input type="file" accept=".mid,.midi" onChange={handleFileUpload} ref={fileInputRef} style={{ display: 'none' }}/>
        <button onClick={() => fileInputRef.current?.click()} style={{ background: '#4CAF50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>📁 Import MIDI</button>

        {currentSong && (
          <>
            <button onClick={handlePlay} style={{ background: isPlaying ? '#f44336' : '#2196F3', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>
              {isPlaying ? '⏸️ Pause' : '▶️ Play'}
            </button>
            <button onClick={handleStop} style={{ background: '#666', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>⏹️ Stop</button>
            <button onClick={handleRestart} style={{ background: '#FF9800', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer', fontSize: '14px' }}>⏮️ Restart</button>

            {/* Bouton Loop ON/OFF */}
            <button
              onClick={() => {
                if (!currentSong) return
                if (!loopEnabled) {
                  // Première activation: crée une boucle de 5s autour de la position courante
                  const start = Math.max(0, Math.min(currentTime, duration - 0.5))
                  const end = Math.min(duration, start + 5)
                  setLoopStart(start)
                  setLoopEnd(end)
                }
                setLoopEnabled(v => !v)
              }}
              style={{
                background: loopEnabled ? '#2e7d32' : '#1b5e20',
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '4px',
                cursor: currentSong ? 'pointer' : 'not-allowed',
                opacity: currentSong ? 1 : 0.5,
                fontSize: '14px'
              }}
              disabled={!currentSong}
            >
              {loopEnabled ? '🔁 Loop ON' : '🔁 Loop OFF'}
            </button>

            {/* Infos boucle */}
            {loopEnabled && (
              <span style={{ color: '#9ee2a0', fontSize: '12px' }}>
                A {formatTime(loopStart)} — B {formatTime(loopEnd)}
              </span>
            )}

            {/* Progress Bar avec zone et poignées de boucle */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, maxWidth: '600px', position: 'relative' }}>
              <span style={{ color: '#ccc', fontSize: '12px', minWidth: '40px' }}>{formatTime(currentTime)}</span>
              <div
                ref={progressBarRef}
                onClick={handleProgressClick}
                onMouseDown={onProgressMouseDown}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                style={{ flex: 1, height: '30px', background: '#333', borderRadius: '10px', cursor: 'pointer', position: 'relative', display: 'flex', alignItems: 'center', padding: '0 4px' }}
              >
                <div style={{ width: '100%', height: '8px', background: '#555', borderRadius: '4px', position: 'relative' }}>
                  {/* Zone de boucle */}
                  {loopEnabled && duration > 0 && (
                    <div
                      style={{
                        position: 'absolute',
                        left: `${(loopStart / duration) * 100}%`,
                        width: `${((loopEnd - loopStart) / duration) * 100}%`,
                        top: 0, bottom: 0,
                        background: 'rgba(76, 175, 80, 0.35)',
                        border: '1px solid #4CAF50',
                        borderRadius: '4px',
                        pointerEvents: 'none'
                      }}
                    />
                  )}

                  {/* Progress (bleu) */}
                  <div style={{ height: '100%', background: isDragging ? '#1976D2' : '#2196F3', width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`, borderRadius: '4px', position: 'relative' }}>
                    <div style={{ position: 'absolute', right: '-8px', top: '50%', transform: 'translateY(-50%)', width: '16px', height: '16px', background: isDragging ? '#1976D2' : '#2196F3', borderRadius: '50%', cursor: 'pointer', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', border: '2px solid white' }} />
                  </div>

                  {/* Poignées de boucle */}
                  {loopEnabled && duration > 0 && (
                    <>
                      <div
                        style={{
                          position: 'absolute',
                          left: `calc(${(loopStart / duration) * 100}% - 6px)`,
                          top: '-4px',
                          width: '12px',
                          height: '16px',
                          background: draggingHandle === 'start' ? '#2e7d32' : '#4CAF50',
                          border: '2px solid white',
                          borderRadius: '3px',
                          cursor: 'ew-resize',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: `calc(${(loopEnd / duration) * 100}% - 6px)`,
                          top: '-4px',
                          width: '12px',
                          height: '16px',
                          background: draggingHandle === 'end' ? '#2e7d32' : '#4CAF50',
                          border: '2px solid white',
                          borderRadius: '3px',
                          cursor: 'ew-resize',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                      />
                    </>
                  )}
                </div>

                {/* Tooltip du timecode */}
                {hoverTime !== null && (
                  <div style={{ position: 'absolute', left: `${(hoverTime / duration) * 100}%`, top: '-20px', transform: 'translateX(-50%)', background: 'black', color: 'white', padding: '2px 6px', borderRadius: '4px', fontSize: '12px', pointerEvents: 'none' }}>
                    {formatTime(hoverTime)}
                  </div>
                )}
              </div>
              <span style={{ color: '#ccc', fontSize: '12px', minWidth: '40px' }}>{formatTime(duration)}</span>
            </div>

            {/* Slider de tempo */}
            <div style={{ flex: '0 0 200px' }}>
              <label style={{ color: 'white', fontSize: '12px' }}>Tempo: {tempo} BPM</label>
              <input type="range" min={20} max={240} value={tempo} onChange={(e) => setTempo(Number(e.target.value))} style={{ width: '100%' }}/>
            </div>
          </>
        )}

        <span style={{ color: '#ccc', fontSize: '12px' }}>
          {currentSong ? `🎵 MIDI loaded (${currentSong.notes.length} notes)` : 'Import MIDI or play piano below'}
        </span>
      </div>

      <div className="flex h-screen w-screen flex-col" style={{ paddingTop: '100px' }}>
        <TopBar
          onClickMidi={(e) => { e.stopPropagation(); setMidiModal(!isMidiModalOpen) }}
          onClickRecord={(e) => {
            e.stopPropagation()
            if (!isRecording) {
              startRecording()
            } else {
              const midiBytes = stopRecording()
              if (midiBytes !== null) {
                const base64MidiData = Buffer.from(midiBytes).toString('base64')
                setRecordingPreview(base64MidiData)
              }
            }
          }}
          isRecordingAudio={isRecording}
          isLoading={synthState.loading}
          isError={synthState.error}
          value={instrumentName}
          onChange={(name) => setInstrumentName(name)}
        />

        <MidiModal isOpen={isMidiModalOpen} onClose={() => setMidiModal(false)} />
        <RecordingModal show={recordingPreview.length > 0} onClose={() => setRecordingPreview('')} songMeta={{ source: 'base64', id: recordingPreview }}/>

        <div className="relative grow">
          <SongVisualizer
            song={currentSong || freePlayer.song}
            config={{left: true, right: true, waiting: false, visualization: 'falling-notes', noteLabels: 'none', coloredNotes: true, skipMissedNotes: false, tracks: {}}}
            hand="both"
            handSettings={{ 1: { hand: 'right' } }}
            getTime={() => currentSong ? midiPlayer.getTime() : freePlayer.getTime()}
            constrictView={false}
          />
        </div>
      </div>
    </>
  )
}
