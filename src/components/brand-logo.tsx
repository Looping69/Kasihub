import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

// Canonical KaSiHub platform mark supplied by Klaasvaakie. ( |╲ )
export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/kasihub-logo.webp"
      alt="KaSiHub — Earn More. Save More. Benefit More."
      width={500}
      height={281}
      priority={priority}
      loading="eager"
      className={cn("object-contain", className)}
    />
  );
}
