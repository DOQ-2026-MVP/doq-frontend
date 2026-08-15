import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeftIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { ExceptionBadge } from "@/components/ExceptionBadge"
import { MemoDialog } from "@/components/MemoDialog"
import { SourcePreview } from "@/components/SourcePreview"
import { StatusBadge } from "@/components/StatusBadge"
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog"
import {
    useInspectionsByIngestion,
    useRecordChangelog,
    usePatchRecord,
    useConfirmRecord,
    useRejectRecord,
} from "@/apis/inspection"
import { useGetRecordsFor, useIngestionDetail } from "@/apis/ingestion"
import type { InspectionRecordDto } from "@/apis/inspection/types"
import type { ExceptionFlag, InspectionValues, SourceType } from "@/shared/model/inspection"
import { deriveDisplayStatus } from "@/shared/utils/structuring"
import { formatPrice, formatText, formatDateTime } from "@/shared/utils/format"
import { FIELD_LABEL, SOURCE_TYPE_LABEL } from "@/shared/utils/labels"

const FIELD_ORDER: (keyof InspectionValues)[] = [
    "docId",
    "sourceType",
    "supplier",
    "rawItemName",
    "spec",
    "unit",
    "priceBefore",
    "priceAfter",
    "effectiveDate",
    "normalizedItemName",
]

const PRICE_FIELDS: (keyof InspectionValues)[] = ["priceBefore", "priceAfter"]

const CHANGE_TYPE_LABEL: Record<string, string> = {
    EDIT: "수정",
    CONFIRM: "승인",
    REJECT: "반려",
}

const BACKEND_STATUS_LABEL: Record<string, string> = {
    NEW: "신규",
    CONFIRMED: "승인",
    REJECTED: "반려",
}

const FIELD_CLASS =
    "w-full rounded-xl border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"

type PendingAction = "BACK" | "CONFIRM" | "REJECT" | "REVIEW"

function toValues(values: InspectionRecordDto["current"]): InspectionValues {
    return {
        docId: values?.docId ?? "",
        sourceType: (values?.sourceType ?? "MANUAL") as SourceType,
        supplier: values?.supplier ?? "",
        rawItemName: values?.rawItemName ?? "",
        spec: values?.spec ?? "",
        unit: values?.unit ?? "",
        priceBefore: values?.priceBefore ?? "",
        priceAfter: values?.priceAfter ?? "",
        effectiveDate: values?.effectiveDate ?? "",
        normalizedItemName: values?.normalizedItemName ?? values?.rawItemName ?? "",
    }
}

