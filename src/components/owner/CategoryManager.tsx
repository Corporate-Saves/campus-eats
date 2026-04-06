"use client";

import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";
import type { MenuCategoryDTO } from "@/types/menu";

function SortableRow({
  cat,
  editingId,
  editName,
  setEditName,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
}: {
  cat: MenuCategoryDTO;
  editingId: string | null;
  editName: string;
  setEditName: (s: string) => void;
  onStartEdit: (c: MenuCategoryDTO) => void;
  onSaveEdit: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: cat.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.7 : 1,
  };

  const isEditing = editingId === cat.id;

  return (
    <li
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-2 rounded-lg border border-muted/15 bg-background/80 px-2 py-2"
    >
      <button
        type="button"
        className="cursor-grab touch-none px-1 text-muted active:cursor-grabbing"
        aria-label="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        ⋮⋮
      </button>
      {isEditing ? (
        <>
          <input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            className="min-w-0 flex-1 rounded border border-muted/30 px-2 py-1 text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") onSaveEdit(cat.id);
              if (e.key === "Escape") onCancelEdit();
            }}
          />
          <button
            type="button"
            className="text-xs font-medium text-primary"
            onClick={() => onSaveEdit(cat.id)}
          >
            Save
          </button>
          <button
            type="button"
            className="text-xs text-muted"
            onClick={onCancelEdit}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <span
            className="min-w-0 flex-1 cursor-default truncate text-sm font-medium text-text"
            onDoubleClick={() => onStartEdit(cat)}
            title="Double-click to rename"
          >
            {cat.name}
          </span>
          <button
            type="button"
            className="text-xs text-red-600 hover:underline"
            onClick={() => onDelete(cat.id)}
          >
            Delete
          </button>
        </>
      )}
    </li>
  );
}

export function CategoryManager({
  categories: initialCategories,
  onChanged,
}: {
  categories: MenuCategoryDTO[];
  onChanged: () => void;
}) {
  const [categories, setCategories] = useState(initialCategories);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setCategories(initialCategories);
  }, [initialCategories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  const ids = categories.map((c) => c.id);

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    const previous = categories;
    const next = arrayMove(categories, oldIndex, newIndex);
    setCategories(next);
    const category_ids = next.map((c) => c.id);
    try {
      const res = await fetch("/api/categories/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category_ids }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not save order");
        setCategories(previous);
        return;
      }
      onChanged();
    } catch {
      toast.error("Network error");
      setCategories(previous);
    }
  };

  const addCategory = async () => {
    const name = newName.trim();
    if (!name) {
      toast.error("Enter a category name");
      return;
    }
    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not create category");
        return;
      }
      setNewName("");
      setModalOpen(false);
      toast.success("Category added");
      onChanged();
    } catch {
      toast.error("Network error");
    }
  };

  const saveRename = async (id: string) => {
    const name = editName.trim();
    if (!name) {
      toast.error("Name required");
      return;
    }
    try {
      const res = await fetch(`/api/categories/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not rename");
        return;
      }
      setEditingId(null);
      toast.success("Renamed");
      onChanged();
    } catch {
      toast.error("Network error");
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("Delete this category? It must have no menu items.")) return;
    try {
      const res = await fetch(`/api/categories/${id}`, { method: "DELETE" });
      const body = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Could not delete");
        return;
      }
      toast.success("Category deleted");
      onChanged();
    } catch {
      toast.error("Network error");
    }
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const modal =
    modalOpen && mounted ? (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="Close"
          className="absolute inset-0 bg-black/40"
          onClick={() => setModalOpen(false)}
        />
        <div className="relative w-full max-w-sm rounded-2xl border border-muted/20 bg-background p-4 shadow-xl">
          <h3 className="text-lg font-semibold text-text">New category</h3>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Category name"
            className="mt-3 w-full rounded-lg border border-muted/30 px-3 py-2 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") void addCategory();
            }}
          />
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              className="rounded-lg px-3 py-2 text-sm text-muted"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground"
              onClick={() => void addCategory()}
            >
              Add
            </button>
          </div>
        </div>
      </div>
    ) : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Categories
        </h2>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="rounded-lg bg-primary/15 px-2.5 py-1 text-xs font-semibold text-primary"
        >
          Add category
        </button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => void handleDragEnd(e)}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <ul className="flex flex-col gap-2">
            {categories.map((cat) => (
              <SortableRow
                key={cat.id}
                cat={cat}
                editingId={editingId}
                editName={editName}
                setEditName={setEditName}
                onStartEdit={(c) => {
                  setEditingId(c.id);
                  setEditName(c.name);
                }}
                onSaveEdit={(id) => void saveRename(id)}
                onCancelEdit={() => setEditingId(null)}
                onDelete={(id) => void deleteCategory(id)}
              />
            ))}
          </ul>
        </SortableContext>
      </DndContext>
      {mounted && modalOpen ? createPortal(modal, document.body) : null}
    </div>
  );
}
