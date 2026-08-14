import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { ArrowLeftIcon } from "lucide-react"
import { toast } from "sonner"
import { ExceptionBadge } from "@/components/ExceptionBadge"
import { MemoDialog } from "@/components/MemoDialog"
import { StatusBadge, RECORD_STATUS_LABEL } from "@/components/StatusBadge"
import { UnsavedChangesDialog } from "@/components/UnsavedChangesDialog"
import { useInspection } from "@/shared/context/InspectionContext"
import type { InspectionValues, ChangelogEntry, SourceType } from "@/shared/model/inspection"
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

const CHANGELOG_TYPE_LABEL: Record<ChangelogEntry["type"], string> = {
    UPDATE: "수정",
    CONFIRM: "승인",
    REJECT: "반려",
}

const FIELD_CLASS =
    "w-full rounded-xl border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"

type PendingAction = "BACK" | "CONFIRM" | "REJECT"

export function InspectionDetailPage() {
    const { recordId } = useParams<{ recordId: string }>()
    const navigate = useNavigate()
    const { getRecord, updateRecord, resolveRecord } = useInspection()
    const record = recordId ? getRecord(recordId) : undefined

    const [draft, setDraft] = useState<InspectionValues | null>(record ? record.current : null)
    const [memoDialog, setMemoDialog] = useState<null | "CONFIRM" | "REJECT">(null)
    const [unsaved, setUnsaved] = useState<PendingAction | null>(null)
    const loadedRecordId = useRef(recordId)

    useEffect(() => {
        if (loadedRecordId.current === recordId) return
        loadedRecordId.current = recordId
        setDraft(record ? record.current : null)
        setMemoDialog(null)
        setUnsaved(null)
    }, [recordId, record])

    const isDirty = useMemo(() => {
        if (!record || !draft) return false
        return FIELD_ORDER.some((field) => record.current[field] !== draft[field])
    }, [record, draft])

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

    const inboxPath = "/inbox"
    const missingRequired = record.flags.includes("MISSING_REQUIRED")

    function handleSave() {
        updateRecord(record!.recordId, draft!)
        toast.success("수정되었습니다.")
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

    function handleMemoSubmit(memo: string) {
        if (!memoDialog) return
        resolveRecord(record!.recordId, memoDialog === "CONFIRM" ? "APPROVED" : "REJECTED", memo)
        toast.success(memoDialog === "CONFIRM" ? "검수가 승인되었습니다." : "검수가 반려되었습니다.")
        setMemoDialog(null)
        navigate(inboxPath)
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
                    행 번호 {record.rowNo} · 인입 #{record.ingestionId}
                </span>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
                <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
                    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3.5">
                        <h2 className="text-sm font-semibold text-gray-900">관찰값 / 원본</h2>
                        <span className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-gray-500">읽기 전용</span>
                    </div>
                    <p className="border-b border-gray-100 bg-gray-50 px-5 py-2 text-xs text-gray-600">
                        원본 파일 ·{" "}
                        <span className="font-medium text-gray-800">
                            {record.fileName ? record.fileName + " / " + record.uploadRowNo + "행" : "수기 입력"}
                        </span>
                    </p>
                    <dl className="divide-y divide-gray-100 px-5">
                        {FIELD_ORDER.map((field) => (
                            <div key={field} className="grid grid-cols-3 gap-3 py-2.5">
                                <dt className="text-xs text-gray-500">{FIELD_LABEL[field]}</dt>
                                <dd className="col-span-2 text-sm text-gray-900">
                                    {field === "sourceType"
                                        ? SOURCE_TYPE_LABEL[record.observed.sourceType]
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
                {record.changelog.length === 0 ? (
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
                                {record.changelog.map((entry) =>
                                    entry.changes.length === 0 ? (
                                        <tr key={entry.id} className="border-b border-gray-100 last:border-b-0">
                                            <td className="whitespace-nowrap px-5 py-2.5 text-gray-900">
                                                {CHANGELOG_TYPE_LABEL[entry.type]}
                                            </td>
                                            <td className="px-5 py-2.5 text-gray-400" colSpan={3}>
                                                값 변경 없음
                                            </td>
                                            <td className="whitespace-nowrap px-5 py-2.5 text-gray-700">
                                                {RECORD_STATUS_LABEL[entry.fromStatus]} →{" "}
                                                {RECORD_STATUS_LABEL[entry.toStatus]}
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
                                                    {index === 0 ? CHANGELOG_TYPE_LABEL[entry.type] : ""}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-2.5 text-gray-700">
                                                    {FIELD_LABEL[change.field]}
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-2.5 text-gray-500 line-through">
                                                    <span title={change.before} className="block max-w-55 truncate">
                                                        {formatText(change.before)}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-2.5 font-medium text-gray-900">
                                                    <span title={change.after} className="block max-w-55 truncate">
                                                        {formatText(change.after)}
                                                    </span>
                                                </td>
                                                <td className="whitespace-nowrap px-5 py-2.5 text-gray-700">
                                                    {index === 0
                                                        ? RECORD_STATUS_LABEL[entry.fromStatus] +
                                                          " → " +
                                                          RECORD_STATUS_LABEL[entry.toStatus]
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
                title={memoDialog === "REJECT" ? "검수 반려" : "검수 승인"}
                description={
                    memoDialog === "REJECT"
                        ? "반려 사유를 검수 메모로 남길 수 있습니다."
                        : "승인과 함께 남길 검수 메모를 입력할 수 있습니다."
                }
                confirmLabel={memoDialog === "REJECT" ? "반려" : "승인"}
                tone={memoDialog === "REJECT" ? "danger" : "primary"}
                onCancel={() => setMemoDialog(null)}
                onSubmit={handleMemoSubmit}
            />
        </div>
    )
}
