import React, { useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => Promise<void>;
  title: string;
  description: string;
  itemDetails?: Record<string, string | number | undefined>;
  itemName?: string;
  critical?: boolean;
}

export const DeleteConfirmDialog = ({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  itemDetails,
  itemName,
  critical = false
}: DeleteConfirmDialogProps) => {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsDeleting(true);
      await onConfirm();
      onOpenChange(false);
    } catch (error) {
      console.error("Erro ao excluir item:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <div className={cn(
              "p-2 rounded-full",
              critical ? "bg-destructive/10 text-destructive" : "bg-yellow-500/10 text-yellow-500"
            )}>
              <AlertTriangle className="h-5 w-5" />
            </div>
            <AlertDialogTitle className="text-xl font-bold">
              {title}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription className="text-muted-foreground leading-relaxed">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {itemDetails && (
          <div className="my-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>Detalhes do item:</span>
            </div>
            <ScrollArea className="max-h-[150px] w-full rounded-md border bg-muted/50 p-3">
              <div className="space-y-2">
                {itemName && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground font-normal">Nome:</span>
                    <span className="font-semibold">{itemName}</span>
                  </div>
                )}
                {Object.entries(itemDetails).map(([key, value]) => (
                  value && (
                    <div key={key} className="flex justify-between text-sm border-t border-border/50 pt-1 mt-1 first:mt-0 first:pt-0 first:border-0">
                      <span className="text-muted-foreground font-normal capitalize">{key.replace(/_/g, ' ')}:</span>
                      <span className="font-mono text-[12px] opacity-80">{value}</span>
                    </div>
                  )
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        <div className="bg-muted/30 p-3 rounded-lg border border-border/50 text-xs text-muted-foreground italic mb-4">
          Nota: Você poderá recuperar este item na Lixeira por até 24 horas após a exclusão.
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleConfirm();
            }}
            disabled={isDeleting}
            className={cn(
              "bg-destructive hover:bg-destructive/90 text-destructive-foreground",
              isDeleting && "opacity-50 cursor-not-allowed"
            )}
          >
            {isDeleting ? "Excluindo..." : "Confirmar Exclusão"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
