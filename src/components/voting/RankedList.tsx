
"use client";

import React, { useState } from 'react';
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

  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (disabled) return;
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
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

  const handleDragEnd = () => {
    setDraggedIndex(null);
    onOrderChange(items.map(p => p.id));
  };

  return (
    <div className="space-y-4">
      {items.map((project, index) => (
        <div
          key={project.id}
          draggable={!disabled}
          onDragStart={(e) => handleDragStart(e, index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragEnd={handleDragEnd}
          className={cn(
            "flex items-center gap-6 p-4 bg-white border border-border transition-all duration-200",
            draggedIndex === index ? "border-primary opacity-50 ring-1 ring-primary" : "hover:border-muted-foreground/30",
            disabled ? "cursor-default" : "cursor-move"
          )}
        >
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center border border-border text-sm font-bold bg-secondary">
            {index + 1}
          </div>
          
          <div className="flex-grow">
            <h4 className="text-base font-semibold">{project.title}</h4>
            <p className="text-sm text-muted-foreground line-clamp-1">{project.summary}</p>
          </div>

          {!disabled && (
            <div className="flex-shrink-0 text-muted-foreground/50">
              <GripVertical className="h-5 w-5" />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
