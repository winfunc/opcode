import * as React from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog";
import { Button } from "./button";

export interface AlertDialogProps {
  children: React.ReactNode;
}

export function AlertDialog({ children }: AlertDialogProps) {
  return <>{children}</>;
}

export interface AlertDialogTriggerProps {
  asChild?: boolean;
  children: React.ReactNode;
}

export function AlertDialogTrigger({ asChild, children }: AlertDialogTriggerProps) {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children);
  }
  return <>{children}</>;
}

export interface AlertDialogContentProps {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AlertDialogContent({ children }: AlertDialogContentProps) {
  return <>{children}</>;
}

export interface AlertDialogHeaderProps {
  children: React.ReactNode;
}

export function AlertDialogHeader({ children }: AlertDialogHeaderProps) {
  return <DialogHeader>{children}</DialogHeader>;
}

export interface AlertDialogTitleProps {
  children: React.ReactNode;
}

export function AlertDialogTitle({ children }: AlertDialogTitleProps) {
  return <DialogTitle>{children}</DialogTitle>;
}

export interface AlertDialogDescriptionProps {
  children: React.ReactNode;
}

export function AlertDialogDescription({ children }: AlertDialogDescriptionProps) {
  return <DialogDescription>{children}</DialogDescription>;
}

export interface AlertDialogFooterProps {
  children: React.ReactNode;
}

export function AlertDialogFooter({ children }: AlertDialogFooterProps) {
  return <DialogFooter>{children}</DialogFooter>;
}

export interface AlertDialogActionProps {
  onClick?: () => void;
  className?: string;
  children: React.ReactNode;
}

export function AlertDialogAction({ onClick, className, children }: AlertDialogActionProps) {
  return (
    <Button onClick={onClick} className={className}>
      {children}
    </Button>
  );
}

export interface AlertDialogCancelProps {
  onClick?: () => void;
  children: React.ReactNode;
}

export function AlertDialogCancel({ onClick, children }: AlertDialogCancelProps) {
  return (
    <Button variant="outline" onClick={onClick}>
      {children}
    </Button>
  );
}