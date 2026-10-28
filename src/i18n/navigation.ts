import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware replacements for next/link and next/navigation. Always import from here. */
export const { Link, redirect, permanentRedirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
