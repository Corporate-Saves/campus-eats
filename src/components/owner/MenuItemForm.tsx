"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Controller, useForm } from "react-hook-form";
import toast from "react-hot-toast";
import { z } from "zod";
import type { MenuCategoryDTO } from "@/types/menu";
import {
  OWNER_MENU_TAGS,
  type OwnerMenuItemDTO,
} from "@/types/owner-menu";

const tagEnum = z.enum(OWNER_MENU_TAGS);

const formSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(2000).optional(),
  category_id: z.string().uuid("Pick a category"),
  price: z.number().min(0, "Price must be 0 or more"),
  is_veg: z.boolean(),
  max_daily_quantity: z.union([z.number().int().min(0), z.null()]),
  tags: z.array(tagEnum),
  image_url: z
    .string()
    .optional()
    .refine((s) => !s || /^https?:\/\/.+/i.test(s), "Invalid image URL"),
  is_available: z.boolean(),
});

export type MenuItemFormValues = z.infer<typeof formSchema>;

type Props = {
  open: boolean;
  onClose: () => void;
  categories: MenuCategoryDTO[];
  editingItem: OwnerMenuItemDTO | null;
  defaultCategoryId: string | null;
  onSaved: () => void;
};

function itemToDefaults(
  item: OwnerMenuItemDTO | null,
  categories: MenuCategoryDTO[],
  defaultCategoryId: string | null,
): MenuItemFormValues {
  const catId = defaultCategoryId ?? categories[0]?.id ?? "";
  if (!item) {
    return {
      name: "",
      description: "",
      category_id: catId,
      price: 0,
      is_veg: true,
      max_daily_quantity: null,
      tags: [],
      image_url: "",
      is_available: true,
    };
  }
  return {
    name: item.name,
    description: item.description ?? "",
    category_id: item.category_id,
    price: item.price,
    is_veg: item.is_veg,
    max_daily_quantity: item.max_daily_quantity,
    tags: (item.tags ?? []).filter((t): t is z.infer<typeof tagEnum> =>
      OWNER_MENU_TAGS.includes(t as (typeof OWNER_MENU_TAGS)[number]),
    ),
    image_url: item.image_url ?? "",
    is_available: item.is_available,
  };
}

