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
