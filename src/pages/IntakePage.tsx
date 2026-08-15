import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2Icon, FileSpreadsheetIcon, Loader2Icon, PencilLineIcon, XIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { FileDropZone } from "@/components/FileDropZone"
import {
    type ManualRecordInput,
    EMPTY_MANUAL_INPUT,
    isManualInputFilled,
    hasManualRequiredValue,
    RawRecordForm,
} from "@/components/RawRecordForm"
import { IngestionStatusBadge } from "@/components/StatusBadge"
import {
    useUpload,
    useUploadFor,
    usePostRecords,
    usePostRecordsGlobal,
    useIngestionDetail,
    useGetRecordsFor,
    useIngestionEvents,
    useDeleteUpload,
    useDeleteRecord,
    useDeleteRecordsAll,
    getIngestionDetail,
    useIngestionSessions,
} from "@/apis/ingestion"
import { useRunStructuring } from "@/apis/structuring"
import { fetchInspections } from "@/apis/inspection"
import { useInspection } from "@/shared/context/InspectionContext"
import type { IngestionEntry, ResizeStatus } from "@/shared/model/inspection"
import { formatDateTime } from "@/shared/utils/format"
import { needsResize, buildRowsFromFile, resizeFileIfNeeded } from "@/shared/utils/uploadRows"

/**
 * 구조화(POST /api/structuring)는 응답을 먼저 보내고 실제 인계(Inspection 생성)는 트랜잭션 커밋 후
 * 별도 스레드에서 비동기로 처리된다 — 응답만 받고 바로 검수 상세를 조회하면 아직 없어서 404가 난다.
 * ingestion.status가 STRUCTURED로 바뀔 때까지 짧게 폴링해서 기다린다.
 */
async function waitForStructured(ingestionId: string, timeoutMs = 20000, intervalMs = 600): Promise<void> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const detail = await getIngestionDetail(ingestionId)
        if (detail?.status === "STRUCTURED") return
        if (detail?.status === "FAILED") throw new Error("구조화 실패 (FAILED)")
        await new Promise((resolve) => window.setTimeout(resolve, intervalMs))
    }
    throw new Error("구조화 대기 시간 초과")
}

type Tab = "FILE" | "MANUAL"

const TABS: { value: Tab; label: string }[] = [
    { value: "FILE", label: "파일 업로드" },
    { value: "MANUAL", label: "수기 입력" },
]

function ResizeStatusTag({ status }: { status: ResizeStatus }) {
    if (status === "NONE") return null
    if (status === "PROCESSING") {
        return (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-orange-50 px-2 py-0.5 text-[11px] font-medium text-orange-700">
                <Loader2Icon className="h-3 w-3 animate-spin" aria-hidden="true" />
                리사이징 처리 중
            </span>
        )
    }
    return (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-medium text-green-700">
            <CheckCircle2Icon className="h-3 w-3" aria-hidden="true" />
            리사이징 완료
        </span>
    )
}

