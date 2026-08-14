import type { RawRecordInput, RawRecord, ExceptionFlag, InspectionValues, InspectionRecord } from "../model/inspection"

const KNOWN_UNITS = ["PK", "BOX", "PO", "EA", "SET", "KG", "G", "L"]

const UNIT_MAP: Record<string, string> = {
    박스: "BOX",
    팩: "PK",
    포: "PO",
    개: "EA",
    세트: "SET",
}

export function toRawRecords(inputs: RawRecordInput[], startRowNo: number, idPrefix: string): RawRecord[] {
    return inputs.map((input, index) => ({
        ...input,
        id: idPrefix + "-" + (startRowNo + index),
        rowNo: startRowNo + index,
    }))
}

export function normalizeItemName(rawItemName: string): string {
    return rawItemName
        .replace(/\(.*?\)/g, " ")
        .replace(/\s+/g, " ")
        .trim()
}

function normalizeSpec(spec: string): string {
    return spec.replace(/\s*[*xX]\s*/g, "×").trim()
}

function normalizeUnit(unit: string): string {
    const trimmed = unit.trim()
    if (trimmed === "") return ""
    return UNIT_MAP[trimmed] ?? trimmed.toUpperCase()
}

export function detectFlags(record: RawRecord, all: RawRecord[]): ExceptionFlag[] {
    const flags: ExceptionFlag[] = []

    const missing =
        record.rawItemName.trim() === "" ||
        record.unit.trim() === "" ||
        record.priceAfter.trim() === "" ||
        record.effectiveDate.trim() === ""
    if (missing) flags.push("MISSING_REQUIRED")

    const duplicated =
        all.filter(
            (other) =>
                other.docId === record.docId &&
                normalizeItemName(other.rawItemName) === normalizeItemName(record.rawItemName)
        ).length > 1
    if (duplicated) flags.push("DUPLICATE_SUSPECTED")

    if (record.spec.trim() === "" || /[*xX]/.test(record.spec)) {
        flags.push("SPEC_MISMATCH")
    }

    const unit = record.unit.trim()
    if (unit !== "" && !KNOWN_UNITS.includes(unit.toUpperCase())) {
        flags.push("UNIT_MISMATCH")
    }

    return flags
}

function toObserved(record: RawRecord): InspectionValues {
    return {
        docId: record.docId,
        sourceType: record.sourceType,
        supplier: record.supplier,
        rawItemName: record.rawItemName,
        spec: record.spec,
        unit: record.unit,
        priceBefore: record.priceBefore,
        priceAfter: record.priceAfter,
        effectiveDate: record.effectiveDate,
        normalizedItemName: normalizeItemName(record.rawItemName),
    }
}

function toCurrent(record: RawRecord, observed: InspectionValues): InspectionValues {
    return {
        ...observed,
        spec: normalizeSpec(record.spec),
        unit: normalizeUnit(record.unit),
    }
}

/** 예외 탐지 결과에 따른 초기 검수 상태 */
export function initialStatus(flags: ExceptionFlag[]): InspectionRecord["status"] {
    if (flags.length === 0) return "APPROVABLE"
    if (flags.includes("MISSING_REQUIRED")) return "NEEDS_CHECK"
    if (flags.includes("DUPLICATE_SUSPECTED")) return "NEEDS_HOLD"
    return "NEW"
}

/**
 * 실제 백엔드 status(NEW/CONFIRMED/REJECTED)를 화면용 세분화 상태로 매핑한다.
 * NEW는 아직 확정 전이라 탐지된 flags로 검토 우선순위를 세분화해서 보여준다.
 */
export function deriveDisplayStatus(backendStatus: string, flags: ExceptionFlag[]): InspectionRecord["status"] {
    if (backendStatus === "CONFIRMED") return "APPROVED"
    if (backendStatus === "REJECTED") return "REJECTED"
    return initialStatus(flags)
}

export function buildInspectionRecords(
    ingestionId: string,
    inspectionId: string,
    records: RawRecord[]
): InspectionRecord[] {
    return records.map((record) => {
        const observed = toObserved(record)
        const flags = detectFlags(record, records)
        return {
            recordId: inspectionId + "-R" + record.rowNo,
            inspectionId,
            ingestionId,
            rowNo: record.rowNo,
            uploadMethod: record.uploadMethod,
            uploadRowNo: record.uploadRowNo,
            fileName: record.fileName,
            observed,
            current: toCurrent(record, observed),
            status: initialStatus(flags),
            flags,
            changelog: [],
        }
    })
}

export function diffValues(
    before: InspectionValues,
    after: InspectionValues
): { field: keyof InspectionValues; before: string; after: string }[] {
    return (Object.keys(before) as (keyof InspectionValues)[])
        .filter((field) => before[field] !== after[field])
        .map((field) => ({
            field,
            before: before[field],
            after: after[field],
        }))
}
