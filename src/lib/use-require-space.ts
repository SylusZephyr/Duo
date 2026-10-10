import { useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { useSpace } from "@/lib/queries";

export function useRequireSpace() {
  const navigate = useNavigate();
  const query = useSpace();

  useEffect(() => {
    if (!query.isLoading && query.data === null) {
      navigate({ to: "/start", replace: true });
    }
  }, [query.isLoading, query.data, navigate]);

  return query;
}
