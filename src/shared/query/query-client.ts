import { QueryClient } from "@tanstack/react-query";
/**
 * @description Tanstack Query Client
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {},
  },
});
