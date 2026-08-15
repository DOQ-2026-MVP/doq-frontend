import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams, useSearchParams } from "react-router-dom"
import { useQueryClient } from "@tanstack/react-query"
import { ArrowLeftIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"
import { ExceptionBadge } from "@/components/ExceptionBadge"
import { ConfirmActionDialog } from "@/components/ConfirmActionDialog"
import { PREVIEW_BODY_HEIGHT, SourcePreview } from "@/components/SourcePreview"
import { StatusBadge } from "@/components/StatusBadge"
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog"
import {
    useInspectionsByIngestion,
    useRecordChangelog,
    usePatchRecord,
    useConfirmRecord,
    useRejectRecord,
    useResetRecord,
} from "@/apis/inspection"
import { useGetRecordsFor, useIngestionDetail } from "@/apis/ingestion"
import type { InspectionRecordDto } from "@/apis/inspection/types"
import { parseApiError } from "@/shared/api/api.base"
import type { ExceptionFlag, InspectionValues, SourceType } from "@/shared/model/inspection"
import { deriveDisplayStatus } from "@/shared/utils/structuring"
import { formatPrice, formatText, formatDateTime } from "@/shared/utils/format"
import {
    FIELD_LABEL,
    SOURCE_TYPES,
    SOURCE_TYPE_LABEL,
    isKnownSourceType,
    sourceTypeLabel,
} from "@/shared/utils/labels"

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

const FIELD_CLASS = "w-full rounded-xl border px-3 py-1.5 text-sm text-gray-900 focus:outline-none focus:ring-2"
const FIELD_TONE = " border-gray-300 focus:border-primary focus:ring-primary-100"
const FIELD_TONE_ERROR = " border-red-400 focus:border-red-500 focus:ring-red-100"

/**
 * 왼쪽(관찰값)은 읽기 전용이지만 오른쪽 입력과 같은 상자 크기를 쓴다 — 테두리만 투명하다.
 * 글자만 얹으면 행 높이가 입력보다 낮아 두 카드의 같은 항목이 서로 다른 줄에 선다.
 */
const READONLY_CLASS = "w-full rounded-xl border border-transparent px-3 py-1.5 text-sm text-gray-900"

/** 두 카드가 같은 자리에서 필드 목록을 시작하도록, 행 한 줄의 뼈대를 공유한다. */
const ROW_CLASS = "grid grid-cols-3 items-start gap-3 py-2"
const ROW_LABEL_CLASS = "pt-2 text-xs text-gray-500"

type PendingAction = "BACK" | "CONFIRM" | "REJECT" | "REVIEW"

/** 검증 실패 사유를 담을 자리 — 서버가 주는 필드명이 그대로 키다. */
type FieldErrors = Partial<Record<keyof InspectionValues, string>>

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
    const resetMutation = useResetRecord()

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
            /** 백엔드가 들고 있는 실제 상태 — 어떤 버튼을 낼지는 화면용 세분화 상태가 아니라 이쪽이 정한다. */
            backendStatus: dto.status,
            memo: dto.memo ?? "",
            flags,
        }
    }, [dto])

    const [draft, setDraft] = useState<InspectionValues | null>(null)
    // 메모는 검수값과 같은 편집(PATCH) 한 번에 실려 간다 — 상태 전이 API 는 바디를 읽지 않는다.
    const [memo, setMemo] = useState("")
    // 검증 실패는 칸별로 — 해당 입력 아래에만 적고, 어느 칸에도 안 붙는 실패만 아래 바에 남긴다.
    const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
    const [saveError, setSaveError] = useState("")
    const [confirmDialog, setConfirmDialog] = useState<null | "CONFIRM" | "REJECT" | "REVIEW">(null)
    const [unsaved, setUnsaved] = useState<PendingAction | null>(null)
    const loadedRecordId = useRef<string | undefined>(undefined)

    useEffect(() => {
        if (loadedRecordId.current === id && draft !== null) return
        if (!record) return
        loadedRecordId.current = id
        setDraft(record.current)
        setMemo(record.memo)
        setFieldErrors({})
        setSaveError("")
        setConfirmDialog(null)
        setUnsaved(null)
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, record, draft])

    const isDirty = useMemo(() => {
        if (!record || !draft) return false
        return record.memo !== memo || FIELD_ORDER.some((field) => record.current[field] !== draft[field])
    }, [record, draft, memo])

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

    /**
     * 아래 바에 어떤 버튼을 낼지는 백엔드 상태가 정한다.
     *
     * 신규는 아직 확정 전이라 저장·반려·승인이 모두 열려 있고, 승인/반려로 확정된 뒤에는
     * 재검토(= 신규로 되돌리기)만 남는다. 다만 예외가 붙어 있는 행은 확정된 뒤에도
     * 값을 고쳐 저장할 수 있어야 하므로 저장 버튼을 같이 낸다.
     */
    const isNew = record.backendStatus === "NEW"
    const canSave = isNew || record.flags.length > 0
    const canReview = !isNew

    function invalidateInspection() {
        queryClient.invalidateQueries({ queryKey: ["inspection", "list", sessionIngestionId] })
        queryClient.invalidateQueries({ queryKey: ["inspection", "list"] })
        queryClient.invalidateQueries({ queryKey: ["inspection", "changelog", id] })
    }

    async function handleSave() {
        if (!record || !draft) return
        try {
            await patchMutation.mutateAsync({ recordId: record.id, body: { ...draft, memo } })
            invalidateInspection()
            setFieldErrors({})
            setSaveError("")
            toast.success("수정되었습니다.")
        } catch (e) {
            console.error(e)
            // 사유는 전부 화면 안에 남긴다 — 칸을 특정할 수 있으면 그 입력 아래에, 아니면 아래 바에 한 줄로.
            // 토스트에는 "실패했다"는 사실만 남긴다(필드 오류는 절대 싣지 않는다).
            const { fields, message } = parseApiError(e, "")
            setFieldErrors(fields as FieldErrors)
            setSaveError(message)
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
        setConfirmDialog(action)
    }

    async function handleActionConfirm() {
        if (!confirmDialog || !record) return

        try {
            if (confirmDialog === "CONFIRM") {
                await confirmMutation.mutateAsync({ recordId: record.id })
                invalidateInspection()
                toast.success("검수가 승인되었습니다.")
                setConfirmDialog(null)
                navigate(inboxPath)
            } else if (confirmDialog === "REJECT") {
                await rejectMutation.mutateAsync({ recordId: record.id })
                invalidateInspection()
                toast.success("검수가 반려되었습니다.")
                setConfirmDialog(null)
                navigate(inboxPath)
            } else {
                // 재검토는 초기화(reset) 다 — 반려(reject)로 처리하면 상태가 REJECTED 에 머물러
                // 신규 흐름(저장·반려·승인)으로 영영 못 돌아온다.
                await resetMutation.mutateAsync({ recordId: record.id })
                invalidateInspection()
                // 편집본이 관찰값으로 되돌아갔으니 화면의 초안도 서버 값으로 다시 받아야 한다.
                loadedRecordId.current = undefined
                setDraft(null)
                toast.success("재검토 대상으로 되돌렸습니다.")
                setConfirmDialog(null)
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

            {/*
             * 좌우 카드의 같은 항목이 같은 줄에 서야 무엇을 무엇으로 고쳤는지 눈으로 짚힌다.
             * 그러려면 필드 목록 위에 얹힌 덩어리(왼쪽 원본 프리뷰 / 오른쪽 검수 메모)의 높이가 같아야 해서,
             * 두 덩어리를 같은 뼈대(제목 줄 + PREVIEW_BODY_HEIGHT 본문 + 아래 띠)로 맞춰 둔다.
             */}
            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
                        <h2 className="text-sm font-semibold text-gray-900">관찰값 / 원본</h2>
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">읽기 전용</span>
                    </div>
                    <SourcePreview
                        fileName={uploadFileName}
                        uploadRowNo={record.uploadRowNo}
                        ingestionId={ingestionId}
                        uploadId={uploadId}
                    />
                    <dl className="divide-y divide-gray-100 px-5">
                        {FIELD_ORDER.map((field) => (
                            <div key={field} className={ROW_CLASS}>
                                <dt className={ROW_LABEL_CLASS}>{FIELD_LABEL[field]}</dt>
                                <dd className="col-span-2">
                                    <p className={READONLY_CLASS + " truncate"}>
                                        {field === "sourceType"
                                            ? sourceTypeLabel(record.observed.sourceType)
                                            : PRICE_FIELDS.includes(field)
                                              ? formatPrice(record.observed[field])
                                              : formatText(record.observed[field])}
                                    </p>
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

                    {/* 왼쪽 프리뷰와 같은 뼈대 — 제목 줄, 같은 높이의 본문, 아래 띠. */}
                    <div className="border-b border-gray-100 px-5 py-4">
                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-gray-600" htmlFor="current-memo">
                                검수 메모
                            </label>
                            <span className="text-xs text-gray-400">저장 시 함께 반영</span>
                        </div>
                        <div className="mt-2 overflow-hidden rounded-xl border border-gray-200">
                            <textarea
                                id="current-memo"
                                value={memo}
                                onChange={(event) => setMemo(event.target.value)}
                                placeholder="검수 메모를 입력하세요."
                                className={
                                    PREVIEW_BODY_HEIGHT +
                                    " block w-full resize-none border-0 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                }
                            />
                            <div className="flex items-center justify-between gap-3 border-t border-gray-200 bg-white px-3 py-2">
                                <span className="text-xs text-gray-500">
                                    {memo.trim() === "" ? "메모 없음" : memo.length + "자"}
                                </span>
                                {record.memo !== memo && (
                                    <span className="text-xs font-medium text-orange-700">저장 전 변경사항</span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-100 px-5">
                        {FIELD_ORDER.map((field) => {
                            const reason = fieldErrors[field]
                            const errorId = "current-" + field + "-error"
                            const tone = FIELD_CLASS + (reason ? FIELD_TONE_ERROR : FIELD_TONE)
                            const describedBy = reason ? errorId : undefined
                            // 값을 고치는 순간 그 칸의 오류는 걷는다 — 남겨두면 무엇이 아직 막혔는지 흐려진다.
                            const edit = (value: string) => {
                                setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
                                setDraft({ ...draft, [field]: value })
                            }

                            return (
                                <div key={field} className={ROW_CLASS}>
                                    <label className={ROW_LABEL_CLASS} htmlFor={"current-" + field}>
                                        {FIELD_LABEL[field]}
                                    </label>
                                    <div className="col-span-2">
                                        {field === "sourceType" ? (
                                            <select
                                                id="current-sourceType"
                                                className={tone}
                                                aria-invalid={reason ? true : undefined}
                                                aria-describedby={describedBy}
                                                value={draft.sourceType}
                                                onChange={(event) => edit(event.target.value as SourceType)}
                                            >
                                                {/*
                                                 * 규약에 없는 값(서버가 주는 "PNG" 같은 확장자)이 와도 그 값을 담은
                                                 * option 을 만들어 준다. 없으면 브라우저가 첫 옵션으로 떨어뜨려,
                                                 * 손댄 적 없는 원본유형이 XLSX 로 둔갑한 채 저장까지 된다.
                                                 */}
                                                {!isKnownSourceType(draft.sourceType) && (
                                                    <option value={draft.sourceType}>
                                                        {sourceTypeLabel(draft.sourceType)}
                                                    </option>
                                                )}
                                                {SOURCE_TYPES.map((type) => (
                                                    <option key={type} value={type}>
                                                        {SOURCE_TYPE_LABEL[type]}
                                                    </option>
                                                ))}
                                            </select>
                                        ) : (
                                            <input
                                                id={"current-" + field}
                                                type={field === "effectiveDate" ? "date" : "text"}
                                                inputMode={PRICE_FIELDS.includes(field) ? "numeric" : undefined}
                                                className={tone}
                                                aria-invalid={reason ? true : undefined}
                                                aria-describedby={describedBy}
                                                value={draft[field]}
                                                onChange={(event) => edit(event.target.value)}
                                            />
                                        )}
                                        {reason && (
                                            <p id={errorId} role="alert" className="mt-1 text-xs text-red-600">
                                                {reason}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
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
                                            {/* 머리글은 6칸(유형·변경 항목·변경 전·변경 후·상태·변경 시각)이다.
                                                여기서 3칸을 덮지 않으면 뒤 칸이 하나씩 밀려, 상태 자리에 변경 시각이 찍힌다. */}
                                            <td className="px-5 py-2.5 text-gray-400" colSpan={3}>
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
                    {saveError !== "" ? (
                        <p className="mr-auto whitespace-pre-line text-xs text-red-600" role="alert">
                            {saveError}
                        </p>
                    ) : (
                        isNew &&
                        missingRequired && (
                            <p className="mr-auto text-xs text-gray-500">
                                필수값 누락 예외가 있어 승인할 수 없습니다. 현재 검수값을 보완한 뒤 저장해 주세요.
                            </p>
                        )
                    )}
                    {canSave && (
                        <button
                            type="button"
                            onClick={handleSave}
                            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                            저장
                        </button>
                    )}
                    {canReview && (
                        <button
                            type="button"
                            onClick={() => requestAction("REVIEW")}
                            className="rounded-xl border border-primary bg-white px-4 py-2 text-sm font-medium text-primary hover:bg-primary-50"
                        >
                            재검토
                        </button>
                    )}
                    {isNew && (
                        <button
                            type="button"
                            onClick={() => requestAction("REJECT")}
                            className="rounded-xl border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                        >
                            반려
                        </button>
                    )}
                    {isNew && (
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
                    )}
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

            <ConfirmActionDialog
                open={confirmDialog !== null}
                title={confirmDialog === "REJECT" ? "검수 반려" : confirmDialog === "REVIEW" ? "재검토" : "검수 승인"}
                description={
                    confirmDialog === "REJECT"
                        ? "이 레코드를 반려 처리합니다."
                        : confirmDialog === "REVIEW"
                          ? "신규 상태로 되돌려 다시 검수합니다. 저장해 둔 검수값과 메모는 원본 관찰값으로 되돌아갑니다(변경 이력에는 남습니다)."
                          : "이 레코드를 승인 처리합니다."
                }
                confirmLabel={confirmDialog === "REJECT" ? "반려" : confirmDialog === "REVIEW" ? "재검토" : "승인"}
                tone={confirmDialog === "REJECT" ? "danger" : "primary"}
                onCancel={() => setConfirmDialog(null)}
                onConfirm={handleActionConfirm}
            />
        </div>
    )
}
