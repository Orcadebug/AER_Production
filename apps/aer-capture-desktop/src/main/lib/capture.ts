import screenshot from 'screenshot-desktop'
import { nativeImage } from 'electron'

export async function captureEntireScreen(): Promise<Electron.NativeImage> {
  const img = await screenshot({ format: 'png' })
  return nativeImage.createFromBuffer(Buffer.from(img))
}
