// src/app/api/upload-midi/route.js
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request) {
  try {
    // Récupérer le fichier depuis la requête
    const formData = await request.formData()
    const file = formData.get('midi') // 'midi' est le nom du champ depuis Bubble
    
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier MIDI trouvé' }, { status: 400 })
    }

    // Vérifier que c'est bien un fichier MIDI
    if (!file.name.endsWith('.mid') && !file.name.endsWith('.midi')) {
      return NextResponse.json({ error: 'Le fichier doit être un fichier MIDI (.mid ou .midi)' }, { status: 400 })
    }

    // Convertir le fichier en ArrayBuffer pour le lecteur MIDI
    const arrayBuffer = await file.arrayBuffer()
    
    // Créer une URL temporaire pour le fichier
    const uint8Array = new Uint8Array(arrayBuffer)
    const blob = new Blob([uint8Array], { type: 'audio/midi' })
    
    // Retourner les données du fichier
    return NextResponse.json({
      success: true,
      fileName: file.name,
      fileSize: file.size,
      // On peut soit retourner les données en base64
      fileData: Buffer.from(arrayBuffer).toString('base64'),
      message: 'Fichier MIDI reçu avec succès'
    })
    
  } catch (error) {
    console.error('Erreur lors du traitement du fichier MIDI:', error)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

// Permettre les requêtes CORS depuis Bubble
export async function OPTIONS(request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })
}