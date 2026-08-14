import type { RawRecordInput, IngestionEntry, IngestionSession, InspectionRecord } from "./shared/model/inspection"
import { toRawRecords, buildInspectionRecords } from "./shared/utils/structuring"

const MAIN_FILE = "증빙_20건.xlsx"

const session1024Rows: RawRecordInput[] = [
    {
        uploadMethod: "FILE",
        uploadRowNo: 2,
        fileName: MAIN_FILE,
        docId: "DOC-001",
        sourceType: "XLSX",
        supplier: "대성식품",
        rawItemName: "냉동 감자튀김 슈스트링",
        spec: "2kg*6PK/BOX",
        unit: "BOX",
        priceBefore: "38000",
        priceAfter: "41000",
        effectiveDate: "2026-08-01",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 3,
        fileName: MAIN_FILE,
        docId: "DOC-002",
        sourceType: "XLSX",
        supplier: "대성식품",
        rawItemName: "무염버터",
        spec: "450g*20EA/BOX",
        unit: "박스",
        priceBefore: "96000",
        priceAfter: "",
        effectiveDate: "2026-08-01",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 4,
        fileName: MAIN_FILE,
        docId: "DOC-003",
        sourceType: "XLSX",
        supplier: "한울농산",
        rawItemName: "깐마늘 국내산",
        spec: "4kg/PK",
        unit: "PK",
        priceBefore: "18500",
        priceAfter: "19800",
        effectiveDate: "2026-08-10",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 5,
        fileName: MAIN_FILE,
        docId: "DOC-003",
        sourceType: "XLSX",
        supplier: "한울농산",
        rawItemName: "깐마늘 국내산 (재등록)",
        spec: "4kg/PK",
        unit: "PK",
        priceBefore: "18500",
        priceAfter: "19800",
        effectiveDate: "2026-08-10",
    },
    {
        uploadMethod: "MANUAL",
        uploadRowNo: null,
        fileName: null,
        docId: "DOC-004",
        sourceType: "MANUAL",
        supplier: "미소수산",
        rawItemName: "냉동 새우살 71/90",
        spec: "900g×10PK/BOX",
        unit: "BOX",
        priceBefore: "72000",
        priceAfter: "75500",
        effectiveDate: "2026-09-01",
    },
    {
        uploadMethod: "MANUAL",
        uploadRowNo: null,
        fileName: null,
        docId: "DOC-005",
        sourceType: "MANUAL",
        supplier: "미소수산",
        rawItemName: "손질 오징어",
        spec: "1kg/PK",
        unit: "PK",
        priceBefore: "11800",
        priceAfter: "12400",
        effectiveDate: "2026-09-01",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 8,
        fileName: MAIN_FILE,
        docId: "DOC-006",
        sourceType: "XLSX",
        supplier: "삼진유통",
        rawItemName: "식용유 카놀라",
        spec: "18L/PO",
        unit: "PO",
        priceBefore: "42500",
        priceAfter: "46900",
        effectiveDate: "2026-08-15",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 9,
        fileName: MAIN_FILE,
        docId: "DOC-007",
        sourceType: "XLSX",
        supplier: "삼진유통",
        rawItemName: "천일염",
        spec: "",
        unit: "PK",
        priceBefore: "",
        priceAfter: "8300",
        effectiveDate: "",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 10,
        fileName: MAIN_FILE,
        docId: "DOC-008",
        sourceType: "XLSX",
        supplier: "그린팜",
        rawItemName: "대파 세척",
        spec: "1kg/PK",
        unit: "PK",
        priceBefore: "3200",
        priceAfter: "3450",
        effectiveDate: "2026-08-20",
    },
]

const fileRows = session1024Rows.filter((row) => row.uploadMethod === "FILE")
const manualRows = session1024Rows.filter((row) => row.uploadMethod === "MANUAL")

const session1024Entries: IngestionEntry[] = [
    {
        entryId: "ENT-1024-1",
        kind: "FILE",
        label: MAIN_FILE,
        createdAt: "2026-08-04T09:20:00",
        resizeStatus: "NONE",
        rows: fileRows,
    },
    ...manualRows.map((row, index) => ({
        entryId: "ENT-1024-" + (index + 2),
        kind: "MANUAL" as const,
        label: "수기 입력 항목",
        createdAt: "2026-08-04T09:2" + (5 + index) + ":00",
        resizeStatus: "NONE" as const,
        rows: [row],
    })),
]

const structuredSession: IngestionSession = {
    ingestionId: "1024",
    status: "STRUCTURED",
    createdAt: "2026-08-04T09:20:00",
    entries: session1024Entries,
    records: toRawRecords(session1024Rows, 1, "raw-1024"),
    inspectionId: "INS-1024",
}

export const initialSessions: IngestionSession[] = [structuredSession]

const baseRecords = buildInspectionRecords(structuredSession.ingestionId, "INS-1024", structuredSession.records)

export const initialRecords: InspectionRecord[] = baseRecords.map((record) => {
    if (record.rowNo === 5) {
        return {
            ...record,
            status: "APPROVED",
            changelog: [
                {
                    id: record.recordId + "-CL1",
                    type: "CONFIRM",
                    fromStatus: "APPROVABLE",
                    toStatus: "APPROVED",
                    changes: [],
                    createdAt: "2026-08-05T14:02:00",
                },
            ],
        }
    }
    if (record.rowNo === 6) {
        return {
            ...record,
            status: "APPROVED",
            changelog: [
                {
                    id: record.recordId + "-CL1",
                    type: "CONFIRM",
                    fromStatus: "APPROVABLE",
                    toStatus: "APPROVED",
                    changes: [],
                    createdAt: "2026-08-05T14:05:00",
                },
            ],
        }
    }
    if (record.rowNo === 7) {
        return {
            ...record,
            status: "REJECTED",
            changelog: [
                {
                    id: record.recordId + "-CL1",
                    type: "UPDATE",
                    fromStatus: "APPROVABLE",
                    toStatus: "APPROVABLE",
                    changes: [
                        {
                            field: "normalizedItemName",
                            before: "식용유 카놀라",
                            after: "카놀라유 18L",
                        },
                    ],
                    createdAt: "2026-08-05T16:12:00",
                },
                {
                    id: record.recordId + "-CL2",
                    type: "REJECT",
                    fromStatus: "APPROVABLE",
                    toStatus: "REJECTED",
                    changes: [],
                    createdAt: "2026-08-05T16:20:00",
                },
            ],
        }
    }
    return record
})
