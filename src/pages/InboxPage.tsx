import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { AlertTriangleIcon, ArrowRightIcon, CheckIcon, InboxIcon, Loader2Icon, SearchIcon } from "lucide-react"
import { ExceptionBadge } from "@/components/ExceptionBadge"
import { RECORD_STATUS_LABEL, StatusBadge } from "@/components/StatusBadge"
import { useInspection } from "@/shared/context/InspectionContext"
import type { RecordStatus } from "@/shared/model/inspection"
import { formatText, formatPrice } from "@/shared/utils/format"
import { UPLOAD_METHOD_LABEL } from "@/shared/utils/labels"

const FILTERS: RecordStatus[] = ["NEW", "NEEDS_CHECK", "NEEDS_HOLD", "APPROVABLE", "APPROVED", "REJECTED"]

const COLUMNS = [
    "문서ID",
    "공급사",
    "품목명 (원문 → 정규화)",
    "규격",
    "단위",
    "단가 (기존 → 변경)",
    "적용일",
    "상태",
    "예외 유형",
]

export function InboxPage() {
    const navigate = useNavigate()
    const { records, loadState, reload } = useInspection()

    const [keyword, setKeyword] = useState("")
    const [statusFilters, setStatusFilters] = useState<RecordStatus[]>([])

    const numbered = useMemo(() => records.map((record, index) => ({ record, displayNo: index + 1 })), [records])

    const filtered = useMemo(() => {
        const query = keyword.trim().toLowerCase()
        return numbered.filter(({ record }) => {
            const matchStatus = statusFilters.length === 0 || statusFilters.includes(record.status)
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
    }, [numbered, keyword, statusFilters])

    function toggleStatus(status: RecordStatus) {
        setStatusFilters((prev) => (prev.includes(status) ? prev.filter((item) => item !== status) : [...prev, status]))
    }

    return (
        <div className="mx-auto w-full max-w-7xl">
            <h1 className="text-xl font-semibold text-gray-900">검수 목록</h1>
            <p className="mt-1 text-sm text-gray-500">
                구조화된 검수 대상을 조회합니다. 행을 클릭하면 검수 상세로 이동합니다.
            </p>

            <div className="mt-6 rounded-xl border border-gray-200 bg-white shadow-sm">
                <div className="flex flex-col gap-3 border-b border-gray-200 p-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative w-full xl:max-w-xs">
                        <SearchIcon
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
                            aria-hidden="true"
                        />
                        <input
                            value={keyword}
                            onChange={(event) => setKeyword(event.target.value)}
                            placeholder="문서ID, 공급사, 품목명 검색"
                            aria-label="검수 대상 검색"
                            className="w-full rounded-xl border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
                        />
                    </div>

                    <div
                        className="flex flex-wrap items-center gap-1.5"
                        role="group"
                        aria-label="상태 필터 (다중 선택)"
                    >
                        <button
                            type="button"
                            onClick={() => setStatusFilters([])}
                            aria-pressed={statusFilters.length === 0}
                            className={
                                "rounded-xl px-3 py-1.5 text-xs font-medium transition-colors " +
                                (statusFilters.length === 0
                                    ? "bg-primary text-white"
                                    : "border border-gray-300 bg-white text-gray-600 hover:bg-surface")
                            }
                        >
                            전체
                        </button>
                        {FILTERS.map((status) => {
                            const selected = statusFilters.includes(status)
                            return (
                                <button
                                    key={status}
                                    type="button"
                                    onClick={() => toggleStatus(status)}
                                    aria-pressed={selected}
                                    className={
                                        "inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium transition-colors " +
                                        (selected
                                            ? "border border-primary bg-primary-50 text-primary"
                                            : "border border-gray-300 bg-white text-gray-600 hover:bg-surface")
                                    }
                                >
                                    {selected && <CheckIcon className="h-3 w-3" aria-hidden="true" />}
                                    {RECORD_STATUS_LABEL[status]}
                                </button>
                            )
                        })}
                    </div>
                </div>

                {loadState === "loading" && (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-sm text-gray-500">
                        <Loader2Icon className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
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
                            className="mt-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-surface"
                        >
                            다시 시도
                        </button>
                    </div>
                )}

                {loadState === "ready" && records.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                        <InboxIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                        <p className="text-sm font-medium text-gray-900">검수 대상이 없습니다.</p>
                        <p className="text-xs text-gray-500">
                            등록 화면에서 구매 증빙을 등록하고 검수를 시작해 주세요.
                        </p>
                    </div>
                )}

                {loadState === "ready" && records.length > 0 && filtered.length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
                        <SearchIcon className="h-6 w-6 text-gray-400" aria-hidden="true" />
                        <p className="text-sm font-medium text-gray-900">검색 결과가 없습니다.</p>
                        <p className="text-xs text-gray-500">검색어 또는 상태 필터를 변경해 보세요.</p>
                    </div>
                )}

                {loadState === "ready" && filtered.length > 0 && (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-295 text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-surface">
                                    {COLUMNS.map((column, index) => (
                                        <th
                                            key={column}
                                            scope="col"
                                            className={
                                                "whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-500 " +
                                                (index === 0
                                                    ? "sticky left-0 z-20 border-r border-gray-200 bg-surface"
                                                    : "")
                                            }
                                        >
                                            {column}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map(({ record, displayNo }) => {
                                    const normalizedChanged =
                                        record.current.normalizedItemName !== record.current.rawItemName
                                    return (
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
                                            className="group cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-primary-50/60 focus:bg-primary-50 focus:outline-none"
                                        >
                                            <td className="sticky left-0 z-10 whitespace-nowrap border-r border-gray-100 bg-white px-4 py-3 group-hover:bg-primary-50 group-focus:bg-primary-50">
                                                <div className="flex max-w-60 items-baseline gap-2">
                                                    <span className="shrink-0 text-xs text-gray-400">
                                                        {String(displayNo).padStart(2, "0")}
                                                    </span>
                                                    <span
                                                        title={record.current.docId}
                                                        className="truncate text-sm font-semibold text-gray-900"
                                                    >
                                                        {record.current.docId}
                                                    </span>
                                                    <span className="shrink-0 text-xs text-gray-400">
                                                        {UPLOAD_METHOD_LABEL[record.uploadMethod]}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">
                                                <span
                                                    title={record.current.supplier}
                                                    className="block max-w-40 truncate"
                                                >
                                                    {record.current.supplier}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex max-w-90 items-center gap-1.5">
                                                    <span
                                                        title={record.current.rawItemName}
                                                        className="min-w-0 truncate text-gray-500"
                                                    >
                                                        {formatText(record.current.rawItemName)}
                                                    </span>
                                                    <ArrowRightIcon
                                                        className="h-3.5 w-3.5 shrink-0 text-gray-400"
                                                        aria-hidden="true"
                                                    />
                                                    <span
                                                        title={record.current.normalizedItemName}
                                                        className={
                                                            "min-w-0 truncate text-gray-900 " +
                                                            (normalizedChanged
                                                                ? "rounded-md bg-gold-50 px-1.5 py-0.5 font-medium"
                                                                : "")
                                                        }
                                                    >
                                                        {formatText(record.current.normalizedItemName)}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">
                                                <span title={record.current.spec} className="block max-w-40 truncate">
                                                    {formatText(record.current.spec)}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-gray-700">
                                                <span title={record.current.unit} className="block max-w-20 truncate">
                                                    {formatText(record.current.unit)}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <span className="text-gray-500">
                                                    {formatPrice(record.current.priceBefore)}
                                                </span>
                                                <ArrowRightIcon
                                                    className="mx-1.5 inline h-3.5 w-3.5 text-gray-400"
                                                    aria-hidden="true"
                                                />
                                                <span className="font-medium text-gray-900">
                                                    {formatPrice(record.current.priceAfter)}
                                                </span>
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                                                {formatText(record.current.effectiveDate)}
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                <StatusBadge status={record.status} />
                                            </td>
                                            <td className="whitespace-nowrap px-4 py-3">
                                                {record.flags.length === 0 ? (
                                                    <span className="text-gray-400">-</span>
                                                ) : (
                                                    <div className="flex gap-1.5">
                                                        {record.flags.map((flag) => (
                                                            <ExceptionBadge key={flag} flag={flag} short />
                                                        ))}
                                                    </div>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    )
}
