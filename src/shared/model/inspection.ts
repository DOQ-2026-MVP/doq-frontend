export type SourceType = "XLSX" | "CSV" | "PDF" | "IMAGE" | "MANUAL"

export type UploadMethod = "FILE" | "MANUAL"

export type IngestionStatus = "DRAFT" | "STRUCTURING" | "STRUCTURED"

export type RecordStatus = "NEW" | "NEEDS_CHECK" | "NEEDS_HOLD" | "APPROVABLE" | "APPROVED" | "REJECTED"

export type ExceptionFlag = "MISSING_REQUIRED" | "DUPLICATE_SUSPECTED" | "SPEC_MISMATCH" | "UNIT_MISMATCH"

export interface RawRecord {
    id: string
    rowNo: number
    uploadMethod: UploadMethod
    uploadRowNo: number | null
    fileName: string | null
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

export type ResizeStatus = "NONE" | "PROCESSING" | "DONE"

export interface IngestionEntry {
    entryId: string
    kind: UploadMethod
    label: string
    createdAt: string
    resizeStatus: ResizeStatus
    rows: RawRecordInput[]
}

export interface IngestionSession {
    ingestionId: string
    status: IngestionStatus
    createdAt: string
    entries: IngestionEntry[]
    records: RawRecord[]
    inspectionId: string | null
    // true for client-only sessions not (yet) persisted on server
    isLocal?: boolean
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
    type: "UPDATE" | "CONFIRM" | "REJECT" | "REVIEW"
    fromStatus: RecordStatus
    toStatus: RecordStatus
    changes: ChangelogChange[]
    createdAt: string
    memo?: string
}

export interface InspectionRecord {
    recordId: string
    inspectionId: string
    ingestionId: string
    rowNo: number
    uploadMethod: UploadMethod
    uploadRowNo: number | null
    fileName: string | null
    observed: InspectionValues
    current: InspectionValues
    status: RecordStatus
    flags: ExceptionFlag[]
    changelog: ChangelogEntry[]
}
