import { useEffect, useMemo, useRef, useState } from "react"
import {
    AlertCircleIcon,
    DownloadIcon,
    FileTextIcon,
    Loader2Icon,
    MaximizeIcon,
    MinusIcon,
    PlusIcon,
    RotateCcwIcon,
    XIcon,
} from "lucide-react"
import { getUploadContent } from "@/apis/ingestion"
import { renderPdfPages } from "@/shared/utils/pdf"
import { readSheet, SHEET_MAX_ROWS } from "@/shared/utils/sheet"

/** 확장자로 정한 미리보기 방식. 서버가 준 content-type 이 뭉뚱그려져 있어도(octet-stream) 이걸로 판단한다. */
type PreviewKind = "PDF" | "IMAGE" | "TABLE"

/** 실제로 화면에 그릴 것 — 원본을 받아 방식별로 한 번만 만들어 둔다. */
type PreviewContent =
    | { kind: "IMAGE"; url: string }
    | { kind: "PDF"; pages: string[] }
    | { kind: "TABLE"; rows: string[][] }

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

const KIND_LABEL: Record<PreviewKind, string> = {
    PDF: "PDF 원본",
    IMAGE: "이미지 원본",
    TABLE: "표 원본",
}

/**
 * 프리뷰 본문 높이. 옆 카드의 검수 메모가 같은 높이를 써야 두 카드의 아래 필드 행이 나란히 선다 —
 * 한쪽만 바꾸면 행이 통째로 어긋나므로 같이 움직인다.
 */
export const PREVIEW_BODY_HEIGHT = "h-72"

const MIN_SCALE = 0.25
const MAX_SCALE = 4

type View = { x: number; y: number; scale: number }

const INITIAL_VIEW: View = { x: 0, y: 0, scale: 1 }

/**
 * 원본을 그대로 얹어 두고 드래그로 위치를 옮기는 뷰포트.
 *
 * 스크롤 대신 transform 으로 움직인다 — 이미지·PDF·표를 같은 방식으로 다룰 수 있고,
 * 확대한 뒤에도 보고 싶은 자리로 끌어다 놓을 수 있다.
 */