export function InspectionDetailPage() {
    // URL/CRUD의 식별자는 검수 레코드 PK(dto.id)다. dto.ingestionRecordId는 인입 원본 행 FK라 API 경로에 쓰면 안 된다.
    const { id } = useParams<{ id: string }>()
    const [searchParams] = useSearchParams()
    const navigate = useNavigate()
    const queryClient = useQueryClient()

    // 어느 세션의 검수인지는 URL 이 들고 있다 — 예전엔 목록에서 넘긴 location.state 라 새로고침하면 잃었다.
    const sessionIngestionId = searchParams.get("ingestionId") ?? undefined
    const detailQuery = useInspectionsByIngestion(sessionIngestionId)
    const changelogQuery = useRecordChangelog(id)
    const patchMutation = usePatchRecord()
    const confirmMutation = useConfirmRecord()
    const rejectMutation = useRejectRecord()

    const dto = useMemo(
        () => detailQuery.data?.records.find((item) => String(item.id) === id),
        [detailQuery.data, id]
    )
    const ingestionId = detailQuery.data?.ingestionId
    const inspectionId = detailQuery.data?.inspectionId

    // 원본 파일 미리보기용 — 여기서만 dto.ingestionRecordId(인입 원본 행 id)를 쓴다. 검수 API 경로에는 dto.id를 쓴다.
    const rawRecordsQuery = useGetRecordsFor(ingestionId)
    const uploadId = useMemo(
        () => rawRecordsQuery.data?.find((item) => item.id === dto?.ingestionRecordId)?.uploadId ?? null,
        [rawRecordsQuery.data, dto]
    )
    // 미리보기 방식은 실제 업로드된 파일이 정한다 — 행의 `원본유형` 컬럼과 다를 수 있다
    // (취합 CSV 한 장에서 나온 행의 원본유형이 PDF 로 적혀 있는 식).
    const ingestionDetailQuery = useIngestionDetail(ingestionId)
    const uploadFileName = useMemo(
        () => ingestionDetailQuery.data?.uploads?.find((item) => item.id === uploadId)?.fileName ?? null,
        [ingestionDetailQuery.data, uploadId]
    )

    const record = useMemo(() => {
        if (!dto) return undefined
        const flags = (Array.isArray(dto.flags) ? dto.flags : []) as ExceptionFlag[]
        return {
            id: String(dto.id),
            rowNo: dto.rowNo ?? 1,
            uploadMethod: dto.uploadType ? ("FILE" as const) : ("MANUAL" as const),
            uploadRowNo: dto.rowNo ?? null,
            fileName: null as string | null,
            observed: toValues(dto.observed),
            current: toValues(dto.current),
            status: deriveDisplayStatus(dto.status, flags),
            flags,
        }
    }, [dto])

    const [draft, setDraft] = useState<InspectionValues | null>(null)
    const [memoDialog, setMemoDialog] = useState<null | "CONFIRM" | "REJECT" | "REVIEW">(null)
    const [unsaved, setUnsaved] = useState<PendingAction | null>(null)
    const loadedRecordId = useRef<string | undefined>(undefined)

    useEffect(() => {
        if (loadedRecordId.current === id && draft !== null) return
        if (!record) return
        loadedRecordId.current = id
        setDraft(record.current)
        setMemoDialog(null)
        setUnsaved(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, record, draft])

    const isDirty = useMemo(() => {
        if (!record || !draft) return false
        return FIELD_ORDER.some((field) => record.current[field] !== draft[field])
    }, [record, draft])

    if (detailQuery.isLoading) {
        return (
            <div className="mx-auto flex w-full max-w-3xl items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-500 shadow-sm">
                <Loader2Icon className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
                불러오는 중입니다.
            </div>
        )
    }

    if (!record || !draft) {
        return (
            <div className="mx-auto w-full max-w-3xl rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-medium text-gray-900">검수 레코드를 찾을 수 없습니다.</p>
                <button
                    type="button"
                    onClick={() => navigate("/inbox")}
                    className="mt-4 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                    검수 목록으로 이동
                </button>
            </div>
        )
    }

    // 목록에서 달고 온 쿼리를 그대로 되돌려준다 — 세션뿐 아니라 검색어·상태 필터·페이지까지.
    // ingestionId 만 다시 조립하면 나머지가 버려져 목록이 초기화된 채로 돌아간다.
    const inboxQuery = searchParams.toString()
    const inboxPath = inboxQuery === "" ? "/inbox" : "/inbox?" + inboxQuery
    const missingRequired = record.flags.includes("MISSING_REQUIRED")

    function invalidateInspection() {
        queryClient.invalidateQueries({ queryKey: ["inspection", "list", sessionIngestionId] })
        queryClient.invalidateQueries({ queryKey: ["inspection", "list"] })
        queryClient.invalidateQueries({ queryKey: ["inspection", "changelog", id] })
    }

    async function handleSave() {
        if (!record || !draft) return
        try {
            await patchMutation.mutateAsync({ recordId: record.id, body: draft })
            invalidateInspection()
            toast.success("수정되었습니다.")
        } catch (e) {
            console.error(e)
            toast.error("수정에 실패했습니다.")
        }
    }

    function requestAction(action: PendingAction) {
        if (action === "CONFIRM" && missingRequired) return
        if (isDirty) {
            setUnsaved(action)
            return
        }
        runAction(action)
    }

    function runAction(action: PendingAction) {
        if (action === "BACK") {
            navigate(inboxPath)
            return
        }
        setMemoDialog(action)
    }

    async function handleMemoSubmit(memo: string) {
        if (!memoDialog || !record) return

        try {
            if (memoDialog === "CONFIRM") {
                await confirmMutation.mutateAsync({ recordId: record.id, memo })
                invalidateInspection()
                toast.success("검수가 승인되었습니다.")
                setMemoDialog(null)
                navigate(inboxPath)
            } else {
                // "재검토"도 실제로는 반려(reject) API로 처리한다 — 반려가 편집 잠금을 푸는 유일한 전이다.
                await rejectMutation.mutateAsync({ recordId: record.id, memo })
                invalidateInspection()
                toast.success(memoDialog === "REVIEW" ? "재검토 대상으로 되돌렸습니다." : "검수가 반려되었습니다.")
                setMemoDialog(null)
                if (memoDialog === "REJECT") navigate(inboxPath)
            }
        } catch (e) {
            console.error(e)
            toast.error("요청을 처리하지 못했습니다.")
        }
    }

    return (
        <div className="mx-auto w-full max-w-7xl pb-28">
            <button
                type="button"
                onClick={() => requestAction("BACK")}
                className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
            >
                <ArrowLeftIcon className="h-4 w-4" aria-hidden="true" />
                검수 목록
            </button>

            <div className="mt-3 flex flex-wrap items-center gap-3">
                <h1 className="text-xl font-semibold text-gray-900">검수 상세</h1>
                <span className="text-sm font-medium text-gray-700">{record.current.docId}</span>
                <StatusBadge status={record.status} />
                {record.flags.map((flag) => (
                    <ExceptionBadge key={flag} flag={flag} />
                ))}
                <span className="text-sm text-gray-500">
                    행 번호 {record.rowNo} · 인입 #{ingestionId} · 검수 #{inspectionId}
                </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
                        <h2 className="text-sm font-semibold text-gray-900">관찰값 / 원본</h2>
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">읽기 전용</span>
                    </div>
                    <p className="border-b border-gray-100 bg-gray-50 px-5 py-2 text-xs text-gray-600">
                        원본 ·{" "}
                        <span className="font-medium text-gray-800">
                            {record.uploadMethod === "FILE" ? record.uploadRowNo + "행" : "수기 입력"}
                        </span>
                    </p>
                    <SourcePreview
                        fileName={uploadFileName}
                        uploadRowNo={record.uploadRowNo}
                        ingestionId={ingestionId}
                        uploadId={uploadId}
                    />
                    <dl className="divide-y divide-gray-100 px-5">
                        {FIELD_ORDER.map((field) => (
                            <div key={field} className="grid grid-cols-3 gap-3 py-2.5">
                                <dt className="text-xs text-gray-500">{FIELD_LABEL[field]}</dt>
                                <dd className="col-span-2 text-sm text-gray-900">
                                    {field === "sourceType"
                                        ? (SOURCE_TYPE_LABEL[record.observed.sourceType] ?? record.observed.sourceType)
                                        : PRICE_FIELDS.includes(field)
                                          ? formatPrice(record.observed[field])
                                          : formatText(record.observed[field])}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </section>

                <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
                        <h2 className="text-sm font-semibold text-gray-900">현재 검수값</h2>
                        {isDirty && (
                            <span className="rounded-md bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                                저장 전 변경사항
                            </span>
                        )}
                    </div>
                    <div className="divide-y divide-gray-100 px-5">
                        {FIELD_ORDER.map((field) => (
                            <div key={field} className="grid grid-cols-3 items-center gap-3 py-2">
                                <label className="text-xs text-gray-500" htmlFor={"current-" + field}>
                                    {FIELD_LABEL[field]}
                                </label>
                                <div className="col-span-2">
                                    {field === "sourceType" ? (
                                        <select
                                            id="current-sourceType"
                                            className={FIELD_CLASS}
                                            value={draft.sourceType}
                                            onChange={(event) =>
                                                setDraft({
                                                    ...draft,
                                                    sourceType: event.target.value as SourceType,
                                                })
                                            }
                                        >
                                            <option value="XLSX">XLSX</option>
                                            <option value="CSV">CSV</option>
                                            <option value="PDF">PDF</option>
                                            <option value="IMAGE">이미지</option>
                                            <option value="MANUAL">수기</option>
                                        </select>
                                    ) : (
                                        <input
                                            id={"current-" + field}
                                            type={field === "effectiveDate" ? "date" : "text"}
                                            inputMode={PRICE_FIELDS.includes(field) ? "numeric" : undefined}
                                            className={FIELD_CLASS}
                                            value={draft[field]}
                                            onChange={(event) => setDraft({ ...draft, [field]: event.target.value })}
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            </div>

            <section className="mt-4 rounded-xl border border-gray-200 bg-white shadow-sm">
                <h2 className="border-b border-gray-200 px-5 py-4 text-sm font-semibold text-gray-900">변경 이력</h2>
                {!changelogQuery.data || changelogQuery.data.length === 0 ? (
                    <p className="px-5 py-8 text-center text-sm text-gray-500">변경 이력이 없습니다.</p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-190 text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 bg-gray-50">
                                    {["유형", "변경 항목", "변경 전", "변경 후", "상태", "변경 시각"].map((column) => (
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
                                {changelogQuery.data.map((entry) =>
                                    entry.changes.length === 0 ? (
                                        <tr key={entry.id} className="border-b border-gray-100 last:border-b-0">
                                            <td className="whitespace-nowrap px-5 py-2.5 text-gray-900">
                                                {CHANGE_TYPE_LABEL[entry.type] ?? entry.type}
                                            </td>
                                            <td className="px-5 py-2.5 text-gray-400" colSpan={2}>
                                                값 변경 없음
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-2.5 text-gray-700">
                                                {(entry.fromStatus && BACKEND_STATUS_LABEL[entry.fromStatus]) ?? "-"} →{" "}
                                                {(entry.toStatus && BACKEND_STATUS_LABEL[entry.toStatus]) ?? "-"}
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-2.5 text-gray-500">
                                                {formatDateTime(entry.createdAt)}
                                            </td>
                                        </tr>
                                    ) : (
                                        entry.changes.map((change, index) => (
                                            <tr
                                                key={entry.id + "-" + change.field}
                                                className="border-b border-gray-100 last:border-b-0"
                                            >
                                                <td className="whitespace-nowrap px-5 py-2.5 text-gray-900">
                                                    {index === 0 ? (CHANGE_TYPE_LABEL[entry.type] ?? entry.type) : ""}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-2.5 text-gray-700">
                                                    {FIELD_LABEL[change.field as keyof InspectionValues] ?? change.field}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-2.5 text-gray-500 line-through">
                                                    <span title={change.before ?? ""} className="block max-w-55 truncate">
                                                        {formatText(change.before ?? "")}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-2.5 font-medium text-gray-900">
                                                    <span title={change.after ?? ""} className="block max-w-55 truncate">
                                                        {formatText(change.after ?? "")}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-2.5 text-gray-700">
                                                    {index === 0
                                                        ? ((entry.fromStatus && BACKEND_STATUS_LABEL[entry.fromStatus]) ?? "-") +
                                                          " → " +
                                                          ((entry.toStatus && BACKEND_STATUS_LABEL[entry.toStatus]) ?? "-")
                                                        : ""}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-2.5 text-gray-500">
                                                    {index === 0 ? formatDateTime(entry.createdAt) : ""}
                                                </td>
                                            </tr>
                                        ))
                                    )
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur md:px-8">
                <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-end gap-2">
                    {missingRequired && (
                        <p className="mr-auto text-xs text-gray-500">
                            필수값 누락 예외가 있어 승인할 수 없습니다. 현재 검수값을 보완한 뒤 저장해 주세요.
                        </p>
                    )}
                    <button
                        type="button"
                        onClick={handleSave}
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        저장
                    </button>
                    <button
                        type="button"
                        onClick={() => requestAction("REVIEW")}
                        className="rounded-xl border border-primary bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-50"
                    >
                        재검토
                    </button>
                    <button
                        type="button"
                        onClick={() => requestAction("REJECT")}
                        className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                        반려
                    </button>
                    <button
                        type="button"
                        onClick={() => requestAction("CONFIRM")}
                        disabled={missingRequired}
                        aria-disabled={missingRequired}
                        className={
                            "rounded-xl px-4 py-2 text-sm font-semibold " +
                            (missingRequired
                                ? "cursor-not-allowed border border-gray-200 bg-gray-100 text-gray-400"
                                : "bg-primary text-white hover:bg-primary-700")
                        }
                    >
                        승인
                    </button>
                </div>
            </div>

            <UnsavedChangesDialog
                open={unsaved !== null}
                onCancel={() => setUnsaved(null)}
                onContinue={() => {
                    const action = unsaved
                    setUnsaved(null)
                    if (action) runAction(action)
                }}
                onSave={() => {
                    const action = unsaved
                    handleSave()
                    setUnsaved(null)
                    if (action) runAction(action)
                }}
            />

            <MemoDialog
                open={memoDialog !== null}
                title={memoDialog === "REJECT" ? "검수 반려" : memoDialog === "REVIEW" ? "재검토" : "검수 승인"}
                description={
                    memoDialog === "REJECT"
                        ? "반려 사유를 검수 메모로 남길 수 있습니다."
                        : memoDialog === "REVIEW"
                          ? "승인 / 반려 이전 상태로 되돌립니다. 재검토 사유를 검수 메모로 남길 수 있습니다."
                          : "승인과 함께 남길 검수 메모를 입력할 수 있습니다."
                }
                confirmLabel={memoDialog === "REJECT" ? "반려" : memoDialog === "REVIEW" ? "재검토" : "승인"}
                tone={memoDialog === "REJECT" ? "danger" : "primary"}
                onCancel={() => setMemoDialog(null)}
                onSubmit={handleMemoSubmit}
            />
        </div>
    )
}
