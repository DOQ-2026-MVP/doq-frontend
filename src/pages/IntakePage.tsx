import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { CheckCircle2Icon, FileSpreadsheetIcon, Loader2Icon, PencilLineIcon, XIcon } from "lucide-react"
import { FileDropZone } from "@/components/FileDropZone"
import {
    type ManualRecordInput,
    EMPTY_MANUAL_INPUT,
    isManualInputFilled,
    RawRecordForm,
} from "@/components/RawRecordForm"
import { IngestionStatusBadge } from "@/components/StatusBadge"
import { useInspection } from "@/shared/context/InspectionContext"
import { formatDateTime } from "@/shared/utils/format"
import { buildRowsFromFile, needsResize } from "@/shared/utils/uploadRows"
import type { ResizeStatus } from "@/shared/model/inspection"

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
    const { sessions, createSession, addEntry, removeEntry, startInspection, getSession } = useInspection()

    const [tab, setTab] = useState<Tab>("FILE")
    const [file, setFile] = useState<File | null>(null)
    const [manual, setManual] = useState<ManualRecordInput>(EMPTY_MANUAL_INPUT)
    const [error, setError] = useState("")
    const [activeId, setActiveId] = useState<string | null>(null)
    const [finished, setFinished] = useState(false)

    const activeSession = activeId ? getSession(activeId) : undefined

    useEffect(() => {
        if (!finished) return
        const timer = window.setTimeout(() => navigate("/inbox"), 1200)
        return () => window.clearTimeout(timer)
    }, [finished, navigate])

    function ensureSession(): string {
        if (activeSession && activeSession.status === "DRAFT") {
            return activeSession.ingestionId
        }
        const session = createSession()
        setActiveId(session.ingestionId)
        setFinished(false)
        return session.ingestionId
    }

    function handleRegister() {
        if (tab === "FILE") {
            if (!file) {
                setError("등록할 파일을 선택해 주세요.")
                return
            }
            addEntry(ensureSession(), {
                kind: "FILE",
                label: file.name,
                needsResize: needsResize(file.name),
                rows: buildRowsFromFile(file),
            })
            setFile(null)
        } else {
            if (!isManualInputFilled(manual)) {
                setError("수기 입력 항목을 작성해 주세요.")
                return
            }
            addEntry(ensureSession(), {
                kind: "MANUAL",
                label: "수기 입력 항목",
                rows: [
                    {
                        ...manual,
                        docId: manual.docId.trim() === "" ? "문서ID 미입력" : manual.docId,
                        supplier: manual.supplier.trim() === "" ? "공급사 미입력" : manual.supplier,
                        uploadMethod: "MANUAL",
                        uploadRowNo: null,
                        fileName: null,
                    },
                ],
            })
            setManual(EMPTY_MANUAL_INPUT)
        }
        setError("")
    }

    async function handleStart() {
        if (!activeSession || activeSession.entries.length === 0) return
        await startInspection(activeSession.ingestionId)
        setFinished(true)
    }

    const processing = activeSession?.status === "STRUCTURING"
    const structured = activeSession?.status === "STRUCTURED"

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

                    {error && (
                        <p className="mt-4 text-sm text-red-600" role="alert">
                            {error}
                        </p>
                    )}

                    <div className="mt-5 flex justify-end border-t border-gray-100 pt-4">
                        <button
                            type="button"
                            onClick={handleRegister}
                            disabled={processing || structured}
                            className={
                                "rounded-xl px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary-100 " +
                                (processing || structured
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
                aria-labelledby="session-title"
                className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm"
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
                        <span className="text-sm text-gray-500">항목 {activeSession.entries.length}개</span>
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
                                        onClick={() => removeEntry(activeSession.ingestionId, entry.entryId)}
                                        className="shrink-0 rounded-lg border border-gray-300 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-surface"
                                    >
                                        취소
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}

                {file && (
                    <div className="border-t border-gray-100 px-5 py-3">
                        <p className="text-xs text-gray-500">선택된 파일 (등록 전)</p>
                        <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-surface px-3 py-2">
                            <FileSpreadsheetIcon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                            <span className="min-w-0 flex-1 truncate text-sm text-gray-900">{file.name}</span>
                            {needsResize(file.name) && (
                                <span className="shrink-0 text-[11px] text-gray-500">등록 시 10MB 이하로 리사이징</span>
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

                {activeSession && (
                    <div className="flex flex-wrap items-center justify-end gap-3 border-t border-gray-200 px-5 py-4">
                        {processing && (
                            <span
                                className="mr-auto inline-flex items-center gap-2 text-sm text-gray-700"
                                role="status"
                            >
                                <Loader2Icon className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                                검수 대상으로 처리 중...
                            </span>
                        )}
                        {structured && (
                            <span
                                className="mr-auto inline-flex items-center gap-2 text-sm text-gray-700"
                                role="status"
                            >
                                <CheckCircle2Icon className="h-4 w-4 text-green-600" aria-hidden="true" />
                                검수 목록에 반영 완료
                            </span>
                        )}
                        {activeSession.status === "DRAFT" ? (
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
                        ) : (
                            structured && (
                                <button
                                    type="button"
                                    onClick={() => navigate("/inbox")}
                                    className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-surface"
                                >
                                    검수 목록으로 이동
                                </button>
                            )
                        )}
                    </div>
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
                            {sessions.map((session) => (
                                <tr key={session.ingestionId} className="border-b border-gray-100 last:border-b-0">
                                    <td className="whitespace-nowrap px-5 py-3 font-medium text-gray-900">
                                        등록 세션 #{session.ingestionId}
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3">
                                        <IngestionStatusBadge status={session.status} />
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3 text-gray-700">
                                        {session.entries.length}개
                                    </td>
                                    <td className="whitespace-nowrap px-5 py-3 text-gray-500">
                                        {formatDateTime(session.createdAt)}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    )
}
