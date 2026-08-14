export type MappedRecordDto = {
    docId?: string | null
    sourceType?: string | null
    supplier?: string | null
    rawItemName?: string | null
    spec?: string | null
    unit?: string | null
    priceBefore?: string | null
    priceAfter?: string | null
    effectiveDate?: string | null
    normalizedItemName?: string | null
}

export type InspectionRecordDto = {
    id: number
    recordId: number
    uploadType: "FILE" | "BATCH_FILE" | null
    rowNo: number | null
    status: "NEW" | "CONFIRMED" | "REJECTED"
    memo: string | null
    flags: string[]
    observed: MappedRecordDto
    current: MappedRecordDto
}

export type InspectionDetailDto = {
    inspectionId: number
    ingestionId: number
    createdAt: string
    records: InspectionRecordDto[]
}

export type InspectionBulkConfirmResult = {
    inspectionId: number
    confirmedCount: number
    blockedCount: number
}

export type FieldChangeDto = {
    field: string
    before: string | null
    after: string | null
}

export type InspectionChangeLogDto = {
    id: number
    recordId: number
    type: "EDIT" | "CONFIRM" | "REJECT"
    fromStatus: "NEW" | "CONFIRMED" | "REJECTED" | null
    toStatus: "NEW" | "CONFIRMED" | "REJECTED" | null
    changes: FieldChangeDto[]
    createdAt: string
}

export type ExportRow = {
    doc_id: string
    source_type: string
    supplier_name: string
    raw_item_name: string
    normalized_item_name?: string
    spec?: string
    unit?: string
    price_before?: number
    price_after?: number
    effective_date?: string
    review_status?: string
    exception_flags?: string[]
    source_ref?: { input_method?: string; file_name?: string; row_no?: number }
    reviewed_at?: string
    review_memo?: string
    change_log?: Array<{ at?: string; field?: string; from?: string; to?: string; action?: string }>
}
