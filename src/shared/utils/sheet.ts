/** 표 파일(XLSX·CSV) 미리보기용 파서. 화면에 뿌릴 만큼만 잘라서 돌려준다. */

export const SHEET_MAX_ROWS = 200
export const SHEET_MAX_COLUMNS = 40

/**
 * 국내 엑셀에서 저장한 CSV 는 UTF-8 이 아닌 경우가 많다.
 * UTF-8 로 읽어 깨진 문자가 섞이면 EUC-KR(CP949)로 다시 읽는다.
 */
function decodeText(buffer: ArrayBuffer): string {
    const utf8 = new TextDecoder("utf-8").decode(buffer)
    if (!utf8.includes("�")) return utf8
    try {
        return new TextDecoder("euc-kr").decode(buffer)
    } catch {
        return utf8
    }
}

/** 따옴표로 감싼 칸 안의 쉼표·줄바꿈까지 지키는 최소 CSV 파서. */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = []
    let row: string[] = []
    let cell = ""
    let quoted = false

    for (let i = 0; i < text.length; i++) {
        const char = text[i]
        if (quoted) {
            if (char !== '"') cell += char
            else if (text[i + 1] === '"') {
                cell += '"'
                i++
            } else quoted = false
            continue
        }
        if (char === '"') quoted = true
        else if (char === ",") {
            row.push(cell)
            cell = ""
        } else if (char === "\n") {
            row.push(cell)
            rows.push(row)
            row = []
            cell = ""
        } else if (char !== "\r") cell += char
    }
    if (cell !== "" || row.length > 0) {
        row.push(cell)
        rows.push(row)
    }

    // 마지막 줄바꿈 뒤의 빈 줄은 표에 보일 이유가 없다.
    return rows.filter((line) => line.some((value) => value.trim() !== ""))
}

function trim(rows: string[][]): string[][] {
    return rows.slice(0, SHEET_MAX_ROWS).map((row) => row.slice(0, SHEET_MAX_COLUMNS))
}

/** 업로드 원본(XLSX·CSV)을 미리보기용 2차원 배열로 읽는다. 첫 시트만 본다. */
export async function readSheet(blob: Blob, fileName: string | null): Promise<string[][]> {
    const buffer = await blob.arrayBuffer()

    if ((fileName ?? "").toLowerCase().endsWith(".csv")) {
        return trim(parseCsv(decodeText(buffer)))
    }

    // xlsx 파서는 무겁다 — 표 파일을 실제로 열 때만 받아온다.
    const XLSX = await import("xlsx")
    const book = XLSX.read(new Uint8Array(buffer), { type: "array" })
    const sheetName = book.SheetNames[0]
    if (!sheetName) return []
    const rows = XLSX.utils.sheet_to_json<string[]>(book.Sheets[sheetName], {
        header: 1,
        raw: false,
        defval: "",
        blankrows: false,
    })
    return trim(rows.map((row) => (Array.isArray(row) ? row.map((cell) => String(cell ?? "")) : [])))
}
