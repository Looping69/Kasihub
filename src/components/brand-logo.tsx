import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  priority?: boolean;
};

// Canonical KaSiHub platform mark supplied by Lanie. ( |╲ )
export function BrandLogo({ className, priority = false }: BrandLogoProps) {
  return (
    <Image
      src="/kasihub-logo-20260812-v2.png"
      alt="KaSiHub — Earn More. Save More. Benefit More."
      width={265}
      height={150}
      priority={priority}
      loading="eager"
      className={cn("object-contain", className)}
    />
  );
}
