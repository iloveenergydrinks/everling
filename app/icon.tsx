import { ImageResponse } from 'next/og'
import fs from 'node:fs'
import path from 'node:path'

// Use Node runtime so we can read the local file
export const runtime = 'nodejs'

export const size = { width: 256, height: 256 }
export const contentType = 'image/png'

export default function Icon() {
  const logoPath = path.join(process.cwd(), 'public', 'everling_logo.png')
  const logo = fs.readFileSync(logoPath)
  const dataUrl = `data:image/png;base64,${logo.toString('base64')}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#ffffff',
        }}
      >
        <img
          src={dataUrl}
          width={256}
          height={256}
          style={{ objectFit: 'contain', transform: 'scale(1.35)', transformOrigin: 'center' }}
        />
      </div>
    ),
    { size }
  )
}


