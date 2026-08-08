import type { RawRecordInput, SourceType } from "../model/inspection"

export function buildRowsFromFile(file: File): RawRecordInput[] {
    const sourceType: SourceType = file.name.toLowerCase().endsWith(".csv") ? "CSV" : "XLSX"
    const docId = file.name.replace(/\.(xlsx|csv)$/i, "")

    return [
        {
            uploadMethod: "FILE",
            uploadRowNo: 2,
            sourceType,
            docId,
            supplier: "업로드 공급사",
            rawItemName: "업로드 품목 A",
            spec: "표준 규격",
            unit: "EA",
            priceBefore: "12000",
            priceAfter: "12600",
            effectiveDate: "2026-09-01",
        },
        {
            uploadMethod: "FILE",
            uploadRowNo: 3,
            sourceType,
            docId,
            supplier: "업로드 공급사",
            rawItemName: "업로드 품목 B",
            spec: "",
            unit: "BOX",
            priceBefore: "",
            priceAfter: "31500",
            effectiveDate: "2026-09-01",
        },
    ]
}
