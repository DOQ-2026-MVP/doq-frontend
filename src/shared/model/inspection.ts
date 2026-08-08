export type SourceType = "XLSX" | "CSV" | "MANUAL"

export type UploadMethod = "FILE" | "MANUAL"

export type IngestionStatus = "DRAFT" | "STRUCTURING" | "STRUCTURED"

export type RecordStatus = "NEW" | "CONFIRMED" | "REJECTED"

export type ExceptionFlag = "MISSING_REQUIRED" | "DUPLICATE_SUSPECT" | "SPEC_MISMATCH" | "UNIT_MISMATCH"

export interface RawRecord {
    id: string
    rowNo: number
    uploadMethod: UploadMethod
    uploadRowNo: number | null
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

export type RawRecordInput = Omit<RawRecord, "id" | "rowNo">

export interface IngestionSession {
    ingestionId: string
    status: IngestionStatus
    createdAt: string
    records: RawRecord[]
    inspectionId: string | null
}

export interface InspectionValues {
    docId: string
    sourceType: SourceType
    supplier: string
    rawItemName: string
    spec: string
    unit: string
    priceBefore: string
    priceAfter: string
    effectiveDate: string
    normalizedItemName: string
}

export interface ChangelogChange {
    field: keyof InspectionValues
    before: string
    after: string
}

export interface ChangelogEntry {
    id: string
    type: "UPDATE" | "CONFIRM" | "REJECT"
    fromStatus: RecordStatus
    toStatus: RecordStatus
    changes: ChangelogChange[]
    createdAt: string
}

export interface InspectionRecord {
    recordId: string
    inspectionId: string
    ingestionId: string
    rowNo: number
    uploadMethod: UploadMethod
    uploadRowNo: number | null
    observed: InspectionValues
    current: InspectionValues
    status: RecordStatus
    flags: ExceptionFlag[]
    changelog: ChangelogEntry[]
}

export interface BulkConfirmResult {
    confirmed: number
    excluded: number
}
