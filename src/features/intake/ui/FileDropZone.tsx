import { useRef, useState } from "react"
import { FileSpreadsheetIcon, UploadCloudIcon, XIcon } from "lucide-react"

interface FileDropZoneProps {
    file: File | null
    onChange: (file: File | null) => void
}

export function FileDropZone({ file, onChange }: FileDropZoneProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragging, setDragging] = useState(false)
    const [error, setError] = useState("")

    function accept(selected: File | null) {
        if (!selected) return
        const name = selected.name.toLowerCase()
        if (!name.endsWith(".xlsx") && !name.endsWith(".csv")) {
            setError("XLSX 또는 CSV 파일만 등록할 수 있습니다.")
            onChange(null)
            return
        }
        setError("")
        onChange(selected)
    }

    return (
        <div>
            <div
                onDragOver={(event) => {
                    event.preventDefault()
                    setDragging(true)
                }}
                onDragLeave={() => setDragging(false)}
                onDrop={(event) => {
                    event.preventDefault()
                    setDragging(false)
                    accept(event.dataTransfer.files[0] ?? null)
                }}
                className={
                    "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors " +
                    (dragging ? "border-blue-600 bg-blue-50" : "border-gray-300 bg-gray-50")
                }
            >
                <UploadCloudIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                <p className="mt-3 text-sm text-gray-700">파일을 이곳에 끌어다 놓으세요</p>
                <p className="mt-1 text-xs text-gray-500">지원 형식: XLSX, CSV</p>
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="mt-4 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    파일 선택
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.csv"
                    className="hidden"
                    onChange={(event) => accept(event.target.files?.[0] ?? null)}
                />
            </div>

            {file && (
                <div className="mt-3 flex items-center justify-between rounded-xl border border-gray-200 bg-white px-3 py-2">
                    <span className="flex min-w-0 items-center gap-2 text-sm text-gray-700">
                        <FileSpreadsheetIcon className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                        <span className="truncate">{file.name}</span>
                    </span>
                    <button
                        type="button"
                        onClick={() => onChange(null)}
                        className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                        aria-label="선택한 파일 제거"
                    >
                        <XIcon className="h-4 w-4" aria-hidden="true" />
                    </button>
                </div>
            )}

            {error && (
                <p className="mt-3 text-sm text-red-600" role="alert">
                    {error}
                </p>
            )}
        </div>
    )
}
