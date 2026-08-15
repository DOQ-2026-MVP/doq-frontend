import type { SourceType } from "@/shared/model/inspection"
import { SOURCE_TYPE_LABEL } from "@/shared/utils/labels"

export interface ManualRecordInput {
    docId: string
    sourceType: Extract<SourceType, "MANUAL">
    supplier: string
    rawItemName: string
    spec: string
    unit: string
    priceBefore: string
    priceAfter: string
    effectiveDate: string
}

export const EMPTY_MANUAL_INPUT: ManualRecordInput = {
    docId: "",
    sourceType: "MANUAL",
    supplier: "",
    rawItemName: "",
    spec: "",
    unit: "",
    priceBefore: "",
    priceAfter: "",
    effectiveDate: "",
}

export function isManualInputFilled(value: ManualRecordInput): boolean {
    return (
        value.docId.trim() !== "" ||
        value.supplier.trim() !== "" ||
        value.rawItemName.trim() !== "" ||
        value.spec.trim() !== "" ||
        value.unit.trim() !== "" ||
        value.priceBefore.trim() !== "" ||
        value.priceAfter.trim() !== "" ||
        value.effectiveDate.trim() !== ""
    )
}

export function hasManualRequiredValue(value: ManualRecordInput): boolean {
    return value.docId.trim() !== ""
}

const FIELD_CLASS =
    "w-full rounded-xl border px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2"
const FIELD_TONE = " border-gray-300 focus:border-primary focus:ring-primary-100"
const FIELD_TONE_ERROR = " border-red-400 focus:border-red-500 focus:ring-red-100"
const LABEL_CLASS = "mb-1.5 block text-xs font-medium text-gray-600"

/** 입력 이름(서버 필드명과 같다)으로 오류 사유를 찾는다 — 검증 실패는 해당 칸 아래에만 적는다. */
export type ManualFieldErrors = Partial<Record<keyof ManualRecordInput, string>>

interface RawRecordFormProps {
    idPrefix: string
    value: ManualRecordInput
    onChange: (value: ManualRecordInput) => void
    errors?: ManualFieldErrors
}

export function RawRecordForm({ idPrefix, value, onChange, errors }: RawRecordFormProps) {
    const set = (patch: Partial<ManualRecordInput>) => onChange({ ...value, ...patch })

    const fieldId = (field: keyof ManualRecordInput) => idPrefix + "-" + field
    const errorId = (field: keyof ManualRecordInput) => fieldId(field) + "-error"

    /** 입력에 붙일 오류 표시 — 테두리·aria 연결·아래 한 줄을 한 자리에서 만든다. */
    const errorProps = (field: keyof ManualRecordInput) => {
        const reason = errors?.[field]
        return {
            className: FIELD_CLASS + (reason ? FIELD_TONE_ERROR : FIELD_TONE),
            "aria-invalid": reason ? true : undefined,
            "aria-describedby": reason ? errorId(field) : undefined,
        }
    }

    const fieldError = (field: keyof ManualRecordInput) => {
        const reason = errors?.[field]
        if (!reason) return null
        return (
            <p id={errorId(field)} role="alert" className="mt-1 text-xs text-red-600">
                {reason}
            </p>
        )
    }

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
                <label className={LABEL_CLASS} htmlFor={fieldId("docId")}>
                    문서ID
                </label>
                <input
                    id={fieldId("docId")}
                    {...errorProps("docId")}
                    value={value.docId}
                    onChange={(e) => set({ docId: e.target.value })}
                    placeholder="예) DOC-001"
                />
                {fieldError("docId")}
            </div>
            <div>
                <span className={LABEL_CLASS} id={idPrefix + "-sourceType-label"}>
                    원본유형
                </span>
                <p
                    aria-labelledby={idPrefix + "-sourceType-label"}
                    className="rounded-xl border border-gray-200 bg-surface px-3 py-2 text-sm text-gray-500"
                >
                    {SOURCE_TYPE_LABEL.MANUAL}
                </p>
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={fieldId("supplier")}>
                    공급사
                </label>
                <input
                    id={fieldId("supplier")}
                    {...errorProps("supplier")}
                    value={value.supplier}
                    onChange={(e) => set({ supplier: e.target.value })}
                    placeholder="예) 대성식품"
                />
                {fieldError("supplier")}
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={fieldId("rawItemName")}>
                    원문 품목명
                </label>
                <input
                    id={fieldId("rawItemName")}
                    {...errorProps("rawItemName")}
                    value={value.rawItemName}
                    onChange={(e) => set({ rawItemName: e.target.value })}
                    placeholder="예) 냉동 감자튀김 슈스트링"
                />
                {fieldError("rawItemName")}
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={fieldId("spec")}>
                    규격
                </label>
                <input
                    id={fieldId("spec")}
                    {...errorProps("spec")}
                    value={value.spec}
                    onChange={(e) => set({ spec: e.target.value })}
                    placeholder="예) 4kg/PK, 2kg×6PK/BOX, 900g×10PK/BOX"
                />
                {fieldError("spec")}
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={fieldId("unit")}>
                    단위
                </label>
                <input
                    id={fieldId("unit")}
                    {...errorProps("unit")}
                    value={value.unit}
                    onChange={(e) => set({ unit: e.target.value })}
                    placeholder="예) PK, BOX, PO"
                />
                {fieldError("unit")}
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={fieldId("priceBefore")}>
                    기존 단가
                </label>
                <input
                    id={fieldId("priceBefore")}
                    inputMode="numeric"
                    {...errorProps("priceBefore")}
                    value={value.priceBefore}
                    onChange={(e) => set({ priceBefore: e.target.value })}
                    placeholder="0"
                />
                {fieldError("priceBefore")}
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={fieldId("priceAfter")}>
                    변경 단가
                </label>
                <input
                    id={fieldId("priceAfter")}
                    inputMode="numeric"
                    {...errorProps("priceAfter")}
                    value={value.priceAfter}
                    onChange={(e) => set({ priceAfter: e.target.value })}
                    placeholder="0"
                />
                {fieldError("priceAfter")}
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={fieldId("effectiveDate")}>
                    적용일
                </label>
                <input
                    id={fieldId("effectiveDate")}
                    type="date"
                    {...errorProps("effectiveDate")}
                    value={value.effectiveDate}
                    onChange={(e) => set({ effectiveDate: e.target.value })}
                />
                {fieldError("effectiveDate")}
            </div>
        </div>
    )
}
