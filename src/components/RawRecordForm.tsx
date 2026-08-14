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
    "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-100"
const LABEL_CLASS = "mb-1.5 block text-xs font-medium text-gray-600"

interface RawRecordFormProps {
    idPrefix: string
    value: ManualRecordInput
    onChange: (value: ManualRecordInput) => void
}

export function RawRecordForm({ idPrefix, value, onChange }: RawRecordFormProps) {
    const set = (patch: Partial<ManualRecordInput>) => onChange({ ...value, ...patch })

    return (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
                <label className={LABEL_CLASS} htmlFor={idPrefix + "-docId"}>
                    문서ID
                    <span className="ml-0.5 text-[11px] text-red-600" aria-hidden="true">
                        *
                    </span>
                    <span className="sr-only">필수</span>
                </label>
                <input
                    id={idPrefix + "-docId"}
                    className={FIELD_CLASS}
                    value={value.docId}
                    onChange={(e) => set({ docId: e.target.value })}
                    placeholder="예) DOC-001"
                />
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
                <label className={LABEL_CLASS} htmlFor={idPrefix + "-supplier"}>
                    공급사
                </label>
                <input
                    id={idPrefix + "-supplier"}
                    className={FIELD_CLASS}
                    value={value.supplier}
                    onChange={(e) => set({ supplier: e.target.value })}
                    placeholder="예) 대성식품"
                />
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={idPrefix + "-rawItemName"}>
                    원문 품목명
                </label>
                <input
                    id={idPrefix + "-rawItemName"}
                    className={FIELD_CLASS}
                    value={value.rawItemName}
                    onChange={(e) => set({ rawItemName: e.target.value })}
                    placeholder="예) 냉동 감자튀김 슈스트링"
                />
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={idPrefix + "-spec"}>
                    규격
                </label>
                <input
                    id={idPrefix + "-spec"}
                    className={FIELD_CLASS}
                    value={value.spec}
                    onChange={(e) => set({ spec: e.target.value })}
                    placeholder="예) 4kg/PK, 2kg×6PK/BOX, 900g×10PK/BOX"
                />
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={idPrefix + "-unit"}>
                    단위
                </label>
                <input
                    id={idPrefix + "-unit"}
                    className={FIELD_CLASS}
                    value={value.unit}
                    onChange={(e) => set({ unit: e.target.value })}
                    placeholder="예) PK, BOX, PO"
                />
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={idPrefix + "-priceBefore"}>
                    기존 단가
                </label>
                <input
                    id={idPrefix + "-priceBefore"}
                    inputMode="numeric"
                    className={FIELD_CLASS}
                    value={value.priceBefore}
                    onChange={(e) => set({ priceBefore: e.target.value })}
                    placeholder="0"
                />
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={idPrefix + "-priceAfter"}>
                    변경 단가
                </label>
                <input
                    id={idPrefix + "-priceAfter"}
                    inputMode="numeric"
                    className={FIELD_CLASS}
                    value={value.priceAfter}
                    onChange={(e) => set({ priceAfter: e.target.value })}
                    placeholder="0"
                />
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={idPrefix + "-effectiveDate"}>
                    적용일
                </label>
                <input
                    id={idPrefix + "-effectiveDate"}
                    type="date"
                    className={FIELD_CLASS}
                    value={value.effectiveDate}
                    onChange={(e) => set({ effectiveDate: e.target.value })}
                />
            </div>
        </div>
    )
}
