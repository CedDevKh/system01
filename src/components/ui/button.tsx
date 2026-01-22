"use client";

import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost";

const BASE =
  "inline-flex items-center justify-center rounded-md text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed";

const VARIANT: Record<Variant, string> = {
  primary: "bg-blue-600 text-white hover:bg-blue-700",
  secondary: "border border-slate-300 bg-white text-slate-900 hover:bg-slate-50",
  ghost: "bg-transparent text-blue-600 hover:bg-blue-50",
};

type CommonProps = {
  variant?: Variant;
  className?: string;
  href?: string;
};

type ButtonProps = CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>;

type LinkButtonProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">;

export function Button({
  variant = "secondary",
  className,
  href,
  ...props
}: ButtonProps | LinkButtonProps) {
  const classes = cn(BASE, "px-4 py-2", VARIANT[variant], className);

  if (href) {
    const { onClick, ...rest } = props as LinkButtonProps;
    const ariaDisabled = (rest as any).disabled ? true : undefined;

    return (
      <Link
        href={href}
        className={cn(classes, ariaDisabled ? "pointer-events-none opacity-50" : false)}
        onClick={onClick}
        aria-disabled={ariaDisabled}
        {...rest}
      />
    );
  }

  return <button className={classes} {...(props as ButtonProps)} />;
}
