import axios from 'axios'
import log from 'electron-log'

export type AerConfig = {
  token?: string
  convexSite?: string
}

export async function sendToAer(payload: { title: string; plaintext: string; metadata?: any }, cfg: AerConfig) {
  const site = cfg.convexSite || process.env.VITE_CONVEX_SITE_URL || 'https://brilliant-caribou-800.convex.site'
  const url = `${site}/api/context/upload`
  try {
    const res = await axios.post(
      url,
      {
        title: payload.title,
        plaintext: payload.plaintext,
        type: 'note',
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.token}`,
        },
        timeout: 20000,
      },
    )
    return { ok: true, status: res.status, data: res.data }
  } catch (e: any) {
    log.error('Upload failed', e?.response?.status, e?.response?.data || String(e))
    return { ok: false, status: e?.response?.status || 0, error: e?.response?.data || String(e) }
  }
}
