import { useEffect, useState } from "react"

interface MemoDialogProps {
    open: boolean
    title: string
    description: string
    confirmLabel: string
    tone?: "primary" | "danger"
    onCancel: () => void
    onSubmit: (memo: string) => void
}

export function MemoDialog({
    open,
    title,
    description,
    confirmLabel,
    tone = "primary",
    onCancel,
    onSubmit,
}: MemoDialogProps) {
    const [memo, setMemo] = useState("")

    useEffect(() => {
        if (open) setMemo("")
    }, [open])

    if (!open) return null

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="memo-dialog-title"
        >
            <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-lg">
                <h2 id="memo-dialog-title" className="text-sm font-semibold text-gray-900">
                    {title}
                </h2>
                <p className="mt-1 text-sm text-gray-500">{description}</p>

                <label className="mb-1.5 mt-4 block text-xs font-medium text-gray-600" htmlFor="memo-dialog-field">
                    검수 메모
                </label>
                <textarea
                    id="memo-dialog-field"
                    rows={3}
                    value={memo}
                    onChange={(event) => setMemo(event.target.value)}
                    placeholder="검수 메모를 입력하세요."
                    className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100"
                />

                <div className="mt-5 flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        취소
                    </button>
                    <button
                        type="button"
                        onClick={() => onSubmit(memo)}
                        className={
                            "rounded-xl px-3.5 py-2 text-sm font-semibold text-white " +
                            (tone === "danger" ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700")
                        }
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    )
}