export function MenuItemForm({
  open,
  onClose,
  categories,
  editingItem,
  defaultCategoryId,
  onSaved,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const form = useForm<MenuItemFormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: itemToDefaults(null, categories, defaultCategoryId),
  });

  const { register, handleSubmit, reset, watch, setValue, control, formState } =
    form;

  useEffect(() => {
    if (open) {
      reset(itemToDefaults(editingItem, categories, defaultCategoryId));
    }
  }, [open, editingItem, defaultCategoryId, categories, reset]);

  const imageUrl = watch("image_url");

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/menu-items/upload-image", {
        method: "POST",
        body: fd,
      });
      const body = (await res.json()) as { error?: string; url?: string };
      if (!res.ok) {
        toast.error(body.error ?? "Upload failed");
        return;
      }
      if (body.url) {
        setValue("image_url", body.url, { shouldValidate: true });
        toast.success("Image uploaded");
      }
    } catch {
      toast.error("Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const onSubmit = async (values: MenuItemFormValues) => {
    const payload = {
      category_id: values.category_id,
      name: values.name.trim(),
      description: values.description?.trim() || null,
      price: values.price,
      is_veg: values.is_veg,
      max_daily_quantity: values.max_daily_quantity,
      tags: values.tags,
      image_url:
        values.image_url && values.image_url.length > 0
          ? values.image_url
          : null,
      is_available: values.is_available,
    };

    try {
      if (editingItem) {
        const res = await fetch(`/api/menu-items/${editingItem.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(body.error ?? "Could not update item");
          return;
        }
        toast.success("Item updated");
      } else {
        const res = await fetch("/api/menu-items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const body = (await res.json()) as { error?: string };
        if (!res.ok) {
          toast.error(body.error ?? "Could not create item");
          return;
        }
        toast.success("Item created");
      }
      onSaved();
      onClose();
    } catch {
      toast.error("Network error");
    }
  };

  if (!mounted || !open || categories.length === 0) return null;

  const drawer = (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-lg flex-col border-l border-muted/20 bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-muted/15 px-4 py-3">
          <h2 className="text-lg font-semibold text-text">
            {editingItem ? "Edit menu item" : "Add menu item"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-muted/15"
          >
            ✕
          </button>
        </div>
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-1 flex-col overflow-y-auto p-4"
        >
          <label className="mb-1 text-xs font-medium text-muted">Name</label>
          <input
            className="mb-3 rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm"
            {...register("name")}
          />
          {formState.errors.name && (
            <p className="mb-2 text-xs text-red-600">
              {formState.errors.name.message}
            </p>
          )}

          <label className="mb-1 text-xs font-medium text-muted">
            Description
          </label>
          <textarea
            rows={3}
            className="mb-3 rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm"
            {...register("description")}
          />

          <label className="mb-1 text-xs font-medium text-muted">
            Category
          </label>
          <select
            className="mb-3 rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm"
            {...register("category_id")}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {formState.errors.category_id && (
            <p className="mb-2 text-xs text-red-600">
              {formState.errors.category_id.message}
            </p>
          )}

          <label className="mb-1 text-xs font-medium text-muted">
            Price (₹)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            className="mb-3 rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm tabular-nums"
            {...register("price", { valueAsNumber: true })}
          />
          {formState.errors.price && (
            <p className="mb-2 text-xs text-red-600">
              {formState.errors.price.message}
            </p>
          )}

          <div className="mb-3 flex items-center gap-2">
            <input type="checkbox" id="is_veg" {...register("is_veg")} />
            <label htmlFor="is_veg" className="text-sm text-text">
              Vegetarian
            </label>
          </div>

          <div className="mb-3 flex items-center gap-2">
            <input
              type="checkbox"
              id="is_available"
              {...register("is_available")}
            />
            <label htmlFor="is_available" className="text-sm text-text">
              Available on menu
            </label>
          </div>

          <label className="mb-1 text-xs font-medium text-muted">
            Max daily quantity (optional)
          </label>
          <input
            type="number"
            min={0}
            step={1}
            className="mb-3 rounded-lg border border-muted/30 bg-background px-3 py-2 text-sm tabular-nums"
            placeholder="No limit"
            {...register("max_daily_quantity", {
              setValueAs: (v) =>
                v === "" || v === undefined || Number.isNaN(Number(v))
                  ? null
                  : Number(v),
            })}
          />

          <span className="mb-2 text-xs font-medium text-muted">Tags</span>
          <Controller
            control={control}
            name="tags"
            render={({ field }) => (
              <div className="mb-3 flex flex-wrap gap-3">
                {OWNER_MENU_TAGS.map((tag) => (
                  <label key={tag} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="checkbox"
                      checked={field.value.includes(tag)}
                      onChange={() => {
                        const cur = field.value;
                        field.onChange(
                          cur.includes(tag)
                            ? cur.filter((t) => t !== tag)
                            : [...cur, tag],
                        );
                      }}
                      className="rounded border-muted/40"
                    />
                    {tag}
                  </label>
                ))}
              </div>
            )}
          />

          <label className="mb-1 text-xs font-medium text-muted">Image</label>
          <div className="mb-3 flex flex-col gap-2">
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt=""
                className="h-32 w-full max-w-xs rounded-lg border border-muted/20 object-cover"
              />
            ) : null}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              disabled={uploading}
              onChange={(e) => void onFile(e)}
              className="text-sm"
            />
            {imageUrl ? (
              <button
                type="button"
                className="w-fit text-xs text-red-600 hover:underline"
                onClick={() => setValue("image_url", "", { shouldValidate: true })}
              >
                Remove image
              </button>
            ) : null}
          </div>
          <input type="hidden" {...register("image_url")} />

          <div className="mt-auto flex gap-2 border-t border-muted/15 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-muted/30 py-2.5 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={formState.isSubmitting}
              className="flex-1 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
            >
              {editingItem ? "Save" : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return createPortal(drawer, document.body);
}
