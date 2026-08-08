import type { RawRecord } from "@/shared/model/inspection"
import { formatText, formatPrice } from "@/shared/utils/format"
import { UPLOAD_METHOD_LABEL, SOURCE_TYPE_LABEL } from "@/shared/utils/labels"

const COLUMNS = [
    "행 번호",
    "업로드 방식",
    "문서ID",
    "원본유형",
    "공급사",
    "원문 품목명",
    "규격",
    "단위",
    "기존 단가",
    "변경 단가",
    "적용일",
]

interface RawRecordTableProps {
    records: RawRecord[]
    highlightedIds: string[]
}

export function RawRecordTable({ records, highlightedIds }: RawRecordTableProps) {
    if (records.length === 0) {
        return <p className="px-5 py-10 text-center text-sm text-gray-500">등록된 원본 행이 없습니다.</p>
    }

    return (
        <div className="overflow-x-auto">
            <table className="w-full min-w-270 text-left text-sm">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                        {COLUMNS.map((column) => (
                            <th
                                key={column}
                                scope="col"
                                className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-gray-500"
                            >
                                {column}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {records.map((record) => (
                        <tr
                            key={record.id}
                            className={
                                "border-b border-gray-100 last:border-b-0 " +
                                (highlightedIds.includes(record.id) ? "bg-blue-50/60" : "")
                            }
                        >
                            <td className="whitespace-nowrap px-4 py-2.5 text-gray-500">{record.rowNo}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                                {UPLOAD_METHOD_LABEL[record.uploadMethod]}
                                {record.uploadMethod === "FILE" && record.uploadRowNo !== null && (
                                    <span className="ml-1 text-xs text-gray-400">(업로드 {record.uploadRowNo}행)</span>
                                )}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 font-medium text-gray-900">{record.docId}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                                {SOURCE_TYPE_LABEL[record.sourceType]}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">{record.supplier}</td>
                            <td className="px-4 py-2.5 text-gray-700">{record.rawItemName}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">{formatText(record.spec)}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">{formatText(record.unit)}</td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right text-gray-700">
                                {formatPrice(record.priceBefore)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-right font-medium text-gray-900">
                                {formatPrice(record.priceAfter)}
                            </td>
                            <td className="whitespace-nowrap px-4 py-2.5 text-gray-700">
                                {formatText(record.effectiveDate)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}
