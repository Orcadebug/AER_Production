import { app } from 'electron'
import fs from 'node:fs/promises'
import path from 'node:path'

const CONFIG_FILE = 'config.json'
const HISTORY_FILE = 'history.json'

type Cfg = {
  token?: string
  convexSite?: string
}

export async function configPath(file: string) {
  const dir = app.getPath('userData')
  return path.join(dir, file)
}

export async function loadConfig(): Promise<Cfg> {
  try {
    const p = await configPath(CONFIG_FILE)
    const raw = await fs.readFile(p, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

export async function saveConfig(cfg: Cfg) {
  const p = await configPath(CONFIG_FILE)
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, JSON.stringify(cfg, null, 2))
  return cfg
}

export async function loadHistory(): Promise<any[]> {
  try {
    const p = await configPath(HISTORY_FILE)
    const raw = await fs.readFile(p, 'utf-8')
    return JSON.parse(raw)
  } catch {
    return []
  }
}

export async function addHistoryEntry(entry: any) {
  const list = await loadHistory()
  list.unshift(entry)
  const p = await configPath(HISTORY_FILE)
  await fs.mkdir(path.dirname(p), { recursive: true })
  await fs.writeFile(p, JSON.stringify(list.slice(0, 20), null, 2))
  return true
}
