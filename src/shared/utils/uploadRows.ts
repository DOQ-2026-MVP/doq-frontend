import type { SourceType, RawRecordInput } from "../model/inspection"

const ACCEPTED_EXTENSIONS = ["xlsx", "csv", "pdf", "png", "jpg", "jpeg"]

const RESIZED_EXTENSIONS = ["pdf", "png", "jpg", "jpeg"]

export const ACCEPT_ATTRIBUTE = ".xlsx,.csv,.pdf,.png,.jpg,.jpeg"

export function fileExtension(fileName: string): string {
    const parts = fileName.toLowerCase().split(".")
    return parts.length > 1 ? parts[parts.length - 1] : ""
}

export function isAcceptedFile(fileName: string): boolean {
    return ACCEPTED_EXTENSIONS.includes(fileExtension(fileName))
}

export function needsResize(fileName: string): boolean {
    return RESIZED_EXTENSIONS.includes(fileExtension(fileName))
}

function sourceTypeOf(fileName: string): SourceType {
    const extension = fileExtension(fileName)
    if (extension === "csv") return "CSV"
    if (extension === "pdf") return "PDF"
    if (extension === "png" || extension === "jpg" || extension === "jpeg") {
        return "IMAGE"
    }
    return "XLSX"
}

export function buildRowsFromFile(file: File): RawRecordInput[] {
    const sourceType = sourceTypeOf(file.name)
    const docId = file.name.replace(/\.[^.]+$/, "")

    return [
        {
            uploadMethod: "FILE",
            uploadRowNo: 2,
            fileName: file.name,
            sourceType,
            docId,
            supplier: "업로드 공급사",
            rawItemName: "업로드 품목 A",
            spec: "4kg/PK",
            unit: "PK",
            priceBefore: "12000",
            priceAfter: "12600",
            effectiveDate: "2026-09-01",
        },
        {
            uploadMethod: "FILE",
            uploadRowNo: 3,
            fileName: file.name,
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
