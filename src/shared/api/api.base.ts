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
    error?: { code: string; message: string }
}

/** envelope 응답에서 실제 데이터만 꺼낸다. */
export const unwrap = <T,>(promise: Promise<ApiEnvelope<T>>): Promise<T> => promise.then((res) => res.data)
