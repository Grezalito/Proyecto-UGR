import {
  Apple,
  Baby,
  Beef,
  Candy,
  Carrot,
  Cookie,
  Croissant,
  CupSoda,
  Drumstick,
  Egg,
  Fish,
  Milk,
  Package,
  PawPrint,
  Pill,
  Snowflake,
  SprayCan,
  Wine,
  type LucideIcon,
} from "lucide-react";
import { isCategoryIconName, type CategoryIconName } from "@/lib/category-icons";

const ICONS: Record<CategoryIconName, LucideIcon> = {
  Package,
  Milk,
  CupSoda,
  SprayCan,
  Croissant,
  Carrot,
  Apple,
  Beef,
  Fish,
  Drumstick,
  Egg,
  Cookie,
  Candy,
  Wine,
  Snowflake,
  Baby,
  PawPrint,
  Pill,
};

/** Ícono decorativo de una categoría (cae en "Package" si el nombre no es válido). */
export default function CategoryIcon({ name, className = "size-5" }: { name?: string; className?: string }) {
  const Icon = isCategoryIconName(name) ? ICONS[name] : Package;
  return <Icon aria-hidden className={className} />;
}
