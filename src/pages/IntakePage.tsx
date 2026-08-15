import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { CheckCircle2Icon, FileSpreadsheetIcon, Loader2Icon, PencilLineIcon, PlusIcon } from "lucide-react"
import { useQueryClient } from "@tanstack/react-query"
import { FileDropZone } from "@/components/FileDropZone"
import {
    type ManualFieldErrors,
    type ManualRecordInput,
    EMPTY_MANUAL_INPUT,
    isManualInputFilled,
    hasManualRequiredValue,
    RawRecordForm,
} from "@/components/RawRecordForm"
import { IngestionStatusBadge } from "@/components/StatusBadge"
import {
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
    postUpload,
    postUploadFor,
} from "@/apis/ingestion"
import { useRunStructuring } from "@/apis/structuring"
import { fetchInspections } from "@/apis/inspection"
import type { IngestionStatus } from "@/shared/model/inspection"
import { parseApiError } from "@/shared/api/api.base"
import { rememberIngestionId } from "@/shared/lib/useSelectedIngestionId"
import { formatDateTime } from "@/shared/utils/format"
import { resizeFileIfNeeded } from "@/shared/utils/uploadRows"

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

/**
 * 등록 현황 한 줄의 진행 상태.
 *
 * `SENDING` 만 화면이 아는 값이다(브라우저 → 서버 전송 중). 서버에 닿은 뒤로는 업로드의 실제
 * 상태를 그대로 쓴다 — 파싱 진행은 현황 스트림이 밀어준다.
 */
type EntryStatus = "SENDING" | "PARSING" | "PARSED" | "FAILED" | "NONE"

const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
    SENDING: "업로드 중",
    PARSING: "처리 중",
    PARSED: "업로드 완료",
    FAILED: "실패",
    NONE: "",
}

const ENTRY_STATUS_STYLE: Record<EntryStatus, string> = {
    SENDING: "bg-primary-50 text-primary ring-primary-100",
    PARSING: "bg-orange-50 text-orange-700 ring-orange-200",
    PARSED: "bg-green-50 text-green-700 ring-green-200",
    FAILED: "bg-red-50 text-red-700 ring-red-200",
    NONE: "",
}

function EntryStatusBadge({ status }: { status: EntryStatus }) {
    if (status === "NONE") return null
    return (
        <span
            className={
                "inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset " +
                ENTRY_STATUS_STYLE[status]
            }
        >
            {ENTRY_STATUS_LABEL[status]}
        </span>
    )
}

/** 등록 현황 한 줄 — 서버 현황(업로드 + 수기 행)에서 파생한다. 화면이 따로 들고 있지 않는다. */
type DerivedEntry = {
    entryId: string
    kind: "FILE" | "MANUAL"
    label: string
    createdAt: string
    status: EntryStatus
    /** 전송 진행률(0~100). SENDING 일 때만 의미가 있다. */
    percent?: number
    failureReason?: string | null
    uploadId?: number
    recordId?: number
}

/** 아직 서버에 닿지 않은 전송 — 응답이 오면 서버 현황이 이 자리를 대신한다. */
type SendingUpload = { key: string; fileName: string; percent: number }

type Tab = "FILE" | "MANUAL"

const TABS: { value: Tab; label: string }[] = [
    { value: "FILE", label: "파일 업로드" },
    { value: "MANUAL", label: "수기 입력" },
]

