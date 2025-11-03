import Tesseract from 'tesseract.js'

export async function ocrImageToText(image: Electron.NativeImage): Promise<string> {
  const buf = image.toPNG()
  const { data } = await Tesseract.recognize(Buffer.from(buf), 'eng', {
    logger: () => {},
  })
  return data.text || ''
}
