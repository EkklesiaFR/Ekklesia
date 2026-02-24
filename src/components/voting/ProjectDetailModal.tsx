
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { Project } from "@/types";
import { cn } from "@/lib/utils";
import Image from "next/image";

interface ProjectDetailModalProps {
  project: Project | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectDetailModal({ project, isOpen, onClose }: ProjectDetailModalProps) {
  if (!project) return null;

  return (
    <DialogPrimitive.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay 
          className="fixed inset-0 z-50 bg-black/10 backdrop-blur-[2px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300" 
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed left-[50%] top-[50%] z-50 w-full max-w-[900px] max-h-[90vh] translate-x-[-50%] translate-y-[-50%] overflow-y-auto bg-white p-12 shadow-none border-none outline-none",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 duration-300"
          )}
        >
          <div className="space-y-12">
            <header className="space-y-4">
              <div className="flex items-start justify-between gap-8">
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight leading-tight">
                  {project.title}
                </h2>
                <DialogPrimitive.Close className="flex-shrink-0 p-2 hover:bg-secondary transition-colors">
                  <X className="h-6 w-6" />
                  <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
              </div>
              <p className="text-lg font-medium text-muted-foreground">
                Budget : {project.budget}
              </p>
            </header>

            {project.imageUrl && (
              <div className="relative aspect-[21/9] w-full border border-border overflow-hidden">
                <Image
                  src={project.imageUrl}
                  alt={project.title}
                  fill
                  className="object-cover grayscale"
                />
              </div>
            )}

            <div className="grid md:grid-cols-[1fr_280px] gap-16">
              <div className="space-y-8">
                <div className="prose prose-neutral max-w-none">
                  <p className="text-xl leading-relaxed text-foreground/90 whitespace-pre-wrap">
                    {project.longDescription || project.summary}
                  </p>
                </div>
              </div>

              <aside className="space-y-12 pt-2">
                {project.ownerName && (
                  <section className="space-y-4">
                    <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground">
                      Porté par
                    </h4>
                    <div className="space-y-2">
                      <p className="font-bold text-lg">{project.ownerName}</p>
                      {project.ownerBio && (
                        <p className="text-sm leading-relaxed text-muted-foreground italic">
                          {project.ownerBio}
                        </p>
                      )}
                    </div>
                  </section>
                )}

                {project.links && project.links.length > 0 && (
                  <section className="space-y-4">
                    <h4 className="text-xs uppercase tracking-[0.2em] font-bold text-muted-foreground">
                      Liens
                    </h4>
                    <ul className="space-y-3">
                      {project.links.map((link, i) => (
                        <li key={i}>
                          <a 
                            href={link.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-primary hover:underline transition-all"
                          >
                            {link.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </aside>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
