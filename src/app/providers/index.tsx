import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { RouterProvider } from "react-router"
import { InspectionProvider } from "@/shared/context/InspectionContext"
import { Toaster } from "sonner"

type Props = {
    router: any
    client: QueryClient
}

/**
 * @description Providers component
 * @param router - React Router
 * @param client - React Query Client
 */
export const Providers = ({ router, client }: Props) => {
    return (
        <QueryClientProvider client={client}>
            <InspectionProvider>
                <RouterProvider router={router} />

                {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
            </InspectionProvider>

            <Toaster position="bottom-right" />
        </QueryClientProvider>
    )
}
