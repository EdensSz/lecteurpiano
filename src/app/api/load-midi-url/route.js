import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { url } = await request.json()
    
    if (!url) {
      return NextResponse.json({ error: 'URL manquante' }, { status: 400 })
    }

    // Télécharger le fichier MIDI depuis l'URL
    const response = await fetch(url)
    
    if (!response.ok) {
      return NextResponse.json({ error: 'Impossible de télécharger le fichier MIDI' }, { status: 400 })
    }

    // Convertir en ArrayBuffer puis base64
    const arrayBuffer = await response.arrayBuffer()
    const base64Data = Buffer.from(arrayBuffer).toString('base64')
    
    const fileName = url.split('/').pop() || 'downloaded-midi.mid'
    
    // Stocker temporairement
    global.latestMidiData = {
      fileName: fileName,
      fileSize: arrayBuffer.byteLength,
      fileData: base64Data,
      success: true,
      message: 'Fichier MIDI téléchargé avec succès',
      timestamp: Date.now()
    }
    
    return NextResponse.json({
      success: true,
      message: 'Fichier MIDI téléchargé et prêt',
      fileName: fileName,
      fileSize: arrayBuffer.byteLength
    })
    
  } catch (error) {
    console.error('Erreur lors du téléchargement MIDI:', error)
    return NextResponse.json({ 
      error: 'Erreur serveur lors du téléchargement',
      details: error.message 
    }, { status: 500 })
  }
}