function PannableSurface({
    content,
    highlightRow,
    className,
}: {
    content: PreviewContent
    highlightRow: number | null
    className: string
}) {
    const [view, setView] = useState<View>(INITIAL_VIEW)
    const [dragging, setDragging] = useState(false)
    const origin = useRef<{ pointerX: number; pointerY: number; viewX: number; viewY: number } | null>(null)

    // 다른 행·다른 파일로 넘어가면 이전에 끌어 놓은 위치를 물려주지 않는다.
    useEffect(() => setView(INITIAL_VIEW), [content])

    const zoomBy = (delta: number) =>
        setView((prev) => ({
            ...prev,
            scale: Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.round((prev.scale + delta) * 100) / 100)),
        }))

    return (
        <div
            className={"relative overflow-hidden bg-gray-50 " + className}
            onPointerDown={(event) => {
                if (event.button !== 0) return
                origin.current = {
                    pointerX: event.clientX,
                    pointerY: event.clientY,
                    viewX: view.x,
                    viewY: view.y,
                }
                event.currentTarget.setPointerCapture(event.pointerId)
                setDragging(true)
            }}
            onPointerMove={(event) => {
                const start = origin.current
                if (!start) return
                setView((prev) => ({
                    ...prev,
                    x: start.viewX + (event.clientX - start.pointerX),
                    y: start.viewY + (event.clientY - start.pointerY),
                }))
            }}
            onPointerUp={(event) => {
                if (!origin.current) return
                origin.current = null
                setDragging(false)
                event.currentTarget.releasePointerCapture(event.pointerId)
            }}
            onPointerCancel={() => {
                origin.current = null
                setDragging(false)
            }}
            style={{ cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
        >
            <div
                className="absolute left-0 top-0 w-full select-none"
                style={{
                    transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`,
                    transformOrigin: "top left",
                }}
            >
                {content.kind === "IMAGE" && (
                    <img src={content.url} alt="원본 이미지" draggable={false} className="w-full" />
                )}
                {content.kind === "PDF" &&
                    content.pages.map((page, index) => (
                        <img
                            key={index}
                            src={page}
                            alt={index + 1 + "페이지"}
                            draggable={false}
                            className="w-full border-b border-gray-200 last:border-b-0"
                        />
                    ))}
                {content.kind === "TABLE" && <SheetTable rows={content.rows} highlightRow={highlightRow} />}
            </div>

            <div
                className="absolute right-2 top-2 flex items-center gap-1 rounded-lg bg-white/90 p-1 ring-1 ring-gray-200"
                onPointerDown={(event) => event.stopPropagation()}
            >
                <button
                    type="button"
                    onClick={() => zoomBy(-0.25)}
                    aria-label="축소"
                    className="rounded p-1 text-gray-600 hover:bg-gray-100"
                >
                    <MinusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span className="w-10 text-center text-[11px] tabular-nums text-gray-500">
                    {Math.round(view.scale * 100)}%
                </span>
                <button
                    type="button"
                    onClick={() => zoomBy(0.25)}
                    aria-label="확대"
                    className="rounded p-1 text-gray-600 hover:bg-gray-100"
                >
                    <PlusIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <button
                    type="button"
                    onClick={() => setView(INITIAL_VIEW)}
                    aria-label="원래 위치로"
                    className="rounded p-1 text-gray-600 hover:bg-gray-100"
                >
                    <RotateCcwIcon className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
            </div>
        </div>
    )
}

/** 표 파일 미리보기 — 첫 줄은 머리글로, 이 검수 행에 해당하는 줄은 강조해서 보여준다. */
function SheetTable({ rows, highlightRow }: { rows: string[][]; highlightRow: number | null }) {
    if (rows.length === 0) {
        return <p className="px-4 py-10 text-center text-xs text-gray-400">표에 읽을 내용이 없습니다.</p>
    }

    return (
        <table className="w-max border-collapse bg-white text-xs">
            <tbody>
                {rows.map((row, rowIndex) => {
                    const isHeader = rowIndex === 0
                    const isTarget = highlightRow !== null && rowIndex === highlightRow - 1
                    return (
                        <tr
                            key={rowIndex}
                            className={
                                isTarget ? "bg-primary-50" : isHeader ? "bg-gray-100 font-semibold text-gray-700" : ""
                            }
                        >
                            <td className="border border-gray-200 px-2 py-1 text-right text-[10px] text-gray-400">
                                {rowIndex + 1}
                            </td>
                            {row.map((cell, cellIndex) => (
                                <td
                                    key={cellIndex}
                                    className="max-w-60 truncate border border-gray-200 px-2 py-1 text-gray-800"
                                    title={cell}
                                >
                                    {cell}
                                </td>
                            ))}
                        </tr>
                    )
                })}
            </tbody>
        </table>
    )
}

interface SourcePreviewProps {
    /** 실제 업로드된 원본 파일명 — 미리보기 방식은 행의 `원본유형` 이 아니라 이 파일이 정한다. */
    fileName: string | null
    uploadRowNo: number | null
    ingestionId?: number | string
    uploadId?: number | null
}

export function SourcePreview({ fileName, uploadRowNo, ingestionId, uploadId }: SourcePreviewProps) {
    const [expanded, setExpanded] = useState(false)
    const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
    const [content, setContent] = useState<PreviewContent | null>(null)
    const [loadState, setLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle")

    const kind = useMemo(() => previewKindOf(fileName), [fileName])
    const canFetch = !!fileName && !!ingestionId && !!uploadId

    useEffect(() => {
        if (!expanded) return
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") setExpanded(false)
        }
        window.addEventListener("keydown", onKeyDown)
        return () => window.removeEventListener("keydown", onKeyDown)
    }, [expanded])

    /**
     * 원본은 화면에 들어오는 즉시 받아 온다 — 예전엔 눌러야 열리는 모달이었는데,
     * 검수는 원본을 옆에 띄워 놓고 값을 맞춰 보는 일이라 매번 여는 손이 남았다.
     */
    useEffect(() => {
        if (!canFetch) return
        let cancelled = false
        let createdUrl: string | null = null
        setLoadState("loading")
        setContent(null)

        ;(async () => {
            const blob = await getUploadContent(ingestionId!, uploadId!)
            // 서버가 octet-stream 으로 주면 브라우저가 렌더링 대신 다운로드로 떨어뜨린다 — 확장자로 다시 붙인다.
            const mime = MIME_BY_EXTENSION[extensionOf(fileName)]
            const typed = mime && blob.type !== mime ? blob.slice(0, blob.size, mime) : blob
            createdUrl = URL.createObjectURL(typed)
            if (cancelled) return

            setDownloadUrl(createdUrl)
            if (kind === "IMAGE") setContent({ kind: "IMAGE", url: createdUrl })
            else if (kind === "PDF") setContent({ kind: "PDF", pages: await renderPdfPages(await typed.arrayBuffer()) })
            else setContent({ kind: "TABLE", rows: await readSheet(typed, fileName) })
            if (!cancelled) setLoadState("ready")
        })().catch((e) => {
            console.error("source preview failed", e)
            if (!cancelled) setLoadState("error")
        })

        return () => {
            cancelled = true
            if (createdUrl) URL.revokeObjectURL(createdUrl)
            setDownloadUrl(null)
        }
    }, [canFetch, ingestionId, uploadId, fileName, kind])

    // 원본 파일이 없어도(수기 입력) 자리는 지킨다 — 여기서 사라지면 옆 카드의 검수값 행과 높이가 어긋난다.
    const viewerLabel = fileName ? KIND_LABEL[kind] : "원본 없음"
    const truncated = content?.kind === "TABLE" && content.rows.length >= SHEET_MAX_ROWS

    const surface = (className: string) => {
        if (!canFetch) {
            return (
                <div className={"flex flex-col items-center justify-center gap-2 bg-gray-50 text-gray-400 " + className}>
                    <FileTextIcon className="h-8 w-8" aria-hidden="true" />
                    <p className="text-xs">원본 파일 없음 (수기 등록 등)</p>
                </div>
            )
        }
        if (loadState === "error") {
            return (
                <div className={"flex flex-col items-center justify-center gap-2 bg-gray-50 text-gray-400 " + className}>
                    <AlertCircleIcon className="h-8 w-8 text-red-400" aria-hidden="true" />
                    <p className="text-xs">원본을 불러오지 못했습니다.</p>
                </div>
            )
        }
        if (content === null) {
            return (
                <div className={"flex flex-col items-center justify-center gap-2 bg-gray-50 text-gray-400 " + className}>
                    <Loader2Icon className="h-8 w-8 animate-spin text-primary" aria-hidden="true" />
                    <p className="text-xs">불러오는 중입니다.</p>
                </div>
            )
        }
        return (
            <PannableSurface
                content={content}
                highlightRow={kind === "TABLE" ? uploadRowNo : null}
                className={className}
            />
        )
    }

    return (
        <div className="border-b border-gray-100 px-5 py-4">
            <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-gray-600">원본 파일 프리뷰</p>
                <span className="text-xs text-gray-400">
                    {viewerLabel}
                    {content?.kind === "PDF" && content.pages.length > 1 && " · " + content.pages.length + "페이지"}
                    {truncated && " · 상위 " + SHEET_MAX_ROWS + "행"}
                </span>
            </div>

            <div className="mt-2 overflow-hidden rounded-xl border border-gray-200">
                {surface(PREVIEW_BODY_HEIGHT + " w-full")}
                <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-3 py-2">
                    <span className="min-w-0 truncate text-xs text-gray-600">
                        {fileName ?? <span className="text-gray-400">첨부된 원본 파일이 없습니다</span>}
                        {fileName && uploadRowNo !== null && (
                            <span className="text-gray-400">{" / " + uploadRowNo + "행"}</span>
                        )}
                    </span>
                    <div className="flex shrink-0 items-center gap-3">
                        {downloadUrl && (
                            <a
                                href={downloadUrl}
                                download={fileName ?? undefined}
                                className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-gray-900"
                            >
                                <DownloadIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                내려받기
                            </a>
                        )}
                        {fileName && (
                            <button
                                type="button"
                                onClick={() => setExpanded(true)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                            >
                                <MaximizeIcon className="h-3.5 w-3.5" aria-hidden="true" />
                                크게 보기
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {expanded && (
                <div
                    role="dialog"
                    aria-modal="true"
                    aria-label={viewerLabel + " 크게 보기"}
                    className="fixed inset-0 z-40 flex items-center justify-center bg-gray-900/50 p-4"
                    onClick={() => setExpanded(false)}
                >
                    <div
                        className="w-full max-w-5xl overflow-hidden rounded-xl bg-white"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                            <div className="min-w-0">
                                <h3 className="truncate text-sm font-semibold text-gray-900">{viewerLabel}</h3>
                                <p className="truncate text-xs text-gray-500">{fileName}</p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setExpanded(false)}
                                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
                                aria-label="닫기"
                            >
                                <XIcon className="h-4 w-4" aria-hidden="true" />
                            </button>
                        </div>
                        {surface("h-[78vh] w-full")}
                    </div>
                </div>
            )}
        </div>
    )
}
