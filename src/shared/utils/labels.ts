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

export const SOURCE_TYPES = Object.keys(SOURCE_TYPE_LABEL) as SourceType[]

export function isKnownSourceType(value: string): value is SourceType {
    return value in SOURCE_TYPE_LABEL
}

/**
 * 서버는 원본유형을 파일 확장자 그대로 준다("PNG"). 화면 쪽 원본유형은 확장자가 아니라
 * 범주(IMAGE)라 그대로 쓰면 값이 어디에도 안 걸린다 — 실제로 `<select>` 가 매칭되는
 * option 을 못 찾고 첫 옵션(XLSX)으로 떨어져 PNG 원본이 XLSX 로 보였다.
 *
 * 값은 건드리지 않는다. 검수 저장은 화면이 들고 있는 값을 그대로 서버에 돌려주기 때문에,
 * 여기서 흡수해 버리면 공급사만 고쳐 저장해도 원본유형까지 덮어쓰게 된다. 라벨만 범주로
 * 읽어주고 저장되는 값은 서버가 준 것 그대로 둔다.
 */
const SOURCE_TYPE_ALIAS: Record<string, SourceType> = {
    PNG: "IMAGE",
    JPG: "IMAGE",
    JPEG: "IMAGE",
}

export function sourceTypeLabel(raw: string | null | undefined): string {
    const value = String(raw ?? "").trim()
    if (value === "") return SOURCE_TYPE_LABEL.MANUAL

    const key = value.toUpperCase()
    if (isKnownSourceType(key)) return SOURCE_TYPE_LABEL[key]

    // 아는 확장자면 범주로 읽어주되 서버 표기도 같이 보여준다 — 저장되는 값은 이 표기 그대로다.
    const alias = SOURCE_TYPE_ALIAS[key]
    if (alias) return `${SOURCE_TYPE_LABEL[alias]} (${value})`

    return `${value} (알 수 없는 유형)`
}

export const UPLOAD_METHOD_LABEL: Record<UploadMethod, string> = {
    FILE: "파일 업로드",
    MANUAL: "수기 입력",
}
