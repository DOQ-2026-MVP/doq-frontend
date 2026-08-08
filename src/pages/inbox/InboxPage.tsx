import { useMemo, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AlertTriangleIcon, InboxIcon, Loader2Icon, SearchIcon } from "lucide-react"
import { useInspection } from "@/shared/context/useInspection"
import type { RecordStatus, BulkConfirmResult } from "@/shared/model/inspection"
import { formatText } from "@/shared/utils/format"
import { UPLOAD_METHOD_LABEL } from "@/shared/utils/labels"
import { ExceptionBadge } from "@/features/inspectionDetail/ui/ExceptionBadge"
import { RECORD_STATUS_LABEL, StatusBadge } from "@/features/intake/ui/StatusBadge"
import { ConfirmDialog } from "@/features/inbox/ui/ConfirmDialog"

type Filter = "ALL" | RecordStatus

const FILTERS: { value: Filter; label: string }[] = [
    { value: "ALL", label: "전체" },
    { value: "NEW", label: RECORD_STATUS_LABEL.NEW },
    { value: "CONFIRMED", label: RECORD_STATUS_LABEL.CONFIRMED },
    { value: "REJECTED", label: RECORD_STATUS_LABEL.REJECTED },
]

const COLUMNS = ["행 번호", "문서ID", "공급사", "원문 품목명", "정규화 품목명", "상태", "예외 유형", "업로드 방식"]

