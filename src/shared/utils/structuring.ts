import type { RawRecordInput, RawRecord, ExceptionFlag, InspectionValues, InspectionRecord } from "../model/inspection"

const KNOWN_UNITS = ["EA", "BOX", "SET", "ROLL", "TON", "SHT", "KG", "M"]

const UNIT_MAP: Record<string, string> = {
    개: "EA",
    장: "SHT",
    롤: "ROLL",
    세트: "SET",
    톤: "TON",
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
    if (duplicated) flags.push("DUPLICATE_SUSPECT")

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

export function buildInspectionRecords(
    ingestionId: string,
    inspectionId: string,
    records: RawRecord[]
): InspectionRecord[] {
    return records.map((record) => {
        const observed = toObserved(record)
        return {
            recordId: inspectionId + "-R" + record.rowNo,
            inspectionId,
            ingestionId,
            rowNo: record.rowNo,
            uploadMethod: record.uploadMethod,
            uploadRowNo: record.uploadRowNo,
            observed,
            current: toCurrent(record, observed),
            status: "NEW",
            flags: detectFlags(record, records),
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
