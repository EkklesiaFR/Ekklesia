"use client";

import React, { useState, useEffect } from 'react';
import { GripVertical } from 'lucide-react';
import { Project } from '@/types';
import { cn } from '@/lib/utils';

interface RankedListProps {
  projects: Project[];
  onOrderChange: (newOrder: string[]) => void;
  disabled?: boolean;
}

export function RankedList({ projects, onOrderChange, disabled }: RankedListProps) {
  const [items, setItems] = useState(projects);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  // Synchroniser l'état local si les projets changent (ex: initialisation tardive)
  useEffect(() => {
    setItems(projects);
  }, [projects]);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    
    // Assurer la compatibilité mobile/touch via HTML5 si possible
    // ou simplement styliser l'élément fantôme
    const target = e.currentTarget as HTMLElement;
    target.classList.add('opacity-30');
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    if (disabled || draggedIndex === null || draggedIndex === index) return;
    e.preventDefault();
    
    const newItems = [...items];
    const draggedItem = newItems[draggedIndex];
    newItems.splice(draggedIndex, 1);
    newItems.splice(index, 0, draggedItem);
    
    setDraggedIndex(index);
    setItems(newItems);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    const target = e.currentTarget as HTMLElement;
    target.classList.remove('opacity-30');
    setDraggedIndex(null);
    onOrderChange(items.map(p => p.id));
  };

  return (
    <div className="space-y-3">
      {items.map((project, index) => (
        <div
          key={project.id}
          draggable={!disabled}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className={cn(
            "flex items-center gap-6 p-5 bg-white border border-border transition-all duration-300 group",
            draggedIndex === index ? "border-primary shadow-xl ring-1 ring-primary scale-[1.02] z-10" : "hover:border-black",
            disabled ? "cursor-default" : "cursor-grab active:cursor-grabbing"
          )}
        >
          <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center border border-border text-sm font-black bg-secondary transition-colors group-hover:bg-black group-hover:text-white group-hover:border-black">
            {index + 1}
          </div>
          
          <div className="flex-grow space-y-1">
            <h4 className="text-lg font-bold leading-tight">{project.title}</h4>
            <p className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground">{project.budget}</p>
          </div>

          {!disabled && (
            <div className="flex-shrink-0 text-muted-foreground/30 group-hover:text-black transition-colors">
              <GripVertical className="h-5 w-5" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
