import { useEffect, useState } from "react"
import { FileTextIcon, ImageIcon, MaximizeIcon, XIcon } from "lucide-react"
import type { SourceType } from "@/shared/model/inspection"

interface SourcePreviewProps {
    sourceType: SourceType
    fileName: string | null
    uploadRowNo: number | null
}

export function SourcePreview({ sourceType, fileName, uploadRowNo }: SourcePreviewProps) {
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (!open) return
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false)
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [open])

    if (sourceType !== "PDF" && sourceType !== "IMAGE") return null

    const isPdf = sourceType === "PDF"
    const Icon = isPdf ? FileTextIcon : ImageIcon
    const viewerLabel = isPdf ? "PDF 원본 보기" : "이미지 원본 보기"
    const thumbLabel = isPdf ? "첫 페이지 미리보기" : "이미지 썸네일"

    return (
        <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-600">원본 파일 프리뷰</p>
                <span className="text-xs text-gray-400">{thumbLabel}</span>
            </div>

            <div className="mt-2 overflow-hidden rounded-xl border border-gray-200">
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label={viewerLabel}
                    className="group relative block w-full bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-100"
                >
                    <span className="flex h-44 w-full flex-col items-center justify-center gap-2 text-gray-400">
                        <Icon className="h-8 w-8" aria-hidden="true" />
                        <span className="text-xs">{thumbLabel}</span>
                    </span>
                    <span className="absolute right-2 top-2 hidden rounded-lg bg-white/90 p-1.5 text-gray-600 ring-1 ring-gray-200 group-hover:block">
                        <MaximizeIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                </button>
                <div className="flex items-center justify-between border-t border-gray-200 bg-white px-3 py-2">
                    <span className="min-w-0 truncate text-xs text-gray-600">
                        {fileName ?? "원본 파일"}
                        {uploadRowNo !== null && <span className="text-gray-400">{" / " + uploadRowNo + "행"}</span>}
                    </span>
                    <button
                        type="button"
                        onClick={() => setOpen(true)}
                        className="shrink-0 text-xs font-medium text-primary hover:underline"
                    >
                        원본 보기
                    </button>
                </div>
            </div>

            {open && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={viewerLabel}
                    className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
                    onClick={() => setOpen(false)}
                >
                    <div
                        className="w-full max-w-3xl overflow-hidden rounded-xl bg-white"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                            <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-gray-900">{viewerLabel}</h3>
                                <p className="truncate text-xs text-gray-500">{fileName ?? "원본 파일"}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setOpen(false)}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                aria-label="닫기"
                            >
                                <XIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                        <div className="flex h-[60vh] flex-col items-center justify-center gap-2 bg-gray-50 text-gray-400">
                            <Icon className="h-10 w-10" aria-hidden="true" />
                            <p className="text-xs">{isPdf ? "PDF 전체 문서 영역" : "이미지 원본 크기 영역"}</p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
