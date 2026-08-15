import { useEffect, useState } from "react"
import { AlertCircleIcon, FileTextIcon, ImageIcon, Loader2Icon, MaximizeIcon, XIcon } from "lucide-react"
import { getUploadContent } from "@/apis/ingestion"

/** 확장자로 정한 미리보기 방식. 서버가 준 content-type 이 뭉뚱그려져 있어도(octet-stream) 이걸로 판단한다. */
type PreviewKind = "PDF" | "IMAGE" | "TABLE"

const MIME_BY_EXTENSION: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
}

function extensionOf(fileName: string | null): string {
    if (!fileName) return ""
    const parts = fileName.toLowerCase().split(".")
    return parts.length > 1 ? parts[parts.length - 1] : ""
}

function previewKindOf(fileName: string | null): PreviewKind {
    const extension = extensionOf(fileName)
    if (extension === "pdf") return "PDF"
    if (extension === "png" || extension === "jpg" || extension === "jpeg") return "IMAGE"
    return "TABLE"
}

interface SourcePreviewProps {
    /** 실제 업로드된 원본 파일명 — 미리보기 방식은 행의 `원본유형` 이 아니라 이 파일이 정한다. */
    fileName: string | null
    uploadRowNo: number | null
    ingestionId?: number | string
    uploadId?: number | null
}

export function SourcePreview({ fileName, uploadRowNo, ingestionId, uploadId }: SourcePreviewProps) {
    const [open, setOpen] = useState(false)
    const [objectUrl, setObjectUrl] = useState<string | null>(null)
    const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle")

    useEffect(() => {
        if (!open) return
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") setOpen(false)
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [open])

    // 원본 보기를 처음 열 때 실제 업로드 원본 파일을 받아온다 (getUploadContent).
    useEffect(() => {
        if (!open || objectUrl || !ingestionId || !uploadId) return
        let cancelled = false
        setLoadState("loading")
        getUploadContent(ingestionId, uploadId)
            .then((blob) => {
                if (cancelled) return
                // 서버가 octet-stream 으로 주면 iframe 이 렌더링 대신 다운로드로 떨어진다 — 확장자로 다시 붙인다.
                const mime = MIME_BY_EXTENSION[extensionOf(fileName)]
                const typed = mime && blob.type !== mime ? blob.slice(0, blob.size, mime) : blob
                setObjectUrl(URL.createObjectURL(typed))
                setLoadState("ready")
            })
            .catch(() => {
                if (!cancelled) setLoadState("error")
            })
        return () => {
            cancelled = true
        }
    }, [open, objectUrl, ingestionId, uploadId, fileName])

    useEffect(() => {
        return () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl)
        }
    }, [objectUrl])

    if (!fileName) return null

    const kind = previewKindOf(fileName)
    const isPdf = kind === "PDF"
    const Icon = kind === "IMAGE" ? ImageIcon : FileTextIcon
    const viewerLabel = kind === "PDF" ? "PDF 원본 보기" : kind === "IMAGE" ? "이미지 원본 보기" : "원본 파일 열기"
    const thumbLabel = kind === "PDF" ? "첫 페이지 미리보기" : kind === "IMAGE" ? "이미지 썸네일" : "취합 파일"
    const canFetch = !!ingestionId && !!uploadId

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
                        <span className="text-xs">{canFetch ? thumbLabel : "원본 파일 없음 (수기 등록 등)"}</span>
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
                            {!canFetch ? (
                                <>
                                    <Icon className="h-10 w-10" aria-hidden="true" />
                                    <p className="text-xs">원본 파일 정보를 찾을 수 없습니다.</p>
                                </>
                            ) : loadState === "loading" || loadState === "idle" ? (
                                <>
                                    <Loader2Icon className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                                    <p className="text-xs">불러오는 중입니다.</p>
                                </>
                            ) : loadState === "error" ? (
                                <>
                                    <AlertCircleIcon className="h-8 w-8 text-red-400" aria-hidden="true" />
                                    <p className="text-xs">원본을 불러오지 못했습니다.</p>
                                </>
                            ) : kind === "TABLE" ? (
                                <>
                                    <FileTextIcon className="h-10 w-10" aria-hidden="true" />
                                    <p className="text-xs">표 파일은 화면에서 미리 볼 수 없습니다.</p>
                                    <a
                                        href={objectUrl ?? undefined}
                                        download={fileName ?? undefined}
                                        className="text-xs font-medium text-primary hover:underline"
                                    >
                                        원본 내려받기
                                    </a>
                                </>
                            ) : isPdf ? (
                                <iframe title={viewerLabel} src={objectUrl ?? undefined} className="h-full w-full" />
                            ) : (
                                <img
                                    src={objectUrl ?? undefined}
                                    alt={fileName ?? "원본 이미지"}
                                    className="max-h-full max-w-full object-contain"
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