export function IntakePage() {
    const navigate = useNavigate()
    const queryClient = useQueryClient()
    // 세션 목록의 출처는 서버다 — 브라우저에 기억해 두면 새로고침·다른 기기에서 통째로 사라진다.
    const sessionsQuery = useIngestionSessions()
    // 목록은 최신 세션부터 — 서버는 등록순으로 준다(그 순서에 기대는 곳이 있어 표시만 뒤집는다).
    const serverSessions = useMemo(() => [...(sessionsQuery.data ?? [])].reverse(), [sessionsQuery.data])
    const postRecordsMutation = usePostRecords()
    const postRecordsGlobalMutation = usePostRecordsGlobal()
    const deleteUploadMutation = useDeleteUpload()
    const deleteRecordMutation = useDeleteRecord()
    const deleteAllRecordsMutation = useDeleteRecordsAll()
    const structuringMutation = useRunStructuring()

    const [tab, setTab] = useState<Tab>("FILE")
    const [manual, setManual] = useState<ManualRecordInput>(EMPTY_MANUAL_INPUT)
    // 검증 실패는 칸별로 — 어느 칸이 왜 막혔는지는 그 칸 아래에서만 말한다.
    const [manualErrors, setManualErrors] = useState<ManualFieldErrors>({})
    // 어느 칸에도 붙지 않는 실패(네트워크·서버 오류)만 폼 아래 한 줄로 남는다.
    const [error, setError] = useState("")
    const [structuring, setStructuring] = useState(false)
    const [sending, setSending] = useState<SendingUpload[]>([])
    const [activeId, setActiveIdState] = useState<string | null>(() => readActiveId())
    const statusRef = useRef<HTMLElement>(null)

    const setActiveId = useCallback((id: string | null) => {
        setActiveIdState(id)
        writeActiveId(id)
    }, [])

    const activeIngestionId = activeId ?? undefined
    const ingestionDetailQuery = useIngestionDetail(activeIngestionId)
    const recordListQuery = useGetRecordsFor(activeIngestionId)
    useIngestionEvents(activeIngestionId)

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
        const files: DerivedEntry[] = (detail?.uploads ?? []).map((upload) => ({
            entryId: "upload-" + upload.id,
            kind: "FILE",
            label: upload.fileName,
            createdAt: upload.createdAt ?? "",
            status: (upload.status as EntryStatus) ?? "PARSING",
            failureReason: upload.failureReason ?? null,
            uploadId: upload.id,
        }))
        const manuals: DerivedEntry[] = (detail?.manuals ?? []).map((record) => {
            const parts = [record.content?.docId, record.content?.rawItemName].filter(Boolean)
            return {
                entryId: "record-" + record.id,
                kind: "MANUAL",
                label: parts.length === 0 ? "수기 입력 항목" : parts.join(" · "),
                createdAt: record.createdAt,
                status: "NONE",
                recordId: record.id,
            }
        })
        // 아직 전송 중인 것은 서버 현황에 없다 — 맨 뒤에 붙여 진행률을 보여준다.
        const pending: DerivedEntry[] = sending.map((item) => ({
            entryId: "sending-" + item.key,
            kind: "FILE",
            label: item.fileName,
            createdAt: "",
            status: "SENDING",
            percent: item.percent,
        }))
        return [...[...files, ...manuals].sort((a, b) => a.createdAt.localeCompare(b.createdAt)), ...pending]
    }, [detail, sending])

    const activeStatus: IngestionStatus | null = structuring ? "STRUCTURING" : (detail?.status ?? null)

    /**
     * 파일은 고르는 즉시 올린다 — 등록 버튼을 한 번 더 누를 이유가 없다.
     * 업로드 API 는 1건씩 받으므로 순서대로, 첫 건이 세션을 만들고 나머지는 그 세션에 이어붙인다.
     */
    async function handleFilesSelected(picked: File[]) {
        setError("")
        let ingestionId = detail?.status === "DRAFT" ? activeId : null
        const failed: string[] = []

        for (const file of picked) {
            const key = file.name + "-" + file.size + "-" + Date.now() + Math.random()
            setSending((prev) => [...prev, { key, fileName: file.name, percent: 0 }])
            const onProgress = (percent: number) =>
                setSending((prev) => prev.map((item) => (item.key === key ? { ...item, percent } : item)))

            try {
                const processed = await resizeFileIfNeeded(file).catch(() => file)
                if (ingestionId === null) {
                    const result = await postUpload(processed, onProgress)
                    ingestionId = String(result.ingestionId)
                    setActiveId(ingestionId)
                } else {
                    await postUploadFor(ingestionId, processed, onProgress)
                }
            } catch (e) {
                console.error("file upload failed", file.name, e)
                failed.push(file.name)
            } finally {
                setSending((prev) => prev.filter((item) => item.key !== key))
            }
        }

        queryClient.invalidateQueries({ queryKey: ["ingestion"] })
        if (failed.length > 0) toast.error(failed.length + "건을 올리지 못했습니다: " + failed.join(", "))
        const uploaded = picked.length - failed.length
        if (uploaded > 0) {
            toast.success(uploaded + "건이 등록되었습니다")
            window.setTimeout(() => statusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
        }
    }

    /** 수기 입력 등록 — 파일과 달리 다 채운 뒤 눌러야 하므로 버튼이 남는다. */
    async function handleRegisterManual() {
        if (!isManualInputFilled(manual) || !hasManualRequiredValue(manual)) {
            setError("")
            setManualErrors({ docId: "문서ID를 입력해 주세요." })
            return
        }

        const ingestionId = detail?.status === "DRAFT" ? activeId : null
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
                setActiveId(String(result.ingestionId))
            } else {
                await postRecordsMutation.mutateAsync({ ingestionId, body: rows })
            }
            setManual(EMPTY_MANUAL_INPUT)
            setManualErrors({})
            setError("")
            queryClient.invalidateQueries({ queryKey: ["ingestion"] })
            toast.success("1건이 등록되었습니다")
            window.setTimeout(() => statusRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60)
        } catch (e) {
            console.error("manual upload failed", e)

            // 사유는 전부 화면 안에 남긴다 — 칸을 특정할 수 있으면 그 칸 아래에, 아니면 폼 아래 한 줄로.
            // 토스트에는 "실패했다"는 사실만 남긴다(필드 오류는 절대 싣지 않는다).
            const fallback = "수기 입력 등록에 실패했습니다."
            const { fields, message } = parseApiError(e, "")
            setManualErrors(fields as ManualFieldErrors)
            setError(message)
            toast.error(fallback)
        }
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

    /**
     * 새 등록 세션으로 갈아탄다 — 지금 세션은 서버에 그대로 남고(세션 목록에서 다시 열 수 있다)
     * 이 화면만 빈 상태로 돌아간다. 다음에 올리는 파일·수기 행이 새 세션을 만든다.
     */
    function handleNewSession() {
        setActiveId(null)
        setManual(EMPTY_MANUAL_INPUT)
        setManualErrors({})
        setError("")
        toast.success("새 등록 세션을 시작합니다.")
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
                                    setManualErrors({})
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
                            <p className="text-xs text-gray-500">지원 형식: XLSX, CSV, PDF, PNG, JPEG</p>
                            <p className="mb-4 mt-1 text-xs text-gray-400">
                                PNG, JPEG, PDF는 10MB 이하로 자동 리사이징됩니다.
                            </p>
                            <FileDropZone onSelect={(picked) => void handleFilesSelected(picked)} />
                        </div>
                    ) : (
                        <div role="tabpanel" id="panel-MANUAL" aria-labelledby="tab-MANUAL">
                            <RawRecordForm
                                idPrefix="intake"
                                value={manual}
                                errors={manualErrors}
                                onChange={(next) => {
                                    // 손댄 칸의 오류는 즉시 걷는다 — 고치는 중에도 빨간 줄이 남아 있으면 무엇이 남았는지 흐려진다.
                                    setManualErrors((prev) => {
                                        const cleared = Object.fromEntries(
                                            Object.entries(prev).filter(
                                                ([field]) =>
                                                    next[field as keyof ManualRecordInput] ===
                                                    manual[field as keyof ManualRecordInput]
                                            )
                                        )
                                        return cleared as ManualFieldErrors
                                    })
                                    setManual(next)
                                }}
                            />
                        </div>
                    )}

                    {error && (
                        <p className="mt-4 whitespace-pre-line text-sm text-red-600" role="alert">
                            {error}
                        </p>
                    )}

                    {tab === "MANUAL" && (
                        <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
                            <button
                                type="button"
                                onClick={handleRegisterManual}
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
                    )}
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
                        {activeId && <span className="font-normal text-gray-500">{" | 등록 세션 #" + activeId}</span>}
                    </h2>
                    {activeStatus && <IngestionStatusBadge status={activeStatus} />}
                    {activeStatus && (
                        <span className="text-sm text-gray-500">
                            항목 {entries.length}개{serverRecordCount > 0 && ` · 서버 레코드 ${serverRecordCount}건`}
                        </span>
                    )}

                    {activeStatus && (
                        <div className="ml-auto flex flex-wrap items-center gap-3">
                            <button
                                type="button"
                                onClick={handleNewSession}
                                disabled={processing}
                                className={
                                    "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium " +
                                    (processing
                                        ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                                        : "border-gray-300 bg-white text-gray-700 hover:bg-surface")
                                }
                            >
                                <PlusIcon className="h-4 w-4" aria-hidden="true" />
                                신규 세션
                            </button>
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
                                <div className="min-w-0 flex-1">
                                    <span className="block truncate text-sm text-gray-900">{entry.label}</span>
                                    {entry.status === "SENDING" && (
                                        <span
                                            role="progressbar"
                                            aria-valuenow={entry.percent ?? 0}
                                            aria-valuemin={0}
                                            aria-valuemax={100}
                                            aria-label={entry.label + " 업로드 진행률"}
                                            className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-gray-200"
                                        >
                                            <span
                                                className="block h-full rounded-full bg-primary transition-[width] duration-150"
                                                style={{ width: (entry.percent ?? 0) + "%" }}
                                            />
                                        </span>
                                    )}
                                    {entry.status === "PARSING" && (
                                        <span className="mt-1.5 block h-1 w-full overflow-hidden rounded-full bg-orange-100">
                                            <span className="block h-full w-1/3 animate-pulse rounded-full bg-orange-400" />
                                        </span>
                                    )}
                                    {entry.status === "FAILED" && entry.failureReason && (
                                        <span className="mt-0.5 block truncate text-xs text-red-600">
                                            {entry.failureReason}
                                        </span>
                                    )}
                                </div>
                                <EntryStatusBadge status={entry.status} />
                                <span className="shrink-0 text-xs text-gray-500">
                                    {entry.status === "SENDING"
                                        ? (entry.percent ?? 0) + "%"
                                        : formatDateTime(entry.createdAt)}
                                </span>
                                {activeStatus === "DRAFT" && entry.status !== "SENDING" && (
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
