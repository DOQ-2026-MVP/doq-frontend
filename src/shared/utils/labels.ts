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

/**
 * 서버는 원본유형을 파일 확장자 그대로 준다("PNG"). 화면 쪽 원본유형은 확장자가 아니라
 * 범주(IMAGE)라 그대로 쓰면 값이 어디에도 안 걸린다 — 실제로 `<select>` 가 매칭되는
 * option 을 못 찾고 첫 옵션(XLSX)으로 떨어져 PNG 원본이 XLSX 로 보였다.
 *
 * 아는 확장자는 여기서 범주로 흡수한다. 모르는 값은 임의로 바꾸지 않고 그대로 흘려보낸다 —
 * 조용히 다른 값이 되는 것보다 낯선 값이 그대로 보이는 편이 낫다.
 */
const SOURCE_TYPE_ALIAS: Record<string, SourceType> = {
    PNG: "IMAGE",
    JPG: "IMAGE",
    JPEG: "IMAGE",
}

export function toSourceType(raw: string | null | undefined): SourceType {
    const key = String(raw ?? "")
        .trim()
        .toUpperCase()
    if (key === "") return "MANUAL"
    return SOURCE_TYPE_ALIAS[key] ?? (key as SourceType)
}

export const UPLOAD_METHOD_LABEL: Record<UploadMethod, string> = {
    FILE: "파일 업로드",
    MANUAL: "수기 입력",
}
