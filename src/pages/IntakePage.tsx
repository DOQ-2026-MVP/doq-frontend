import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
import type { IngestionStatus, ResizeStatus } from "@/shared/model/inspection"
import { rememberIngestionId } from "@/shared/lib/useSelectedIngestionId"
import { formatDateTime } from "@/shared/utils/format"
import { needsResize, resizeFileIfNeeded } from "@/shared/utils/uploadRows"

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

/**
 * 브라우저가 기억하는 유일한 세션 정보 — "이 탭이 어느 세션을 작업 중인가".
 * 세션의 내용(업로드·수기 행·상태)은 전부 서버에서 받는다.
 */
const ACTIVE_SESSION_KEY = "doq.activeIngestionId"

const readActiveId = (): string | null => {
    try {
        return window.localStorage.getItem(ACTIVE_SESSION_KEY)
    } catch {
        return null
    }
}

const writeActiveId = (id: string | null) => {
    try {
        if (id === null) window.localStorage.removeItem(ACTIVE_SESSION_KEY)
        else window.localStorage.setItem(ACTIVE_SESSION_KEY, id)
    } catch {
        // 저장 실패는 치명적이지 않다 — 이번 세션 동안만 기억하지 못할 뿐이다.
    }
}

/** 등록 현황 한 줄 — 서버 현황(업로드 + 수기 행)에서 파생한다. 화면이 따로 들고 있지 않는다. */
type DerivedEntry = {
    entryId: string
    kind: "FILE" | "MANUAL"
    label: string
    createdAt: string
    resizeStatus: ResizeStatus
    uploadId?: number
    recordId?: number
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
    // 목록은 최신 세션부터 — 서버는 등록순으로 준다(그 순서에 기대는 곳이 있어 표시만 뒤집는다).
    const serverSessions = useMemo(() => [...(sessionsQuery.data ?? [])].reverse(), [sessionsQuery.data])
    const uploadMutation = useUpload()
    const uploadForMutation = useUploadFor()
    const postRecordsMutation = usePostRecords()
    const postRecordsGlobalMutation = usePostRecordsGlobal()
    const deleteUploadMutation = useDeleteUpload()
    const deleteRecordMutation = useDeleteRecord()
    const deleteAllRecordsMutation = useDeleteRecordsAll()
    const structuringMutation = useRunStructuring()

    const [tab, setTab] = useState<Tab>("FILE")
    const [files, setFiles] = useState<File[]>([])
    const [manual, setManual] = useState<ManualRecordInput>(EMPTY_MANUAL_INPUT)
    const [error, setError] = useState("")
    const [structuring, setStructuring] = useState(false)
    const [activeId, setActiveIdState] = useState<string | null>(() => readActiveId())
    const statusRef = useRef<HTMLElement>(null)

    const setActiveId = useCallback((id: string | null) => {
        setActiveIdState(id)
        writeActiveId(id)
    }, [])

    const activeIngestionId = activeId ?? undefined
    const ingestionDetailQuery = useIngestionDetail(activeIngestionId)
    const recordListQuery = useGetRecordsFor(activeIngestionId)
    useIngestionEvents(activeIngestionId, () => {
        queryClient.invalidateQueries({ queryKey: ["ingestion"] })
    })

    const detail = ingestionDetailQuery.data ?? null

    // 기억해 둔 세션이 서버에 없으면(삭제됨) 붙들고 있지 않는다 — 빈 화면으로 남는 것보다 낫다.
    useEffect(() => {
        if (activeId && ingestionDetailQuery.isSuccess && detail === null) setActiveId(null)
    }, [activeId, ingestionDetailQuery.isSuccess, detail, setActiveId])

    /**
     * 등록 현황 = 서버 현황. 업로드 1건 = 파일 항목, 수기 행 1건 = 수기 항목이고 등록 시각순으로 섞는다.
     * 예전엔 화면이 이 목록을 메모리에 들고 있어 새로고침하면 통째로 사라졌다.
     */
    const entries = useMemo<DerivedEntry[]>(() => {
        if (!detail) return []
        const files: DerivedEntry[] = (detail.uploads ?? []).map((upload) => ({
            entryId: "upload-" + upload.id,
            kind: "FILE",
            label: upload.fileName,
            createdAt: upload.createdAt ?? "",
            // 리사이징은 업로드 **전에** 끝난다 — 서버에 있다는 건 이미 처리됐다는 뜻이다.
            resizeStatus: needsResize(upload.fileName) ? "DONE" : "NONE",
            uploadId: upload.id,
        }))
        const manuals: DerivedEntry[] = (detail.manuals ?? []).map((record) => {
            const parts = [record.content?.docId, record.content?.rawItemName].filter(Boolean)
            return {
                entryId: "record-" + record.id,
                kind: "MANUAL",
                label: parts.length === 0 ? "수기 입력 항목" : parts.join(" · "),
                createdAt: record.createdAt,
                resizeStatus: "NONE",
                recordId: record.id,
            }
        })
        return [...files, ...manuals].sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    }, [detail])

    const activeStatus: IngestionStatus | null = structuring ? "STRUCTURING" : (detail?.status ?? null)

    async function handleRegister() {
        const hasFile = files.length > 0
        const hasManual = isManualInputFilled(manual)

        if (!hasFile && !hasManual) {
            setError(tab === "FILE" ? "등록할 파일을 선택해 주세요." : "문서ID를 입력해 주세요.")
            return
        }

        if (hasManual && !hasManualRequiredValue(manual)) {
            setError("문서ID를 입력해 주세요.")
            return
        }

        // 이어붙일 세션이 없거나(최초) 이미 끝난 세션이면 새로 만든다 — 새 세션은 서버가 만들어 id 를 준다.
        let ingestionId = detail?.status === "DRAFT" ? activeId : null
        let added = 0
        const failed: string[] = []

        // 업로드 API 는 파일 1건씩 받는다. 첫 건이 세션을 만들고 나머지는 그 세션에 이어붙인다.
        for (const picked of files) {
            const processed = await resizeFileIfNeeded(picked).catch(() => picked)
            try {
                if (ingestionId === null) {
                    const result = await uploadMutation.mutateAsync(processed)
                    ingestionId = String(result.ingestionId)
                    setActiveId(ingestionId)
                } else {
                    await uploadForMutation.mutateAsync({ ingestionId, file: processed })
                }
                added += 1
            } catch (e) {
                console.error("file upload failed", picked.name, e)
                failed.push(picked.name)
            }
        }
        setFiles([])

        if (hasManual) {
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
                if (ingestionId === null) {
                    const result = await postRecordsGlobalMutation.mutateAsync(rows)
                    ingestionId = String(result.ingestionId)
                    setActiveId(ingestionId)
                } else {
                    await postRecordsMutation.mutateAsync({ ingestionId, body: rows })
                }
                setManual(EMPTY_MANUAL_INPUT)
                added += 1
            } catch (e) {
                console.error("manual upload failed", e)
                toast.error("수기 입력 등록에 실패했습니다.")
            }
        }

        if (failed.length > 0) {
            toast.error(failed.length + "건을 등록하지 못했습니다: " + failed.join(", "))
        }
        if (added === 0) return

        setError("")
        queryClient.invalidateQueries({ queryKey: ["ingestion"] })
        toast.success(added + "건이 등록되었습니다")
        window.setTimeout(() => {
            statusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
        }, 60)
    }

    /** 실제 id 로 지운다 — 파생 엔트리가 업로드/원본 행 id 를 그대로 들고 있어 내용 매칭이 필요 없다. */
    async function handleRemoveEntry(entry: DerivedEntry) {
        if (!activeId) return
        try {
            if (entry.uploadId !== undefined) {
                await deleteUploadMutation.mutateAsync({
                    ingestionId: activeId,
                    uploadId: String(entry.uploadId),
                })
            } else if (entry.recordId !== undefined) {
                await deleteRecordMutation.mutateAsync({
                    ingestionId: activeId,
                    recordId: String(entry.recordId),
                })
            }
        } catch (e) {
            console.error("remove entry failed", e)
            toast.error("항목을 삭제하지 못했습니다.")
        }
    }

    async function handleClearAll() {
        if (!activeId) return
        try {
            await deleteAllRecordsMutation.mutateAsync(activeId)
        } catch (e) {
            console.error("clear all failed", e)
            toast.error("전체 삭제에 실패했습니다.")
        }
    }

    async function handleStart() {
        if (!activeId || entries.length === 0) return
        setStructuring(true)
        try {
            await structuringMutation.mutateAsync(activeId)
            await waitForStructured(activeId)
            await fetchInspections(activeId)
            // 방금 검수로 넘긴 세션을 검수 목록·내보내기가 이어받게 한다.
            rememberIngestionId(activeId)
            queryClient.invalidateQueries({ queryKey: ["inspection"] })
            queryClient.invalidateQueries({ queryKey: ["ingestion"] })
        } catch (e) {
            console.error("structuring failed", e)
            toast.error("검수 대상으로 전환하지 못했습니다.")
        } finally {
            setStructuring(false)
        }
    }

    const processing = activeStatus === "STRUCTURING"
    const structured = activeStatus === "STRUCTURED"
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
                            <FileDropZone onSelect={(picked) => setFiles((prev) => [...prev, ...picked])} />
                        </div>
                    ) : (
                        <div role="tabpanel" id="panel-MANUAL" aria-labelledby="tab-MANUAL">
                            <RawRecordForm idPrefix="intake" value={manual} onChange={setManual} />
                        </div>
                    )}

                    {files.length > 0 && (
                        <div className="mt-4 border-t border-gray-100 pt-4">
                            <div className="flex items-center justify-between">
                                <p className="text-xs text-gray-500">선택된 파일 {files.length}개 (등록 전)</p>
                                <button
                                    type="button"
                                    onClick={() => setFiles([])}
                                    className="text-xs font-medium text-gray-500 hover:text-gray-900"
                                >
                                    모두 지우기
                                </button>
                            </div>
                            <ul className="mt-2 space-y-2">
                                {files.map((picked, index) => (
                                    <li
                                        key={picked.name + "-" + picked.size + "-" + index}
                                        className="flex items-center gap-3 rounded-xl border border-gray-200 bg-surface px-3 py-2"
                                    >
                                        <FileSpreadsheetIcon
                                            className="h-4 w-4 shrink-0 text-primary"
                                            aria-hidden="true"
                                        />
                                        <span className="min-w-0 flex-1 truncate text-sm text-gray-900">
                                            {picked.name}
                                        </span>
                                        {needsResize(picked.name) && (
                                            <span className="shrink-0 text-[11px] text-gray-500">
                                                등록 시 10MB 이하로 리사이징
                                            </span>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFiles((prev) => prev.filter((_, at) => at !== index))
                                            }
                                            className="shrink-0 rounded-lg p-1 text-gray-400 hover:bg-white hover:text-gray-600"
                                            aria-label={picked.name + " 선택 해제"}
                                        >
                                            <XIcon className="h-4 w-4" aria-hidden="true" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
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
                        {activeId && (
                            <span className="font-normal text-gray-500">
                                {" | 등록 세션 #" + activeId}
                            </span>
                        )}
                    </h2>
                    {activeStatus && <IngestionStatusBadge status={activeStatus} />}
                    {activeStatus && (
                        <span className="text-sm text-gray-500">
                            항목 {entries.length}개
                            {serverRecordCount > 0 && ` · 서버 레코드 ${serverRecordCount}건`}
                        </span>
                    )}

                    {activeStatus && (
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
                            {activeStatus === "DRAFT" ? (
                                <>
                                    {entries.length > 0 && (
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
                                        disabled={entries.length === 0}
                                        className={
                                            "rounded-xl px-4 py-2 text-sm font-semibold " +
                                            (entries.length === 0
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
                                        onClick={() => navigate("/inbox?ingestionId=" + activeId)}
                                        className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-100"
                                    >
                                        검수 목록으로 이동
                                    </button>
                                )
                            )}
                        </div>
                    )}
                </div>

                {entries.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-gray-500">
                        등록된 항목이 없습니다. 파일 또는 수기 입력을 등록해 주세요.
                    </p>
                ) : (
                    <ul className="divide-y divide-gray-100">
                        {entries.map((entry) => (
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
                                {activeStatus === "DRAFT" && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveEntry(entry)}
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
                                serverSessions.map((session) => {
                                    // 구조화가 끝난 세션만 검수 대상이 있다 — 그 세션의 검수 목록으로 바로 보낸다.
                                    const openable = session.status === "STRUCTURED"
                                    return (
                                    <tr
                                        key={session.ingestionId}
                                        className={
                                            "border-b border-gray-100 last:border-b-0 " +
                                            (openable ? "cursor-pointer hover:bg-primary-50/60" : "")
                                        }
                                        onClick={
                                            openable
                                                ? () => navigate("/inbox?ingestionId=" + session.ingestionId)
                                                : undefined
                                        }
                                    >
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
                                    )
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