export function InboxPage() {
    const navigate = useNavigate()
    const [searchParams, setSearchParams] = useSearchParams()
    const { records, sessions, loadState, reload, bulkConfirm } = useInspection()

    const [keyword, setKeyword] = useState("")
    const [filter, setFilter] = useState<Filter>("ALL")
    const [dialogOpen, setDialogOpen] = useState(false)
    const [bulkResult, setBulkResult] = useState<BulkConfirmResult | null>(null)

    const inspections = useMemo(
        () =>
            sessions
                .filter((session) => session.inspectionId !== null)
                .map((session) => ({
                    inspectionId: session.inspectionId as string,
                    ingestionId: session.ingestionId,
                })),
        [sessions]
    )

    const paramInspectionId = searchParams.get("inspectionId")
    const activeInspectionId =
        paramInspectionId && inspections.some((i) => i.inspectionId === paramInspectionId)
            ? paramInspectionId
            : (inspections[0]?.inspectionId ?? null)

    const scoped = useMemo(
        () => records.filter((record) => record.inspectionId === activeInspectionId),
        [records, activeInspectionId]
    )

    const filtered = useMemo(() => {
        const query = keyword.trim().toLowerCase()
        return scoped.filter((record) => {
            const matchStatus = filter === "ALL" || record.status === filter
            const matchKeyword =
                query === "" ||
                [
                    record.current.docId,
                    record.current.supplier,
                    record.current.rawItemName,
                    record.current.normalizedItemName,
                ]
                    .join(" ")
                    .toLowerCase()
                    .includes(query)
            return matchStatus && matchKeyword
        })
    }, [scoped, keyword, filter])

    const newCount = scoped.filter((record) => record.status === "NEW").length

    function handleBulkConfirm() {
        if (!activeInspectionId) return
        const result = bulkConfirm(activeInspectionId)
        setBulkResult(result)
        setDialogOpen(false)
    }

    return (
        <div className="mx-auto w-full max-w-7xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900">검수 인박스</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        구조화된 검수 레코드를 조회합니다. 행을 클릭하면 검수 상세로 이동합니다.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    disabled={newCount === 0}
                    className={
                        "rounded-xl px-4 py-2 text-sm font-semibold " +
                        (newCount === 0
                            ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                            : "bg-blue-600 text-white hover:bg-blue-700")
                    }
                >
                    일괄 확정
                </button>
            </div>

            {bulkResult && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3" role="status">
                    <p className="text-sm font-semibold text-gray-900">검수 확정 완료</p>
                    <p className="mt-1 text-sm text-gray-600">
                        확정 {bulkResult.confirmed}건 · 필수값 누락으로 제외 {bulkResult.excluded}건
                    </p>
                </div>
            )}

            <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-200 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="flex items-center gap-2 text-xs text-gray-500">
                            검수 세션
                            <select
                                value={activeInspectionId ?? ""}
                                onChange={(event) => {
                                    setSearchParams({ inspectionId: event.target.value })
                                    setBulkResult(null)
                                }}
                                className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            >
                                {inspections.length === 0 && <option value="">없음</option>}
                                {inspections.map((item) => (
                                    <option key={item.inspectionId} value={item.inspectionId}>
                                        {item.inspectionId} (인입 #{item.ingestionId})
                                    </option>
                                ))}
                            </select>
                        </label>

                        <div className="relative w-full sm:w-64">
                            <SearchIcon
                                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                                aria-hidden="true"
                            />
                            <input
                                value={keyword}
                                onChange={(event) => setKeyword(event.target.value)}
                                placeholder="문서ID, 공급사, 품목명 검색"
                                aria-label="검수 레코드 검색"
                                className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="상태 필터">
                        {FILTERS.map((item) => (
                            <button
                                key={item.value}
                                type="button"
                                onClick={() => setFilter(item.value)}
                                aria-pressed={filter === item.value}
                                className={
                                    "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors " +
                                    (filter === item.value
                                        ? "bg-blue-600 text-white"
                                        : "border border-gray-300 bg-white text-gray-600 hover:bg-gray-50")
                                }
                            >
                                {item.label}
                            </button>
                        ))}
                    </div>
                </div>

                {loadState === "loading" && (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-gray-500">
                        <Loader2Icon className="h-5 w-5 animate-spin text-blue-600" aria-hidden="true" />
                        데이터를 불러오는 중입니다.
                    </div>
                )}

                {loadState === "error" && (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                        <AlertTriangleIcon className="h-6 w-6 text-red-500" aria-hidden="true" />
                        <p className="text-sm font-medium text-gray-900">데이터를 불러오지 못했습니다.</p>
                        <button
                            type="button"
                            onClick={reload}
                            className="mt-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            다시 시도
                        </button>
                    </div>
                )}

                {loadState === "ready" && scoped.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                        <InboxIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                        <p className="text-sm font-medium text-gray-900">검수 레코드가 없습니다.</p>
                        <p className="text-xs text-gray-500">
                            인입 세션에서 구조화를 실행하면 검수 레코드가 생성됩니다.
                        </p>
                    </div>
                )}

                {loadState === "ready" && scoped.length > 0 && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                        <SearchIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                        <p className="text-sm font-medium text-gray-900">검색 결과가 없습니다.</p>
                        <p className="text-xs text-gray-500">검색어 또는 상태 필터를 변경해 보세요.</p>
                    </div>
                )}

                {loadState === "ready" && filtered.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-270 text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50">
                                    {COLUMNS.map((column) => (
                                        <th
                                            key={column}
                                            scope="col"
                                            className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-500"
                                        >
                                            {column}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((record) => (
                                    <tr
                                        key={record.recordId}
                                        tabIndex={0}
                                        role="link"
                                        onClick={() => navigate("/inspection/" + record.recordId)}
                                        onKeyDown={(event) => {
                                            if (event.key === "Enter" || event.key === " ") {
                                                event.preventDefault()
                                                navigate("/inspection/" + record.recordId)
                                            }
                                        }}
                                        className="cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-blue-50/50 focus:bg-blue-50 focus:outline-none"
                                    >
                                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{record.rowNo}</td>
                                        <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">
                                            {record.current.docId}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                                            {record.current.supplier}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-700">
                                            {formatText(record.current.rawItemName)}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-900">
                                            {formatText(record.current.normalizedItemName)}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2.5">
                                            <StatusBadge status={record.status} />
                                        </td>
                                        <td className="px-4 py-2.5">
                                            {record.flags.length === 0 ? (
                                                <span className="text-gray-400">-</span>
                                            ) : (
                                                <div className="flex flex-wrap gap-1.5">
                                                    {record.flags.map((flag) => (
                                                        <ExceptionBadge key={flag} flag={flag} short />
                                                    ))}
                                                </div>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                                            {UPLOAD_METHOD_LABEL[record.uploadMethod]}
                                            {record.uploadMethod === "FILE" && record.uploadRowNo !== null && (
                                                <span className="ml-1 text-xs text-gray-400">
                                                    (업로드 {record.uploadRowNo}행)
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <ConfirmDialog
                open={dialogOpen}
                title="검수 가능한 항목을 모두 확정하시겠습니까?"
                description={"신규 상태 " + newCount + "건이 대상이며, 필수값 누락 레코드는 확정 대상에서 제외됩니다."}
                confirmLabel="일괄 확정"
                onCancel={() => setDialogOpen(false)}
                onConfirm={handleBulkConfirm}
            />
        </div>
    )
}
