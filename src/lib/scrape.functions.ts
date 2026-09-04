import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const fetchProductMeta = createServerFn({ method: "POST" })
  .validator((data: unknown) =>
    z.object({ url: z.string().trim().url().max(2000) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { scrapeProduct } = await import("./scrape.server");
    try {
      return { ok: true as const, data: await scrapeProduct(data.url) };
    } catch {
      return {
        ok: false as const,
        data: {
          name: null,
          price: null,
          image: null,
          category: null,
          outOfStock: false,
        },
      };
    }

  });
