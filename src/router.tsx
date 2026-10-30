import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { startCachePersistence } from "./lib/offline/persist";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Long garbage-collection window so the persisted cache still holds
        // usable intel when the console comes back up off-network.
        gcTime: 1000 * 60 * 60 * 24 * 7,
        staleTime: 30_000,
        retry: 1,
        networkMode: "offlineFirst",
      },
      mutations: { networkMode: "offlineFirst" },
    },
  });

  startCachePersistence(queryClient);

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
