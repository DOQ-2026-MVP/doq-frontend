import React, { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import { AlertTriangleIcon, CheckIcon, InboxIcon, Loader2Icon, SearchIcon } from "lucide-react"
import { toast } from "sonner"
import { useInspectionsByIngestion, useConfirmRecord, type InspectionRecordDto } from "@/apis/inspection"
import { Pagination } from "@/components/Pagination"
import { pageSliceOf, totalPagesOf } from "@/shared/lib/paging"
import { SessionPicker } from "@/components/SessionPicker"
import { useSelectedIngestionId } from "@/shared/lib/useSelectedIngestionId"
import { ExceptionBadge } from "@/components/ExceptionBadge"
import { RECORD_STATUS_LABEL, StatusBadge } from "@/components/StatusBadge"
import type { ExceptionFlag, RecordStatus } from "@/shared/model/inspection"
import { deriveDisplayStatus } from "@/shared/utils/structuring"
import { formatText, formatPrice } from "@/shared/utils/format"
import { UPLOAD_METHOD_LABEL } from "@/shared/utils/labels"

const FILTERS: RecordStatus[] = ["NEEDS_CHECK", "NEEDS_HOLD", "APPROVABLE", "APPROVED", "REJECTED"]

/**
 * 목록에서 곧바로 승인할 수 있는 건 예외가 하나도 없는 `승인 가능` 뿐이다.
 *
 * 확인 필요(필수값 누락)는 보완 전까지 승인 자체가 막혀 있고, 보류 필요 3종(중복·규격·단위)은
 * 담당자가 상세에서 근거를 확인해 해소하거나 사유를 남기고 수용해야 한다 — 목록 체크박스로
 * 검토 없이 통과시키면 안 된다. 승인/반려는 이미 결론이 난 건이다.
 */
const SELECTABLE_STATUSES: RecordStatus[] = ["APPROVABLE"]

interface Column {
    key: string
    label: React.ReactNode
}

const COLUMNS: Column[] = [
    { key: "docId", label: "문서ID" },
    { key: "supplier", label: "공급사" },
    {
        key: "itemName",
        label: (
            <>
                품목명 (정규화 / <span className="font-normal text-gray-400">원문</span>)
            </>
        ),
    },
    { key: "spec", label: "규격" },
    { key: "unit", label: "단위" },
    {
        key: "price",
        label: (
            <>
                단가 (변경 / <span className="font-normal text-gray-400">기존</span>)
            </>
        ),
    },
    { key: "effectiveDate", label: "적용일" },
    { key: "status", label: "상태" },
    { key: "flags", label: "예외 유형" },
]

type InboxRecord = {
    /** 검수 레코드 PK — /inspection/records/{id} 계열 API가 받는 값 (ingestionRecordId는 인입 원본 행 FK라 여기 쓰면 안 된다). */
    id: string
    inspectionId: string
    ingestionId: string
    rowNo: number
    uploadMethod: "FILE" | "MANUAL"
    uploadRowNo: number | null
    fileName: string | null
    observed: {
        docId: string
        sourceType: string
        supplier: string
        rawItemName: string
        normalizedItemName: string
        spec: string
        unit: string
        priceBefore: string
        priceAfter: string
        effectiveDate: string
    }
    current: {
        docId: string
        sourceType: string
        supplier: string
        rawItemName: string
        normalizedItemName: string
        spec: string
        unit: string
        priceBefore: string
        priceAfter: string
        effectiveDate: string
    }
    status: RecordStatus
    flags: ExceptionFlag[]
    changelog: unknown[]
}

function normalizeInspectionRows(
    data: InspectionRecordDto[] | undefined,
    ingestionId: string,
    inspectionId: number | undefined
): InboxRecord[] {
    const list = Array.isArray(data) ? data : []

    return list.map((row) => {
        const flags = (Array.isArray(row.flags) ? row.flags : []) as ExceptionFlag[]
        const toValues = (values: InspectionRecordDto["current"]) => ({
            docId: values?.docId ?? "",
            sourceType: String(values?.sourceType ?? "MANUAL").toUpperCase(),
            supplier: values?.supplier ?? "",
            rawItemName: values?.rawItemName ?? "",
            normalizedItemName: values?.normalizedItemName ?? values?.rawItemName ?? "",
            spec: values?.spec ?? "",
            unit: values?.unit ?? "",
            priceBefore: values?.priceBefore ?? "",
            priceAfter: values?.priceAfter ?? "",
            effectiveDate: values?.effectiveDate ?? "",
        })

        return {
            id: String(row.id),
            inspectionId: String(inspectionId ?? ""),
            ingestionId,
            rowNo: row.rowNo ?? 1,
            uploadMethod: row.uploadType ? ("FILE" as const) : ("MANUAL" as const),
            uploadRowNo: row.rowNo ?? null,
            fileName: null,
            observed: toValues(row.observed),
            current: toValues(row.current),
            status: deriveDisplayStatus(row.status, flags),
            flags,
            changelog: [],
        }
    })
}

export function InboxPage() {
    const navigate = useNavigate()
    // 검수는 등록 세션 단위다 — 대상 세션은 URL 이 들고 있고, 아래 선택기로 바꾼다.
    const { ingestionId, select, isLoading: sessionsLoading } = useSelectedIngestionId()
    const inspectionQuery = useInspectionsByIngestion(ingestionId ?? undefined)
    const inspectionId = inspectionQuery.data?.inspectionId
    const records = useMemo<InboxRecord[]>(
        () => normalizeInspectionRows(inspectionQuery.data?.records, ingestionId ?? "", inspectionId),
        [inspectionQuery.data, ingestionId, inspectionId]
    )
    const loadState =
        sessionsLoading || inspectionQuery.isLoading ? "loading" : inspectionQuery.isError ? "error" : "ready"
    const reload = () => inspectionQuery.refetch()

    const confirmRecordMutation = useConfirmRecord()

    /**
     * 세션 전체에서 예외 없는 항목만 모은다 — 목록의 일괄 승인 대상.
     *
     * 서버의 검수 단위 일괄 확정(POST /inspection/{id}/confirm)은 필수값 누락만 걸러내고
     * 보류 필요까지 통과시켜서 쓰지 않는다. 예외 건은 상세에서 한 건씩 판단해야 한다.
     */
    const approvable = useMemo(() => records.filter((record) => record.status === "APPROVABLE"), [records])

    async function confirmMany(ids: string[]) {
        const results = await Promise.allSettled(
            ids.map((recordId) => confirmRecordMutation.mutateAsync({ recordId }))
        )
        const succeeded = results.filter((result) => result.status === "fulfilled").length
        return { succeeded, failed: results.length - succeeded }
    }

    function reportConfirmResult(succeeded: number, failed: number) {
        if (failed === 0) toast.success(succeeded + "건이 승인되었습니다")
        else if (succeeded === 0) toast.error("승인에 실패했습니다.")
        else toast.success(succeeded + "건 승인되었습니다 (" + failed + "건 실패)")
    }

    async function handleConfirmAll() {
        const ids = approvable.map((record) => record.id)
        if (ids.length === 0) return
        const { succeeded, failed } = await confirmMany(ids)
        setSelected(new Set())
        reportConfirmResult(succeeded, failed)
    }

    // 체크박스로 고른 건만 승인한다 — "전체 승인"은 세션의 승인 가능 항목 전부를 대상으로 하므로,
    // 일부만 먼저 내보내고 싶을 때는 이쪽을 쓴다.
    const [selected, setSelected] = useState<Set<string>>(new Set())

    useEffect(() => {
        setSelected(new Set())
    }, [ingestionId])

    function toggleSelected(id: string) {
        setSelected((prev) => {
            const next = new Set(prev)
            if (next.has(id)) next.delete(id)
            else next.add(id)
            return next
        })
    }

    async function handleConfirmSelected() {
        const ids = [...selected]
        if (ids.length === 0) return
        const { succeeded, failed } = await confirmMany(ids)
        setSelected(new Set())
        reportConfirmResult(succeeded, failed)
    }

    /**
     * 검색어·상태 필터·페이지도 URL 에 둔다 — 검수 상세에 다녀와도 보던 화면 그대로 돌아오고,
     * 새로고침·링크 공유에서도 유지된다.
     */
    const [searchParams, setSearchParams] = useSearchParams()

    const urlKeyword = searchParams.get("q") ?? ""
    const statusFilters = useMemo(() => {
        const raw = searchParams.get("status")
        return raw ? (raw.split(",").filter(Boolean) as RecordStatus[]) : []
    }, [searchParams])

    const page = Math.max(1, Number(searchParams.get("page") ?? 1) || 1)

    const patchParams = (changes: Record<string, string | null>, options?: { replace?: boolean }) =>
        setSearchParams((prev) => {
            const next = new URLSearchParams(prev)

            Object.entries(changes).forEach(([key, value]) => {
                if (value === null || value === "") next.delete(key)
                else next.set(key, value)
            })

            return next
        }, options)

    /**
     * 검색어는 화면 state 로 들고, URL 반영만 뒤로 미룬다.
     *
     * URL 을 곧바로 input 의 value 로 쓰면 한 글자마다 라우터 네비게이션이 돌고,
     * 라우터는 그 갱신을 startTransition 으로 미룬다. 그 사이 React 가 조합 중인
     * input 에 낡은 value 를 되써넣으면 브라우저가 IME 조합을 강제로 확정해버린다.
     * "가온푸드" 가 "ㄱ가강오온ㅍ푸푿드" 로 찍히던 원인.
     */
    const [keyword, setKeyword] = useState(urlKeyword)
    const syncedKeyword = useRef(urlKeyword)

    // 뒤로가기·링크 진입처럼 URL 이 바깥에서 바뀐 경우에만 입력창을 되맞춘다.
    useEffect(() => {
        if (urlKeyword === syncedKeyword.current) return
        syncedKeyword.current = urlKeyword
        setKeyword(urlKeyword)
    }, [urlKeyword])

    // 타이핑이 멎으면 URL 에 반영한다. replace 로 — 글자마다 히스토리가 쌓이면 뒤로가기가 막힌다.
    useEffect(() => {
        if (keyword === syncedKeyword.current) return
        const timer = setTimeout(() => {
            syncedKeyword.current = keyword
            // 조건이 바뀌면 1페이지로 — 필터를 좁혔는데 빈 페이지에 남아 있으면 안 된다.
            patchParams({ q: keyword, page: null }, { replace: true })
        }, 200)
        return () => clearTimeout(timer)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [keyword])

    // 아직 URL 에 안 실린 검색어까지 얹어서 상세로 넘긴다 — 타이핑 직후 행을 눌러도 검색어가 살아 돌아온다.
    const detailQuery = useMemo(() => {
        const next = new URLSearchParams(searchParams)
        if (keyword) next.set("q", keyword)
        else next.delete("q")
        return next.toString()
    }, [searchParams, keyword])

    /**
     * 검수 대상으로 반영된 순서를 그대로 유지하고(새 항목은 맨 뒤),
     * 전체 목록 기준으로 이어지는 일련번호를 부여한다.
     */
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

    const totalPages = totalPagesOf(filtered.length)
    const { start, end } = pageSliceOf(page)
    const paged = useMemo(() => filtered.slice(start, end), [filtered, start, end])

    // 헤더 체크박스는 "이 페이지에서 고를 수 있는 행"만 기준으로 켜고 끈다 — 다른 페이지의 선택은 건드리지 않는다.
    const selectableOnPage = useMemo(
        () => paged.filter(({ record }) => SELECTABLE_STATUSES.includes(record.status)),
        [paged]
    )
    const allOnPageSelected =
        selectableOnPage.length > 0 && selectableOnPage.every(({ record }) => selected.has(record.id))

    function toggleSelectAllOnPage() {
        setSelected((prev) => {
            const next = new Set(prev)
            if (allOnPageSelected) selectableOnPage.forEach(({ record }) => next.delete(record.id))
            else selectableOnPage.forEach(({ record }) => next.add(record.id))
            return next
        })
    }

    // 필터 결과가 줄어 현재 페이지가 사라지면 마지막 페이지로 당긴다.
    useEffect(() => {
        if (page > totalPages) patchParams({ page: totalPages > 1 ? String(totalPages) : null }, { replace: true })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page, totalPages])

    function toggleStatus(status: RecordStatus) {
        const next = statusFilters.includes(status)
            ? statusFilters.filter((item) => item !== status)
            : [...statusFilters, status]
        patchParams({ status: next.join(","), page: null })
    }

    return (
        <div className="mx-auto w-full max-w-7xl">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h1 className="text-xl font-semibold text-gray-900">검수 목록</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        등록 세션 단위로 검수합니다. 행을 클릭하면 검수 상세로 이동합니다.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <SessionPicker ingestionId={ingestionId} onSelect={select} />
                    {selected.size > 0 && (
                        <button
                            type="button"
                            onClick={() => void handleConfirmSelected()}
                            disabled={confirmRecordMutation.isPending}
                            className={
                                "shrink-0 rounded-xl border px-4 py-2 text-sm font-semibold " +
                                (confirmRecordMutation.isPending
                                    ? "cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400"
                                    : "border-primary bg-white text-primary hover:bg-primary-50")
                            }
                        >
                            {confirmRecordMutation.isPending
                                ? "선택 승인 중..."
                                : "선택 승인 (" + selected.size + ")"}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => void handleConfirmAll()}
                        disabled={approvable.length === 0 || confirmRecordMutation.isPending}
                        title="예외가 없는 승인 가능 항목만 승인합니다. 확인 필요·보류 필요 항목은 검수 상세에서 처리해 주세요."
                        className={
                            "shrink-0 rounded-xl px-4 py-2 text-sm font-semibold " +
                            (approvable.length === 0 || confirmRecordMutation.isPending
                                ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                                : "bg-primary text-white hover:bg-primary-700")
                        }
                    >
                        {confirmRecordMutation.isPending
                            ? "승인 중..."
                            : "승인 가능 전체 승인 (" + approvable.length + ")"}
                    </button>
                </div>
            </div>

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
                            onClick={() => patchParams({ status: null, page: null })}
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
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-295 text-left text-sm">
                                <thead>
                                    <tr className="border-b border-gray-200 bg-surface">
                                        <th
                                            scope="col"
                                            className="sticky left-0 z-20 w-11 border-r border-gray-200 bg-surface px-3 py-3"
                                        >
                                            <input
                                                type="checkbox"
                                                aria-label="이 페이지에서 승인 가능한 항목 전체 선택"
                                                checked={allOnPageSelected}
                                                disabled={selectableOnPage.length === 0}
                                                onChange={toggleSelectAllOnPage}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary-100"
                                            />
                                        </th>
                                        {COLUMNS.map((column, index) => (
                                            <th
                                                key={column.key}
                                                scope="col"
                                                className={
                                                    "whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-500 " +
                                                    (index === 0
                                                        ? "sticky left-11 z-20 border-r border-gray-200 bg-surface"
                                                        : "")
                                                }
                                            >
                                                {column.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>

                                <tbody>
                                    {paged.map(({ record, displayNo }) => {
                                        const normalizedChanged =
                                            record.current.normalizedItemName !== record.current.rawItemName

                                        const goToDetail = () =>
                                            navigate("/inspection/" + record.id + "?" + detailQuery)

                                        return (
                                            <tr
                                                key={record.id}
                                                tabIndex={0}
                                                role="link"
                                                onClick={goToDetail}
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter" || event.key === " ") {
                                                        event.preventDefault()
                                                        goToDetail()
                                                    }
                                                }}
                                                className="group cursor-pointer border-b border-gray-100 last:border-b-0 hover:bg-primary-50/60 focus:bg-primary-50 focus:outline-none"
                                            >
                                                <td
                                                    className="sticky left-0 z-10 w-11 border-r border-gray-100 bg-white px-3 py-3 group-hover:bg-primary-50 group-focus:bg-primary-50"
                                                    onClick={(event) => event.stopPropagation()}
                                                >
                                                    {SELECTABLE_STATUSES.includes(record.status) ? (
                                                        <input
                                                            type="checkbox"
                                                            aria-label={record.current.docId + " 선택"}
                                                            checked={selected.has(record.id)}
                                                            onChange={() => toggleSelected(record.id)}
                                                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary-100"
                                                        />
                                                    ) : (
                                                        <span className="block h-4 w-4" aria-hidden="true" />
                                                    )}
                                                </td>
                                                <td className="sticky left-11 z-10 whitespace-nowrap border-r border-gray-100 bg-white px-4 py-3 group-hover:bg-primary-50 group-focus:bg-primary-50">
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
                                                        {formatText(record.current.supplier)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3">
                                                    <div className="max-w-55">
                                                        <span
                                                            title={record.current.normalizedItemName}
                                                            className={
                                                                "block truncate text-sm font-medium text-gray-900 " +
                                                                (normalizedChanged
                                                                    ? "rounded-md bg-gold-50 px-1.5 py-0.5"
                                                                    : "")
                                                            }
                                                        >
                                                            {formatText(record.current.normalizedItemName)}
                                                        </span>

                                                        <span
                                                            title={record.current.rawItemName}
                                                            className={
                                                                "mt-0.5 block truncate text-xs text-gray-400 " +
                                                                (normalizedChanged ? "px-1.5" : "")
                                                            }
                                                        >
                                                            {formatText(record.current.rawItemName)}
                                                        </span>
                                                    </div>
                                                </td>

                                                <td className="px-4 py-3 text-gray-700">
                                                    <span
                                                        title={record.current.spec}
                                                        className="block max-w-40 truncate"
                                                    >
                                                        {formatText(record.current.spec)}
                                                    </span>
                                                </td>

                                                <td className="px-4 py-3 text-gray-700">
                                                    <span
                                                        title={record.current.unit}
                                                        className="block max-w-20 truncate"
                                                    >
                                                        {formatText(record.current.unit)}
                                                    </span>
                                                </td>

                                                <td className="whitespace-nowrap px-4 py-3">
                                                    <span className="block text-sm font-medium text-gray-900">
                                                        {formatPrice(record.current.priceAfter)}
                                                    </span>

                                                    <span className="mt-0.5 block text-xs text-gray-400">
                                                        {formatPrice(record.current.priceBefore)}
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
                                                            {record.flags.map((flag: string) => (
                                                                <ExceptionBadge key={flag} flag={flag as any} short />
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
                        <Pagination
                            page={page}
                            totalCount={filtered.length}
                            onChange={(next) => patchParams({ page: next > 1 ? String(next) : null })}
                        />
                    </>
                )}
            </div>
        </div>
    )
}
