import { unzipSync, strFromU8 } from "fflate";

export function isDOCX(file: File): boolean {
  return (
    (typeof file.type === "string" && file.type.includes("officedocument.wordprocessingml.document")) ||
    file.name.toLowerCase().endsWith(".docx")
  );
}

export async function extractTextFromDOCX(file: File): Promise<string> {
  try {
    const buf = new Uint8Array(await file.arrayBuffer());
    const zip = unzipSync(buf);
    const docXml = zip["word/document.xml"];
    if (!docXml) return "";
    const xml = strFromU8(docXml);
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");

    // Prefer paragraph-wise extraction
    const paragraphs = Array.from(doc.getElementsByTagName("w:p"));
    if (paragraphs.length > 0) {
      const lines: string[] = [];
      for (const p of paragraphs) {
        const texts = Array.from(p.querySelectorAll("w\\:t, t")).map((n) => (n.textContent || "").trim());
        const line = texts.filter(Boolean).join("");
        if (line) lines.push(line);
      }
      return lines.join("\n");
    }

    // Fallback: all text nodes
    const allTexts = Array.from(doc.querySelectorAll("w\\:t, t")).map((n) => (n.textContent || "").trim());
    return allTexts.filter(Boolean).join(" ");
  } catch (e) {
    return "";
  }
}
