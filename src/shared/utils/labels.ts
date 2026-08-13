import type { InspectionValues, SourceType, UploadMethod } from "../model/inspection"

export const FIELD_LABEL: Record<keyof InspectionValues, string> = {
    docId: "문서ID",
    sourceType: "원본유형",
    supplier: "공급사",
    rawItemName: "원문 품목명",
    spec: "규격",
    unit: "단위",
    priceBefore: "기존 단가",
    priceAfter: "변경 단가",
    effectiveDate: "적용일",
    normalizedItemName: "정규화 품목명",
}

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
    XLSX: "XLSX",
    CSV: "CSV",
    PDF: "PDF",
    IMAGE: "이미지",
    MANUAL: "수기",
}

export const UPLOAD_METHOD_LABEL: Record<UploadMethod, string> = {
    FILE: "파일 업로드",
    MANUAL: "수기 입력",
}
