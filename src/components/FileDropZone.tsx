import { useRef, useState } from "react"
import { UploadCloudIcon } from "lucide-react"
import { isAcceptedFile, ACCEPT_ATTRIBUTE } from "@/shared/utils/uploadRows"

interface FileDropZoneProps {
    /** 고른 파일들을 넘긴다 — 이미 고른 것에 이어붙이는 건 부모가 정한다. */
    onSelect: (files: File[]) => void
}

export function FileDropZone({ onSelect }: FileDropZoneProps) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [dragging, setDragging] = useState(false)
    const [error, setError] = useState("")

    /**
     * 지원하지 않는 형식은 걸러내고 나머지는 그대로 넘긴다.
     * 리사이징은 등록(업로드) 시점에 한다 — 고를 때마다 큰 파일을 갈면 선택이 느려진다.
     */
    function accept(selected: FileList | null) {
        const picked = Array.from(selected ?? [])
        if (picked.length === 0) return

        const accepted = picked.filter((file) => isAcceptedFile(file.name))
        const rejected = picked.filter((file) => !isAcceptedFile(file.name))

        setError(
            rejected.length === 0
                ? ""
                : rejected.map((file) => file.name).join(", ") +
                      " — XLSX, CSV, PDF, PNG, JPEG 파일만 등록할 수 있습니다."
        )
        if (accepted.length > 0) onSelect(accepted)
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
                    accept(event.dataTransfer.files)
                }}
                className={
                    "flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-colors " +
                    (dragging ? "border-primary bg-primary-50" : "border-gray-300 bg-surface")
                }
            >
                <UploadCloudIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                <p className="mt-3 text-sm text-gray-700">파일을 이곳에 끌어다 놓으세요</p>
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
                    multiple
                    accept={ACCEPT_ATTRIBUTE}
                    className="hidden"
                    onChange={(event) => {
                        accept(event.target.files)
                        // 같은 파일을 다시 고를 수 있도록 비운다(값이 같으면 change 가 안 뜬다)
                        event.target.value = ""
                    }}
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
