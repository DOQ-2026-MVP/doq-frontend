import type { ExceptionFlag } from "@/shared/model/inspection"

export const EXCEPTION_LABEL: Record<ExceptionFlag, string> = {
    MISSING_REQUIRED: "필수값 누락",
    DUPLICATE_SUSPECTED: "중복 의심",
    SPEC_MISMATCH: "규격 불일치",
    UNIT_MISMATCH: "단위 불일치",
}

export const EXCEPTION_SHORT_LABEL: Record<ExceptionFlag, string> = {
    MISSING_REQUIRED: "누락",
    DUPLICATE_SUSPECTED: "중복",
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
            className="inline-flex shrink-0 items-center whitespace-nowrap rounded-full border border-[#D4D4D4] bg-[#F5F5F4] px-2.5 py-1 text-[11px] font-medium leading-none text-[#57534E]"
        >
            {short ? EXCEPTION_SHORT_LABEL[flag] : EXCEPTION_LABEL[flag]}
        </span>
    )
}
