import type { ReactNode } from "react";
import { TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useSidebar } from "../context/SidebarContext";

type NonStringLabel = Exclude<ReactNode, string>;

export type PageTabItem =
  | {
      value: string;
      label: string;
      mobileLabel?: string;
    }
  | {
      value: string;
      label: NonStringLabel;
      mobileLabel: string;
    };

type PageTabBarControlledProps = {
  items: PageTabItem[];
  align?: "center" | "start";
  value: string;
  onValueChange: (value: string) => void;
};

type PageTabBarUncontrolledProps = {
  items: PageTabItem[];
  align?: "center" | "start";
  value?: undefined;
  onValueChange?: undefined;
};

type PageTabBarProps = PageTabBarControlledProps | PageTabBarUncontrolledProps;

export function PageTabBar({ items, value, onValueChange, align = "center" }: PageTabBarProps) {
  const { isMobile } = useSidebar();

  if (isMobile && value !== undefined && onValueChange) {
    return (
      <select
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        className="h-9 rounded-md border border-border bg-background px-2 py-1 text-base focus:outline-none focus:ring-1 focus:ring-ring"
      >
        {items.map((item) => (
          <option key={item.value} value={item.value}>
            {item.mobileLabel ?? (typeof item.label === "string" ? item.label : item.mobileLabel)}
          </option>
        ))}
      </select>
    );
  }

  return (
    <TabsList variant="line" className={align === "start" ? "justify-start" : undefined}>
      {items.map((item) => (
        <TabsTrigger key={item.value} value={item.value}>
          {item.label}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}
