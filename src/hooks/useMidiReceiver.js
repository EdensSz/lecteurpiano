// src/hooks/useMidiReceiver.js
import { useEffect } from 'react'

export const useMidiReceiver = (onMidiReceived) => {
  useEffect(() => {
    // Fonction pour vérifier périodiquement s'il y a un nouveau fichier
    const checkForNewMidi = async () => {
      try {
        // Polling vers ton API pour vérifier les nouveaux fichiers
        const response = await fetch('/api/check-new-midi')
        if (response.ok) {
          const data = await response.json()
          if (data.newFile) {
            onMidiReceived(data.midiData)
          }
        }
      } catch (error) {
        // Silencieux - pas de nouveau fichier
      }
    }

    // Vérifier toutes les 3 secondes
    const interval = setInterval(checkForNewMidi, 3000)

    return () => clearInterval(interval)
  }, [onMidiReceived])
}

// Fonction pour charger directement un fichier MIDI depuis une URL ou des données base64
export const loadMidiFromData = async (midiData, fileName = 'bubble-midi.mid') => {
  try {
    let arrayBuffer
    
    if (typeof midiData === 'string') {
      // Si c'est du base64
      const binaryString = atob(midiData)
      const uint8Array = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        uint8Array[i] = binaryString.charCodeAt(i)
      }
      arrayBuffer = uint8Array.buffer
    } else {
      // Si c'est déjà un ArrayBuffer
      arrayBuffer = midiData
    }
    
    // Créer un objet File pour ton lecteur existant
    const file = new File([arrayBuffer], fileName, { type: 'audio/midi' })
    return file
  } catch (error) {
    console.error('Erreur lors du traitement du fichier MIDI:', error)
    return null
  }
}