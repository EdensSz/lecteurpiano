import { NextResponse } from 'next/server'

export async function GET() {
  try {
    if (global.latestMidiData) {
      const data = global.latestMidiData
      // Reset après récupération pour éviter les doublons
      global.latestMidiData = null
      
      return NextResponse.json({
        newFile: true,
        midiData: data
      })
    } else {
      return NextResponse.json({ newFile: false })
    }
  } catch (error) {
    return NextResponse.json({ newFile: false, error: error.message })
  }
}