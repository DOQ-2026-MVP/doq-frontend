import type { ExceptionFlag } from "@/shared/model/inspection"

export const EXCEPTION_LABEL: Record<ExceptionFlag, string> = {
    MISSING_REQUIRED: "필수값 누락",
    DUPLICATE_SUSPECT: "중복 의심",
    SPEC_MISMATCH: "규격 불일치",
    UNIT_MISMATCH: "단위 불일치",
}

export const EXCEPTION_SHORT_LABEL: Record<ExceptionFlag, string> = {
    MISSING_REQUIRED: "누락",
    DUPLICATE_SUSPECT: "중복",
    SPEC_MISMATCH: "규격",
    UNIT_MISMATCH: "단위",
}

interface ExceptionBadgeProps {
    flag: ExceptionFlag
    short?: boolean
}

export function ExceptionBadge({ flag, short = false }: ExceptionBadgeProps) {
    return (
        <span
            title={EXCEPTION_LABEL[flag]}
            className={
                "inline-flex items-center rounded-full bg-orange-50 font-medium text-orange-700 ring-1 ring-inset ring-orange-200 " +
                (short ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-0.5 text-xs")
            }
        >
            {short ? EXCEPTION_SHORT_LABEL[flag] : EXCEPTION_LABEL[flag]}
        </span>
    )
}
