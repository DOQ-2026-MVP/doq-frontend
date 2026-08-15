import axios from "axios"
import type { AxiosRequestConfig, AxiosResponse, InternalAxiosRequestConfig } from "axios"

const apiInstance = axios.create({
    baseURL: `${import.meta.env.VITE_API_BASE_URL}`,
    timeout: 10000,
    headers: {
        "Content-Type": "application/json",
    },
})

/**
 * @description 요청 시 Authorization 헤더에 accessToken 자동 주입
 */
apiInstance.interceptors.request.use((config) => {
    const accessToken = localStorage.getItem("accessToken")

    if (accessToken && !config.url?.includes("/auth/login") && !config.url?.includes("/auth/refresh")) {
        config.headers.Authorization = `Bearer ${accessToken}`
    }

    return config
})

/**
 * @param config - Axios 요청 설정 옵션
 * @description Request 인터셉터
 * @returns {Promise<InternalAxiosRequestConfig>} 인터셉터 처리 후 요청 설정 옵션
 */
apiInstance.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)
/**
 * @param response - Axios 응답
 * @description Response 인터셉터
 */
apiInstance.interceptors.response.use(
    (response) => response,
    (error) => {
        return Promise.reject(error)
    }
)

/**
 * @description API 요청 헬퍼 클래스
 */
export const ApiHelper = {
    /**
     * GET 요청
     * @template T - 응답 데이터의 타입
     * @param {string} url - 요청할 URL 경로
     * @param {import('axios').AxiosRequestConfig} [config] - Axios 요청 설정 옵션
     * @returns {Promise<T>} 응답 데이터를 반환하는 Promise
     * @throws {Error} 네트워크 오류 또는 HTTP 오류 발생 시 예외 처리
     */
    get: async <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> => {
        const response: AxiosResponse<T> = await apiInstance.get(url, config)
        return response.data
    },

    /**
     * POST 요청
     * @template T - 응답 데이터의 타입
     * @param {string} url - 요청할 URL 경로
     * @param {unknown} [data] - 요청 본문에 포함할 데이터
     * @param {import('axios').AxiosRequestConfig} [config] - Axios 요청 설정 옵션
     * @returns {Promise<T>} 응답 데이터를 반환하는 Promise
     * @throws {Error} 네트워크 오류 또는 HTTP 오류 발생 시 예외 처리
     */
    post: async <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
        const response: AxiosResponse<T> = await apiInstance.post(url, data, config)
        return response.data
    },

    /**
     * DELETE 요청
     * @template T - 응답 데이터의 타입
     * @param {string} url - 요청할 URL 경로
     * @param {import('axios').AxiosRequestConfig} [config] - Axios 요청 설정 옵션
     * @returns {Promise<T>} 응답 데이터를 반환하는 Promise
     * @throws {Error} 네트워크 오류 또는 HTTP 오류 발생 시 예외 처리
     */
    delete: async <T = unknown>(url: string, config?: AxiosRequestConfig): Promise<T> => {
        const response: AxiosResponse<T> = await apiInstance.delete(url, config)
        return response.data
    },

    /**
     * PATCH 요청
     * @template T - 응답 데이터의 타입
     * @param {string} url - 요청할 URL 경로
     * @param {unknown} [data] - 요청 본문에 포함할 데이터
     * @param {import('axios').AxiosRequestConfig} [config] - Axios 요청 설정 옵션
     * @returns {Promise<T>} 응답 데이터를 반환하는 Promise
     * @throws {Error} 네트워크 오류 또는 HTTP 오류 발생 시 예외 처리
     */
    patch: async <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
        const response: AxiosResponse<T> = await apiInstance.patch(url, data, config)
        return response.data
    },
    /**
     * PUT 요청
     */
    put: async <T = unknown>(url: string, data?: unknown, config?: AxiosRequestConfig): Promise<T> => {
        const response: AxiosResponse<T> = await apiInstance.put(url, data, config)
        return response.data
    },
}

/**
 * 백엔드 공통 응답 envelope — 성공 시 data, 실패 시 error.
 * (업로드 원본 다운로드·export.json·export.csv는 이 envelope 없이 raw로 내려온다.)
 */
export interface ApiEnvelope<T> {
    success: boolean
    data: T
    error?: ApiError
}

/** 입력 검증 실패 시 서버가 필드 단위로 내려주는 사유. 리스트 바디는 `[0].docId` 처럼 행 번호가 앞에 붙는다. */
export interface ApiFieldError {
    field: string
    reason: string
}

export interface ApiError {
    code: string
    message: string
    fields?: ApiFieldError[] | null
}

/** envelope 응답에서 실제 데이터만 꺼낸다. */
export const unwrap = <T,>(promise: Promise<ApiEnvelope<T>>): Promise<T> => promise.then((res) => res.data)

/** axios 예외에서 서버 envelope 의 error 를 꺼낸다 — 네트워크 오류 등 envelope 이 없으면 null. */
export function apiError(e: unknown): ApiError | null {
    const error = (e as { response?: { data?: ApiEnvelope<unknown> } })?.response?.data?.error
    return error && typeof error.message === "string" ? error : null
}

export interface ParsedApiError {
    /** 칸별 사유 — 해당 입력 바로 아래에 붙인다. */
    fields: Record<string, string>
    /** 어느 칸에도 붙지 않은 사유. 폼 전체에 한 줄로 남기거나 토스트에 띄운다. */
    message: string
}

/**
 * 검증 실패를 "어느 칸의 말인지" 기준으로 갈라 준다.
 *
 * 서버가 사유를 `fields` 로 준다. 리스트 바디는 `[0].docId` 처럼 행 번호가 앞에 붙는데,
 * 수기 입력은 한 번에 한 행만 보내므로 행 번호를 떼고 필드명만 남긴다 — 화면에 "1행" 같은
 * 접두사가 나갈 이유가 없다.
 *
 * 칸에 매이지 않는 실패(네트워크·상태 충돌 등)는 `fields` 없이 오므로 `message` 로 남는다.
 */
export function parseApiError(e: unknown, fallback: string): ParsedApiError {
    const error = apiError(e)
    if (!error) return { fields: {}, message: fallback }

    const given = error.fields
    if (!given || given.length === 0) return { fields: {}, message: error.message || fallback }

    const fields: Record<string, string> = {}
    for (const { field, reason } of given) {
        const name = /^\[\d+\]\.(.+)$/.exec(field)?.[1] ?? field
        // 한 칸에 사유가 여럿이면 첫 번째만 — 인풋 아래는 한 줄 자리다.
        if (!(name in fields)) fields[name] = reason
    }
    return { fields, message: "" }
}
