import * as Tone from 'tone';
import { Midi } from '@tonejs/midi';

export class MidiFilePlayer {
  private midi: Midi | null = null;
  private synth: Tone.PolySynth;
  private parts: Tone.Part[] = [];

  constructor() {
    this.synth = new Tone.PolySynth(Tone.Synth).toDestination();
  }

  async loadFromFile(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    this.midi = new Midi(arrayBuffer);
    this.setupParts();
    console.log(`Loaded MIDI: ${this.midi.name}, Duration: ${this.midi.duration}s`);
  }

  private setupParts() {
    if (!this.midi) return;

    // Nettoyer les anciennes parties
    this.parts.forEach(part => part.dispose());
    this.parts = [];

    // Créer une partie pour chaque track
    this.midi.tracks.forEach((track) => {
      const part = new Tone.Part((time, note) => {
        this.synth.triggerAttackRelease(
          note.name,
          note.duration,
          time,
          note.velocity
        );
      }, track.notes.map(note => ({
        time: note.time,
        name: note.name,
        duration: note.duration,
        velocity: note.velocity
      })));

      this.parts.push(part);
    });
  }

  start() {
    if (this.parts.length === 0) {
      console.warn('No MIDI loaded');
      return;
    }
    this.parts.forEach(part => part.start(0));
  }

  stop() {
    this.parts.forEach(part => part.stop());
    Tone.Transport.stop();
    Tone.Transport.position = 0;
  }

  pause() {
    this.parts.forEach(part => part.stop());
  }
}
