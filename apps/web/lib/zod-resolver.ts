import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldValues, Resolver } from "react-hook-form";
import type { ZodType } from "zod";

/**
 * Bridges a type-only version skew: @hookform/resolvers@5 ships types pinned to
 * zod 4.0, while this project uses zod 4.4. Runtime behaviour is identical —
 * this wrapper just restores accurate `Resolver<T>` typing for the form values.
 */
export function zodFormResolver<T extends FieldValues>(
  schema: ZodType,
): Resolver<T> {
  return (zodResolver as unknown as (s: ZodType) => Resolver<T>)(schema);
}
