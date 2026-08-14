const STORAGE_KEY = "doq.structuredIngestionIds"

/** 구조화(structuring) 완료되어 검수 인박스에 반영된 ingestionId 목록 (등록 순서 유지, 중복 없음). */
export function getStructuredIngestionIds(): string[] {
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        const parsed = raw ? JSON.parse(raw) : []
        return Array.isArray(parsed) ? parsed.map(String) : []
    } catch {
        return []
    }
}

export function addStructuredIngestionId(ingestionId: number | string): void {
    const id = String(ingestionId)
    const existing = getStructuredIngestionIds()
    if (existing.includes(id)) return
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...existing, id]))
}
