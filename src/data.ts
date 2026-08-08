import type { RawRecordInput, IngestionSession, InspectionRecord } from "@/shared/model/inspection"
import { toRawRecords, buildInspectionRecords } from "@/shared/utils/structuring"

const session1024Rows: RawRecordInput[] = [
    {
        uploadMethod: "FILE",
        uploadRowNo: 2,
        docId: "PO-2026-0412",
        sourceType: "XLSX",
        supplier: "대한산업소재",
        rawItemName: "스테인레스 각파이프 STS304",
        spec: "50*50*2.0T",
        unit: "EA",
        priceBefore: "18200",
        priceAfter: "19400",
        effectiveDate: "2026-08-01",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 3,
        docId: "PO-2026-0412",
        sourceType: "XLSX",
        supplier: "대한산업소재",
        rawItemName: "알루미늄 판재 A1050",
        spec: "1000*2000*3T",
        unit: "장",
        priceBefore: "42000",
        priceAfter: "",
        effectiveDate: "2026-08-01",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 11,
        docId: "PO-2026-0418",
        sourceType: "CSV",
        supplier: "성진하드웨어",
        rawItemName: "육각볼트 M10",
        spec: "M10*30 아연도금",
        unit: "BOX",
        priceBefore: "9800",
        priceAfter: "10400",
        effectiveDate: "2026-08-10",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 12,
        docId: "PO-2026-0418",
        sourceType: "CSV",
        supplier: "성진하드웨어",
        rawItemName: "육각볼트 M10 (재등록)",
        spec: "M10*30 아연도금",
        unit: "BOX",
        priceBefore: "9800",
        priceAfter: "10400",
        effectiveDate: "2026-08-10",
    },
    {
        uploadMethod: "MANUAL",
        uploadRowNo: null,
        docId: "PO-2026-0421",
        sourceType: "MANUAL",
        supplier: "한빛전자부품",
        rawItemName: "전해 커패시터 470uF",
        spec: "25V 105도",
        unit: "EA",
        priceBefore: "320",
        priceAfter: "355",
        effectiveDate: "2026-09-01",
    },
    {
        uploadMethod: "MANUAL",
        uploadRowNo: null,
        docId: "PO-2026-0421",
        sourceType: "MANUAL",
        supplier: "한빛전자부품",
        rawItemName: "리니어 레귤레이터 LM317",
        spec: "TO-220",
        unit: "EA",
        priceBefore: "1100",
        priceAfter: "1180",
        effectiveDate: "2026-09-01",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 6,
        docId: "PO-2026-0430",
        sourceType: "XLSX",
        supplier: "우진포장",
        rawItemName: "골판지 박스 3겹",
        spec: "400*300*250",
        unit: "개",
        priceBefore: "780",
        priceAfter: "910",
        effectiveDate: "2026-08-15",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 7,
        docId: "PO-2026-0430",
        sourceType: "XLSX",
        supplier: "우진포장",
        rawItemName: "완충재 에어캡",
        spec: "",
        unit: "ROLL",
        priceBefore: "",
        priceAfter: "14300",
        effectiveDate: "",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 8,
        docId: "PO-2026-0435",
        sourceType: "CSV",
        supplier: "동성화학",
        rawItemName: "에폭시 접착제 A형",
        spec: "1kg 세트",
        unit: "SET",
        priceBefore: "24500",
        priceAfter: "24500",
        effectiveDate: "2026-08-20",
    },
]

const session1025Rows: RawRecordInput[] = [
    {
        uploadMethod: "FILE",
        uploadRowNo: 2,
        docId: "PO-2026-0441",
        sourceType: "CSV",
        supplier: "태성강재",
        rawItemName: "철근 D13",
        spec: "SD400 10M",
        unit: "TON",
        priceBefore: "985000",
        priceAfter: "1024000",
        effectiveDate: "2026-09-01",
    },
    {
        uploadMethod: "FILE",
        uploadRowNo: 3,
        docId: "PO-2026-0441",
        sourceType: "CSV",
        supplier: "태성강재",
        rawItemName: "철근 D16",
        spec: "SD400 10M",
        unit: "TON",
        priceBefore: "985000",
        priceAfter: "1024000",
        effectiveDate: "2026-09-01",
    },
    {
        uploadMethod: "MANUAL",
        uploadRowNo: null,
        docId: "PO-2026-0442",
        sourceType: "MANUAL",
        supplier: "태성강재",
        rawItemName: "와이어메쉬",
        spec: "",
        unit: "장",
        priceBefore: "4200",
        priceAfter: "",
        effectiveDate: "",
    },
]

const structuredSession: IngestionSession = {
    ingestionId: "1024",
    status: "STRUCTURED",
    createdAt: "2026-08-04T09:20:00",
    records: toRawRecords(session1024Rows, 1, "raw-1024"),
    inspectionId: "INS-1024",
}

const draftSession: IngestionSession = {
    ingestionId: "1025",
    status: "DRAFT",
    createdAt: "2026-08-07T14:05:00",
    records: toRawRecords(session1025Rows, 1, "raw-1025"),
    inspectionId: null,
}

export const initialSessions: IngestionSession[] = [structuredSession, draftSession]

const baseRecords = buildInspectionRecords(structuredSession.ingestionId, "INS-1024", structuredSession.records)

export const initialRecords: InspectionRecord[] = baseRecords.map((record) => {
    if (record.rowNo === 5) {
        return {
            ...record,
            status: "CONFIRMED",
            changelog: [
                {
                    id: record.recordId + "-CL1",
                    type: "CONFIRM",
                    fromStatus: "NEW",
                    toStatus: "CONFIRMED",
                    changes: [],
                    createdAt: "2026-08-05T14:02:00",
                },
            ],
        }
    }
    if (record.rowNo === 6) {
        return {
            ...record,
            status: "CONFIRMED",
            changelog: [
                {
                    id: record.recordId + "-CL1",
                    type: "CONFIRM",
                    fromStatus: "NEW",
                    toStatus: "CONFIRMED",
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
                    fromStatus: "NEW",
                    toStatus: "NEW",
                    changes: [
                        { field: "unit", before: "개", after: "EA" },
                        {
                            field: "normalizedItemName",
                            before: "골판지 박스 3겹",
                            after: "골판지 박스(3겹)",
                        },
                    ],
                    createdAt: "2026-08-05T16:12:00",
                },
                {
                    id: record.recordId + "-CL2",
                    type: "REJECT",
                    fromStatus: "NEW",
                    toStatus: "REJECTED",
                    changes: [],
                    createdAt: "2026-08-05T16:20:00",
                },
            ],
        }
    }
    return record
})
