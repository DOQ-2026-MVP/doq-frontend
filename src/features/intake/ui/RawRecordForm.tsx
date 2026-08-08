import type { SourceType } from "@/shared/model/inspection"

export interface ManualRecordInput {
    docId: string
    sourceType: SourceType
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
    return value.docId.trim() !== "" || value.supplier.trim() !== "" || value.rawItemName.trim() !== ""
}

const FIELD_CLASS =
    "w-full rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
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
                </label>
                <input
                    id={idPrefix + "-docId"}
                    className={FIELD_CLASS}
                    value={value.docId}
                    onChange={(e) => set({ docId: e.target.value })}
                    placeholder="PO-2026-0000"
                />
            </div>
            <div>
                <label className={LABEL_CLASS} htmlFor={idPrefix + "-sourceType"}>
                    원본유형
                </label>
                <select
                    id={idPrefix + "-sourceType"}
                    className={FIELD_CLASS}
                    value={value.sourceType}
                    onChange={(e) => set({ sourceType: e.target.value as SourceType })}
                >
                    <option value="MANUAL">수기</option>
                    <option value="XLSX">XLSX</option>
                    <option value="CSV">CSV</option>
                </select>
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
                    placeholder="공급사명"
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
                    placeholder="증빙에 기재된 품목명"
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
                    placeholder="예) 50×50×2.0T"
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
                    placeholder="예) EA"
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