export function IntakePage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    // 세션 목록의 출처는 서버다 — 브라우저에 기억해 두면 새로고침·다른 기기에서 통째로 사라진다.
    const sessionsQuery = useIngestionSessions()
    const serverSessions = sessionsQuery.data ?? []
    const { createSession, addEntry, removeEntry, getSession, linkSession, setSessionStatus, markStructured } =
        useInspection()
    const uploadMutation = useUpload()
    const uploadForMutation = useUploadFor()
    const postRecordsMutation = usePostRecords()
    const postRecordsGlobalMutation = usePostRecordsGlobal()
    const deleteUploadMutation = useDeleteUpload()
    const deleteRecordMutation = useDeleteRecord()
    const deleteAllRecordsMutation = useDeleteRecordsAll()
    const structuringMutation = useRunStructuring()

    const [tab, setTab] = useState<Tab>("FILE")
    const [file, setFile] = useState<File | null>(null)
    const [manual, setManual] = useState<ManualRecordInput>(EMPTY_MANUAL_INPUT)
    const [error, setError] = useState("")
    const [activeId, setActiveId] = useState<string | null>(null)
    const statusRef = useRef<HTMLElement>(null)

    const activeIngestionId = activeId ?? undefined
    const activeSession = activeId ? getSession(activeId) : undefined
    const serverIngestionId = activeSession && !activeSession.isLocal ? activeIngestionId : undefined
    const ingestionDetailQuery = useIngestionDetail(serverIngestionId)
    const recordListQuery = useGetRecordsFor(serverIngestionId)
    useIngestionEvents(serverIngestionId, () => {
        queryClient.invalidateQueries({ queryKey: ["ingestion"] })
    })

    function ensureSession(): string {
        if (activeSession && activeSession.status === "DRAFT") {
            return activeSession.ingestionId
        }
        const session = createSession()
        setActiveId(session.ingestionId)
        return session.ingestionId
    }

    async function handleRegister() {
        const hasFile = file !== null
        const hasManual = isManualInputFilled(manual)

        if (!hasFile && !hasManual) {
            setError(tab === "FILE" ? "등록할 파일을 선택해 주세요." : "문서ID를 입력해 주세요.")
            return
        }

        if (hasManual && !hasManualRequiredValue(manual)) {
            setError("문서ID를 입력해 주세요.")
            return
        }

        let ingestionId = ensureSession()
        let isLocalSession = getSession(ingestionId)?.isLocal ?? true
        let added = 0

        if (file) {
            try {
                const processed = await resizeFileIfNeeded(file)
                const rows = buildRowsFromFile(processed)
                if (isLocalSession) {
                    // no server ingestion yet — upload to global endpoint (creates it) and link the id back
                    const result = await uploadMutation.mutateAsync(processed)
                    linkSession(ingestionId, String(result.ingestionId))
                    ingestionId = String(result.ingestionId)
                    isLocalSession = false
                    setActiveId(ingestionId)
                } else {
                    await uploadForMutation.mutateAsync({ ingestionId, file: processed })
                }
                addEntry(ingestionId, {
                    kind: "FILE",
                    label: processed.name,
                    needsResize: needsResize(processed.name),
                    rows,
                })
            } catch (e) {
                const fallbackRows = buildRowsFromFile(file)
                try {
                    if (isLocalSession) {
                        const result = await uploadMutation.mutateAsync(file)
                        linkSession(ingestionId, String(result.ingestionId))
                        ingestionId = String(result.ingestionId)
                        isLocalSession = false
                        setActiveId(ingestionId)
                    } else {
                        await uploadForMutation.mutateAsync({ ingestionId, file })
                    }
                } catch (uploadError) {
                    console.error("file upload failed", uploadError)
                }
                addEntry(ingestionId, {
                    kind: "FILE",
                    label: file.name,
                    needsResize: needsResize(file.name),
                    rows: fallbackRows,
                })
            }
            setFile(null)
            added += 1
        }

        if (hasManual) {
            const labelParts = [manual.docId.trim(), manual.rawItemName.trim()].filter((part) => part !== "")
            const rows = [
                {
                    ...manual,
                    docId: manual.docId.trim() === "" ? "문서ID 미입력" : manual.docId,
                    supplier: manual.supplier.trim() === "" ? "공급사 미입력" : manual.supplier,
                    uploadMethod: "MANUAL" as const,
                    uploadRowNo: null,
                    fileName: null,
                },
            ]

            try {
                if (isLocalSession) {
                    const result = await postRecordsGlobalMutation.mutateAsync(rows)
                    linkSession(ingestionId, String(result.ingestionId))
                    ingestionId = String(result.ingestionId)
                    isLocalSession = false
                    setActiveId(ingestionId)
                } else {
                    await postRecordsMutation.mutateAsync({ ingestionId, body: rows })
                }
            } catch (e) {
                console.error("manual upload failed", e)
            }

            addEntry(ingestionId, {
                kind: "MANUAL",
                label: labelParts.length === 0 ? "수기 입력 항목" : labelParts.join(" · "),
                rows,
            })
            setManual(EMPTY_MANUAL_INPUT)
            added += 1
        }

        setError("")
        toast.success(added + "건이 등록되었습니다")
        window.setTimeout(() => {
            statusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 60)
    }

    async function handleStart() {
        if (!activeSession || activeSession.entries.length === 0 || activeSession.isLocal) return
        const ingestionId = activeSession.ingestionId
        setSessionStatus(ingestionId, "STRUCTURING")
        try {
            await structuringMutation.mutateAsync(ingestionId)
            await waitForStructured(ingestionId)
            const detail = await fetchInspections(ingestionId)
            markStructured(ingestionId, String(detail.inspectionId))
            queryClient.invalidateQueries({ queryKey: ["inspection"] })
        } catch (e) {
            console.error("structuring failed", e)
            setSessionStatus(ingestionId, "DRAFT")
            toast.error("검수 대상으로 전환하지 못했습니다.")
        }
    }

    async function handleRemoveEntry(entryId: string, entry: IngestionEntry) {
        if (!activeSession) return

        const entryToRemove = activeSession.entries.find((item) => item.entryId === entryId)
        if (!entryToRemove) return

        if (entry.kind === "FILE") {
            const upload = ingestionDetailQuery.data?.uploads?.find(
                (item: { fileName?: string }) =>
                    item.fileName === entry.label || item.fileName === entryToRemove.label
            )
            if (upload?.id) {
                await deleteUploadMutation.mutateAsync({
                    ingestionId: activeSession.ingestionId,
                    uploadId: String(upload.id),
                })
            }
        } else if (Array.isArray(recordListQuery.data)) {
            // 수기 행의 원문은 content(캐노니컬 camelCase 9필드) 안에 있다 — 최상위엔 docId/rawItemName이 없다.
            const keyOf = (docId?: string | null, rawItemName?: string | null) =>
                [docId, rawItemName].filter(Boolean).join("|")
            const sourceKeys = (entry.rows ?? []).map((row) => keyOf(row?.docId, row?.rawItemName)).filter(Boolean)
            const matched = recordListQuery.data.find((item) =>
                sourceKeys.includes(keyOf(item.content?.docId, item.content?.rawItemName))
            )
            if (matched) {
                await deleteRecordMutation.mutateAsync({
                    ingestionId: activeSession.ingestionId,
                    recordId: String(matched.id),
                })
            }
        }

        removeEntry(activeSession.ingestionId, entryId)
    }

    async function handleClearAll() {
        if (!activeSession) return
        await deleteAllRecordsMutation.mutateAsync(activeSession.ingestionId)
        activeSession.entries.forEach((entry) => removeEntry(activeSession.ingestionId, entry.entryId))
    }

    const processing = activeSession?.status === "STRUCTURING"
    const structured = activeSession?.status === "STRUCTURED"
    const serverUploadCount = ingestionDetailQuery.data?.uploads?.length ?? 0
    const serverRecordCount = Array.isArray(recordListQuery.data) ? recordListQuery.data.length : 0

    return (
        <div className="mx-auto w-full max-w-5xl">
            <h1 className="text-xl font-semibold text-gray-900">구매 증빙 등록</h1>
            <p className="mt-1 text-sm text-gray-500">파일을 업로드하거나 직접 입력하여 검수 대상으로 등록합니다.</p>

            <section className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
                <div role="tablist" aria-label="등록 방식" className="flex gap-1 border-b border-gray-200 px-3 pt-3">
                    {TABS.map((item) => {
                        const selected = tab === item.value
                        return (
                            <button
                                key={item.value}
                                type="button"
                                role="tab"
                                id={"tab-" + item.value}
                                aria-selected={selected}
                                aria-controls={"panel-" + item.value}
                                onClick={() => {
                                    setTab(item.value)
                                    setError("")
                                }}
                                className={
                                    "rounded-t-lg border-b-2 px-4 py-2.5 text-sm font-medium transition-colors " +
                                    (selected
                                        ? "border-primary text-primary"
                                        : "border-transparent text-gray-500 hover:text-gray-900")
                                }
                            >
                                {item.label}
                            </button>
                        )
                    })}
                </div>

                <div className="p-5">
                    {tab === "FILE" ? (
                        <div role="tabpanel" id="panel-FILE" aria-labelledby="tab-FILE">
                            <p className="text-xs text-gray-500">
                                지원 형식: XLSX, CSV, PDF, PNG, JPEG · 파일은 여러 번 나눠 등록할 수 있습니다.
                            </p>
                            <p className="mb-4 mt-1 text-xs text-gray-400">
                                PNG, JPEG, PDF는 10MB 이하로 자동 리사이징됩니다.
                            </p>
                            <FileDropZone onChange={setFile} />
                        </div>
                    ) : (
                        <div role="tabpanel" id="panel-MANUAL" aria-labelledby="tab-MANUAL">
                            <RawRecordForm idPrefix="intake" value={manual} onChange={setManual} />
                        </div>
                    )}

                    {file && (
                        <div className="mt-4 border-t border-gray-100 pt-4">
                            <p className="text-xs text-gray-500">선택된 파일 (등록 전)</p>
                            <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-surface px-3 py-2">
                                <FileSpreadsheetIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{file.name}</span>
                                {needsResize(file.name) && (
                                    <span className="shrink-0 text-[11px] text-gray-500">
                                        등록 시 10MB 이하로 리사이징
                                    </span>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setFile(null)}
                                    className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-white hover:text-gray-600"
                                    aria-label="선택한 파일 제거"
                                >
                                    <XIcon className="h-4 w-4" aria-hidden="true" />
                                </button>
                            </div>
                        </div>
                    )}

                    {error && (
                        <p className="mt-4 text-sm text-red-600" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
                        <button
                            type="button"
                            onClick={handleRegister}
                            disabled={processing}
                            className={
                                "rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-100 " +
                                (processing
                                    ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                    : "bg-primary text-white hover:bg-primary-700")
                            }
                        >
                            등록
                        </button>
                    </div>
                </div>
            </section>

            <section
                ref={statusRef}
                aria-labelledby="session-title"
                className="mt-4 scroll-mt-20 rounded-xl border border-gray-200 bg-white shadow-sm"
            >
                <div className="flex flex-wrap items-center gap-3 border-b border-gray-200 px-5 py-4">
                    <h2 id="session-title" className="text-sm font-semibold text-gray-900">
                        등록 현황
                        {activeSession && (
                            <span className="font-normal text-gray-500">
                                {" | 등록 세션 #" + activeSession.ingestionId}
                            </span>
                        )}
                    </h2>
                    {activeSession && <IngestionStatusBadge status={activeSession.status} />}
                    {activeSession && (
                        <span className="text-sm text-gray-500">
                            항목 {Math.max(activeSession.entries.length, serverUploadCount)}개
                            {serverRecordCount > 0 && ` · 서버 레코드 ${serverRecordCount}건`}
                        </span>
                    )}

                    {activeSession && (
                        <div className="ml-auto flex flex-wrap items-center gap-3">
                            {processing && (
                                <span className="inline-flex items-center gap-2 text-sm text-gray-700" role="status">
                                    <Loader2Icon className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                                    검수 대상으로 처리 중...
                                </span>
                            )}
                            {structured && (
                                <span className="inline-flex items-center gap-2 text-sm text-gray-700" role="status">
                                    <CheckCircle2Icon className="h-4 w-4 text-green-600" aria-hidden="true" />
                                    검수 목록에 반영 완료
                                </span>
                            )}
                            {activeSession.status === "DRAFT" ? (
                                <>
                                    {activeSession.entries.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleClearAll}
                                            className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-100"
                                        >
                                            전체 삭제
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleStart}
                                        disabled={activeSession.entries.length === 0}
                                        className={
                                            "rounded-xl px-4 py-2 text-sm font-semibold " +
                                            (activeSession.entries.length === 0
                                                ? "cursor-not-allowed bg-gray-100 text-gray-400"
                                                : "bg-primary text-white hover:bg-primary-700")
                                        }
                                    >
                                        검수 시작
                                    </button>
                                </>
                            ) : (
                                structured && (
                                    <button
                                        type="button"
                                        onClick={() => navigate("/inbox")}
                                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
                                    >
                                        검수 목록으로 이동
                                    </button>
                                )
                            )}
                        </div>
                    )}
                </div>

                {!activeSession || activeSession.entries.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-gray-500">
                        등록된 항목이 없습니다. 파일 또는 수기 입력을 등록해 주세요.
                    </p>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {activeSession.entries.map((entry) => (
                            <li key={entry.entryId} className="flex items-center gap-3 px-5 py-3">
                                {entry.kind === "FILE" ? (
                                    <FileSpreadsheetIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                                ) : (
                                    <PencilLineIcon className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" />
                                )}
                                <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                                    {entry.kind === "FILE" ? entry.label + " 업로드됨" : entry.label}
                                </span>
                                <ResizeStatusTag status={entry.resizeStatus} />
                                <span className="shrink-0 text-xs text-gray-500">
                                    {formatDateTime(entry.createdAt)}
                                </span>
                                {activeSession.status === "DRAFT" && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveEntry(entry.entryId, entry)}
                                        className="shrink-0 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-surface"
                                    >
                                        취소
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </section>

            <section
                aria-labelledby="sessions-title"
                className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm"
            >
                <h2
                    id="sessions-title"
                    className="border-b border-gray-200 px-5 py-4 text-sm font-semibold text-gray-900"
                >
                    세션 목록
                </h2>
                <div className="overflow-x-auto">
                    <table className="w-full min-w-140 text-left text-sm">
                        <thead>
                            <tr className="border-b border-gray-200 bg-surface">
                                {["세션 ID", "처리 상태", "항목 수", "등록 시각"].map((column) => (
                                    <th
                                        key={column}
                                        scope="col"
                                        className="whitespace-nowrap px-5 py-3 text-xs font-semibold text-gray-500"
                                    >
                                        {column}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {serverSessions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-5 py-8 text-center text-sm text-gray-500">
                                        {sessionsQuery.isLoading
                                            ? "불러오는 중입니다."
                                            : sessionsQuery.isError
                                              ? "세션 목록을 불러오지 못했습니다."
                                              : "등록된 세션이 없습니다."}
                                    </td>
                                </tr>
                            ) : (
                                serverSessions.map((session) => (
                                    <tr key={session.ingestionId} className="border-b border-gray-100 last:border-b-0">
                                        <td className="whitespace-nowrap px-5 py-3 font-medium text-gray-900">
                                            등록 세션 #{session.ingestionId}
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3">
                                            <IngestionStatusBadge status={session.status} />
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3 text-gray-700">
                                            {session.recordCount}개
                                        </td>
                                        <td className="whitespace-nowrap px-5 py-3 text-gray-500">
                                            {formatDateTime(session.createdAt)}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
