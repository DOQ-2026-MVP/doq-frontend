import { useRef, useState } from "react"
import { UploadCloudIcon } from "lucide-react"
import { isAcceptedFile, ACCEPT_ATTRIBUTE, resizeFileIfNeeded } from "@/shared/utils/uploadRows"

interface FileDropZoneProps {
    onChange: (file: File | null) => void
}

export function FileDropZone({ onChange }: FileDropZoneProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragging, setDragging] = useState(false)
    const [error, setError] = useState("")

    async function accept(selected: File | null) {
        if (!selected) return
        if (!isAcceptedFile(selected.name)) {
            setError("XLSX, CSV, PDF, PNG, JPEG 파일만 등록할 수 있습니다.")
            onChange(null)
            return
        }
        setError("")
        try {
            const processed = await resizeFileIfNeeded(selected)
            onChange(processed)
        } catch (e) {
            onChange(selected)
        }
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
                    void accept(event.dataTransfer.files[0] ?? null)
                }}
                className={
                    "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors " +
                    (dragging ? "border-primary bg-primary-50" : "border-gray-300 bg-surface")
                }
            >
                <UploadCloudIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                <p className="mt-3 text-sm text-gray-700">파일을 이곳에 끌어다 놓으세요</p>
                <p className="mt-1 text-xs text-gray-500">지원 형식: XLSX, CSV, PDF, PNG, JPEG</p>
                <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    className="mt-4 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-surface"
                >
                    파일 선택
                </button>
                <input
                    ref={inputRef}
                    type="file"
                    accept={ACCEPT_ATTRIBUTE}
                    className="hidden"
                    onChange={(event) => void accept(event.target.files?.[0] ?? null)}
                />
            </div>

            {error && (
                <p className="mt-3 text-sm text-red-600" role="alert">
                    {error}
                </p>
            )}
        </div>
    )
}
