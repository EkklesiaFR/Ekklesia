'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { GripVertical } from 'lucide-react';
import {
  DndContext,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { Project } from '@/types';
import { cn } from '@/lib/utils';

interface RankedListProps {
  projects: Project[];
  onOrderChange: (newOrder: string[]) => void;
  disabled?: boolean;
}

interface SortableRowProps {
  project: Project;
  index: number;
  disabled?: boolean;
}

function SortableRow({ project, index, disabled }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: project.id,
    disabled,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group flex items-center gap-4 rounded-2xl border border-white/60 bg-white/40 p-4 backdrop-blur-md transition-all duration-200 touch-manipulation',
        isDragging
          ? 'z-10 scale-[1.01] border-primary/30 bg-white/65 shadow-[0_14px_30px_rgba(15,23,42,0.10)] ring-1 ring-primary/20'
          : 'hover:bg-white/55',
        disabled ? 'cursor-default' : 'cursor-default'
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border text-sm font-bold transition-all',
          isDragging
            ? 'border-primary/30 bg-primary/10 text-primary'
            : 'border-white/70 bg-white/55 text-foreground'
        )}
      >
        {index + 1}
      </div>

      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 text-lg font-semibold leading-tight text-foreground">
          {project.title}
        </h4>
        <p className="mt-1 text-xs font-medium text-muted-foreground">{project.budget}</p>
      </div>

      {!disabled && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          {...attributes}
          {...listeners}
          aria-label={`Déplacer ${project.title}`}
          className="shrink-0 touch-none rounded-full border border-white/60 bg-white/45 p-3 text-muted-foreground/70 transition-colors group-hover:text-foreground active:scale-95"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function RankedList({ projects, onOrderChange, disabled = false }: RankedListProps) {
  const [items, setItems] = useState(projects);

  useEffect(() => {
    setItems(projects);
  }, [projects]);

  const itemIds = useMemo(() => items.map((project) => project.id), [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150,
        tolerance: 8,
      },
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = items.findIndex((item) => item.id === active.id);
    const newIndex = items.findIndex((item) => item.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(items, oldIndex, newIndex);

    setItems(reordered);
    onOrderChange(reordered.map((project) => project.id));
  };

  return (
    <DndContext
      sensors={disabled ? undefined : sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          {items.map((project, index) => (
            <SortableRow
              key={project.id}
              project={project}
              index={index}
              disabled={disabled}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

export default RankedList;