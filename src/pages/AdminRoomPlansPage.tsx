import React, { useEffect, useMemo, useRef, useState } from 'react';
import DashboardLayout from '../components/Admin/DashboardLayout';
import {
  createRoomPlan,
  deleteRoomPlan,
  fetchRoomPlan,
  fetchRoomPlans,
  saveRoomPlanItemsBulk,
  updateRoomPlan,
  uploadRoomPlanBackground,
} from '../services/roomPlanService';
import type { RoomPlan, RoomPlanItem, RoomPlanItemType } from '../types';
import { clampRoomPlanItem, nextZIndex, ROOM_PLAN_ITEM_GROUPS } from '../utils/roomPlan';

type DragState = {
  itemId: number;
  offsetX: number;
  offsetY: number;
} | null;

const DEFAULT_ITEM_SIZE: Record<RoomPlanItemType, { width: number; height: number; seats?: number }> = {
  table: { width: 120, height: 120, seats: 4 },
  window: { width: 160, height: 40 },
  counter: { width: 180, height: 70 },
  bar: { width: 220, height: 80 },
  kitchen: { width: 260, height: 150 },
  cashier: { width: 140, height: 70 },
  fridge: { width: 70, height: 90 },
  sofa: { width: 170, height: 80 },
  plant: { width: 60, height: 60 },
  wc: { width: 90, height: 90 },
};

const typeLabel = (type: RoomPlanItemType): string => {
  const found = ROOM_PLAN_ITEM_GROUPS.flatMap((group) => group.options).find((option) => option.value === type);
  return found?.label || type;
};

const AdminRoomPlansPage: React.FC = () => {
  const roomRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [roomPlans, setRoomPlans] = useState<RoomPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<RoomPlan | null>(null);
  const [items, setItems] = useState<RoomPlanItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [pendingType, setPendingType] = useState<RoomPlanItemType>('table');
  const [dragState, setDragState] = useState<DragState>(null);

  const [newPlanName, setNewPlanName] = useState('Main Room');
  const [newPlanWidth, setNewPlanWidth] = useState(1200);
  const [newPlanHeight, setNewPlanHeight] = useState(900);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const selectedType = selectedItem?.type ?? pendingType;

  const loadRoomPlans = async () => {
    setLoading(true);
    setError(null);

    try {
      const plans = await fetchRoomPlans();
      setRoomPlans(plans);
      if (!selectedPlanId && plans.length > 0) {
        setSelectedPlanId(plans[0].id);
      }
      if (plans.length === 0) {
        setSelectedPlanId(null);
        setSelectedPlan(null);
        setItems([]);
      }
    } catch {
      setError('Failed to load room plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRoomPlans();
  }, []);

  useEffect(() => {
    const loadPlan = async () => {
      if (!selectedPlanId) {
        setSelectedPlan(null);
        setItems([]);
        return;
      }

      setError(null);
      try {
        const plan = await fetchRoomPlan(selectedPlanId);
        setSelectedPlan(plan);
        setItems((plan.items ?? []).sort((left, right) => left.z_index - right.z_index));
        setSelectedItemId(null);
      } catch {
        setError('Failed to load selected room plan.');
      }
    };

    void loadPlan();
  }, [selectedPlanId]);

  useEffect(() => {
    if (!dragState || !selectedPlan || !roomRef.current) {
      return;
    }

    const handleMove = (event: MouseEvent) => {
      const rect = roomRef.current?.getBoundingClientRect();
      if (!rect) return;

      setItems((current) => current.map((item) => {
        if (item.id !== dragState.itemId) return item;

        const next = {
          ...item,
          x: event.clientX - rect.left - dragState.offsetX,
          y: event.clientY - rect.top - dragState.offsetY,
        };

        return clampRoomPlanItem(next, selectedPlan.width, selectedPlan.height);
      }));
    };

    const handleUp = () => {
      setDragState(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, selectedPlan]);

  const handleCreatePlan = async () => {
    setError(null);
    setSuccess(null);

    if (!newPlanName.trim()) {
      setError('Plan name is required.');
      return;
    }

    try {
      const plan = await createRoomPlan({
        name: newPlanName.trim(),
        width: Number(newPlanWidth),
        height: Number(newPlanHeight),
      });
      setSuccess('Room plan created.');
      await loadRoomPlans();
      setSelectedPlanId(plan.id);
    } catch {
      setError('Failed to create room plan.');
    }
  };

  const handleUpdatePlanMeta = async () => {
    if (!selectedPlan) return;

    setError(null);
    setSuccess(null);

    try {
      const updated = await updateRoomPlan(selectedPlan.id, {
        name: selectedPlan.name,
        width: selectedPlan.width,
        height: selectedPlan.height,
      });
      setSelectedPlan(updated);
      setSuccess('Room plan details updated.');
      await loadRoomPlans();
    } catch {
      setError('Failed to update room plan details.');
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) return;
    const confirmed = window.confirm(`Delete room plan "${selectedPlan.name}"?`);
    if (!confirmed) return;

    try {
      await deleteRoomPlan(selectedPlan.id);
      setSuccess('Room plan deleted.');
      await loadRoomPlans();
    } catch {
      setError('Failed to delete room plan.');
    }
  };

  const handleUploadBackground = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPlan) return;

    setUploading(true);
    setError(null);
    setSuccess(null);

    try {
      const updated = await uploadRoomPlanBackground(selectedPlan.id, file);
      setSelectedPlan(updated);
      setSuccess('Background image uploaded.');
    } catch {
      setError('Failed to upload background image.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleAddItem = () => {
    if (!selectedPlan) return;

    const size = DEFAULT_ITEM_SIZE[selectedType];
    const generatedId = -Math.floor(Math.random() * 1_000_000_000);
    const nextItem: RoomPlanItem = {
      id: generatedId,
      room_plan_id: selectedPlan.id,
      type: selectedType,
      label: `${typeLabel(selectedType)} ${items.length + 1}`,
      x: 40,
      y: 40,
      width: size.width,
      height: size.height,
      rotation: 0,
      seats: selectedType === 'table' ? size.seats ?? 2 : null,
      z_index: nextZIndex(items),
      container: 'room',
      is_active: true,
    };

    setItems((current) => [...current, nextItem]);
    setSelectedItemId(nextItem.id);
  };

  const handleSelectItemType = (nextType: RoomPlanItemType) => {
    if (selectedItem) {
      setItems((current) => current.map((item) => {
        if (item.id !== selectedItem.id) return item;

        return {
          ...item,
          type: nextType,
          seats: nextType === 'table' ? (item.seats ?? 2) : null,
        };
      }));
      return;
    }

    setPendingType(nextType);
  };

  const patchSelectedItem = (patch: Partial<RoomPlanItem>) => {
    if (!selectedPlan || !selectedItem) return;

    setItems((current) => current.map((item) => {
      if (item.id !== selectedItem.id) return item;
      return clampRoomPlanItem({ ...item, ...patch }, selectedPlan.width, selectedPlan.height);
    }));
  };

  const handleDuplicateSelected = () => {
    if (!selectedPlan || !selectedItem) return;

    const duplicate: RoomPlanItem = clampRoomPlanItem(
      {
        ...selectedItem,
        id: -Math.floor(Math.random() * 1_000_000_000),
        label: `${selectedItem.label} Copy`,
        x: selectedItem.x + 24,
        y: selectedItem.y + 24,
        z_index: nextZIndex(items),
      },
      selectedPlan.width,
      selectedPlan.height
    );

    setItems((current) => [...current, duplicate]);
    setSelectedItemId(duplicate.id);
  };

  const handleDeleteSelected = () => {
    if (!selectedItem) return;

    setItems((current) => current.filter((item) => item.id !== selectedItem.id));
    setSelectedItemId(null);
  };

  const handleSaveLayout = async () => {
    if (!selectedPlan) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const savedItems = await saveRoomPlanItemsBulk(selectedPlan.id, items);
      setItems(savedItems.sort((left, right) => left.z_index - right.z_index));
      setSuccess('Room plan layout saved successfully.');
      await loadRoomPlans();
    } catch {
      setError('Failed to save room plan layout.');
    } finally {
      setSaving(false);
    }
  };

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.z_index - right.z_index),
    [items]
  );

  return (
    <DashboardLayout title="Room Plan Editor">
      <div className="grid gap-5 xl:grid-cols-[340px_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted2">Create Room Plan</h2>
            <div className="mt-3 space-y-2">
              <input
                value={newPlanName}
                onChange={(event) => setNewPlanName(event.target.value)}
                placeholder="Plan name"
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={newPlanWidth}
                  onChange={(event) => setNewPlanWidth(Number(event.target.value))}
                  placeholder="Width"
                  className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                />
                <input
                  type="number"
                  value={newPlanHeight}
                  onChange={(event) => setNewPlanHeight(Number(event.target.value))}
                  placeholder="Height"
                  className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                />
              </div>
              <button
                type="button"
                onClick={handleCreatePlan}
                className="w-full rounded-xl border border-gold/40 bg-gold/20 px-3 py-2 text-sm font-semibold text-gold2 transition hover:border-gold/60"
              >
                Create Plan
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted2">Saved Plans</h2>
            {loading ? (
              <p className="mt-3 text-sm text-muted">Loading room plans...</p>
            ) : roomPlans.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No room plans yet.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {roomPlans.map((plan) => (
                  <button
                    key={plan.id}
                    type="button"
                    onClick={() => setSelectedPlanId(plan.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                      selectedPlanId === plan.id
                        ? 'border-gold/50 bg-gold/15 text-gold2'
                        : 'border-stroke bg-bg1/60 text-text hover:border-gold/35'
                    }`}
                  >
                    <div className="font-semibold">{plan.name}</div>
                    <div className="text-xs text-muted">{plan.width} x {plan.height} • {plan.items_count ?? 0} items</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPlan ? (
            <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted2">Selected Plan</h2>
              <div className="mt-3 space-y-2">
                <input
                  value={selectedPlan.name}
                  onChange={(event) => setSelectedPlan((current) => (current ? { ...current, name: event.target.value } : current))}
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={selectedPlan.width}
                    onChange={(event) => setSelectedPlan((current) => (
                      current ? { ...current, width: Number(event.target.value) } : current
                    ))}
                    className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  />
                  <input
                    type="number"
                    value={selectedPlan.height}
                    onChange={(event) => setSelectedPlan((current) => (
                      current ? { ...current, height: Number(event.target.value) } : current
                    ))}
                    className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleUpdatePlanMeta}
                  className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text transition hover:border-gold/35"
                >
                  Update Plan Details
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full rounded-xl border border-sky-400/35 bg-sky-500/10 px-3 py-2 text-sm text-sky-200 transition hover:border-sky-400/55"
                >
                  {uploading ? 'Uploading image...' : 'Upload Background Image'}
                </button>
                <button
                  type="button"
                  onClick={handleDeletePlan}
                  className="w-full rounded-xl border border-spicy/45 bg-spicy/10 px-3 py-2 text-sm text-spicy transition hover:border-spicy/65"
                >
                  Delete Plan
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
                  onChange={handleUploadBackground}
                  className="hidden"
                />
              </div>
            </div>
          ) : null}
        </div>

        <div className="space-y-4">
          {selectedPlan ? (
            <>
              <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
                <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto_auto]">
                  <select
                    value={selectedType}
                    onChange={(event) => handleSelectItemType(event.target.value as RoomPlanItemType)}
                    className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                  >
                    {ROOM_PLAN_ITEM_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.options.map((option) => (
                          <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="rounded-xl border border-gold/45 bg-gold/15 px-3 py-2 text-sm font-semibold text-gold2 transition hover:border-gold/65"
                  >
                    Add Item
                  </button>

                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    disabled={!selectedItem}
                    className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text transition hover:border-gold/35 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Duplicate
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={!selectedItem}
                    className="rounded-xl border border-spicy/45 bg-spicy/10 px-3 py-2 text-sm text-spicy transition hover:border-spicy/65 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>

                {selectedItem ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <input
                      value={selectedItem.label}
                      onChange={(event) => patchSelectedItem({ label: event.target.value })}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                      placeholder="Label"
                    />
                    <input
                      type="number"
                      value={selectedItem.width}
                      onChange={(event) => patchSelectedItem({ width: Number(event.target.value) })}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                      placeholder="Width"
                    />
                    <input
                      type="number"
                      value={selectedItem.height}
                      onChange={(event) => patchSelectedItem({ height: Number(event.target.value) })}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                      placeholder="Height"
                    />
                    <input
                      type="number"
                      value={selectedItem.rotation}
                      onChange={(event) => patchSelectedItem({ rotation: Number(event.target.value) })}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                      placeholder="Rotation"
                    />
                    <input
                      type="number"
                      value={selectedItem.z_index}
                      onChange={(event) => patchSelectedItem({ z_index: Number(event.target.value) })}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                      placeholder="Z index"
                    />
                    <select
                      value={selectedItem.container}
                      onChange={(event) => patchSelectedItem({ container: event.target.value as RoomPlanItem['container'] })}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                    >
                      <option value="room">Room</option>
                      <option value="wrapper">Wrapper</option>
                    </select>
                    {selectedItem.type === 'table' ? (
                      <input
                        type="number"
                        value={selectedItem.seats ?? 2}
                        onChange={(event) => patchSelectedItem({ seats: Number(event.target.value) })}
                        className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                        placeholder="Seats"
                      />
                    ) : null}
                    <div className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-xs text-muted">
                      Drag on canvas to move
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">Select an item to edit width, height, rotation, z-index, seats, and label.</p>
                )}
              </div>

              <div className="rounded-2xl border border-stroke bg-bg0/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted2">Layout Canvas</h3>
                    <p className="text-xs text-muted">Items are constrained inside the room bounds ({selectedPlan.width} x {selectedPlan.height}).</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveLayout}
                    disabled={saving}
                    className="rounded-xl border border-gold/45 bg-gold/20 px-4 py-2 text-sm font-semibold text-gold2 transition hover:border-gold/65 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? 'Saving...' : 'Save Layout'}
                  </button>
                </div>

                <div className="overflow-auto rounded-xl border border-stroke bg-bg1/30 p-3">
                  <div
                    ref={roomRef}
                    className="relative overflow-hidden rounded-lg border border-stroke"
                    style={{
                      width: selectedPlan.width,
                      height: selectedPlan.height,
                      backgroundImage: selectedPlan.background_image_url ? `url(${selectedPlan.background_image_url})` : undefined,
                      backgroundPosition: 'center',
                      backgroundSize: 'cover',
                      backgroundColor: 'rgba(8, 10, 20, 0.35)',
                    }}
                  >
                    {sortedItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onMouseDown={(event) => {
                          const rect = roomRef.current?.getBoundingClientRect();
                          if (!rect) return;

                          event.preventDefault();
                          setSelectedItemId(item.id);
                          setDragState({
                            itemId: item.id,
                            offsetX: event.clientX - rect.left - item.x,
                            offsetY: event.clientY - rect.top - item.y,
                          });
                        }}
                        onClick={() => setSelectedItemId(item.id)}
                        className={`absolute border text-left transition ${
                          selectedItemId === item.id
                            ? 'border-gold2 bg-gold/20 text-gold2'
                            : 'border-stroke bg-bg1/80 text-text hover:border-gold/45'
                        }`}
                        style={{
                          left: item.x,
                          top: item.y,
                          width: item.width,
                          height: item.height,
                          transform: `rotate(${item.rotation}deg)`,
                          zIndex: item.z_index,
                          padding: 6,
                        }}
                      >
                        <div className="pointer-events-none text-[11px] font-semibold uppercase tracking-[0.08em]">{item.label}</div>
                        <div className="pointer-events-none text-[10px] text-muted">
                          {typeLabel(item.type)}{item.type === 'table' ? ` • ${item.seats ?? 0} seats` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-stroke bg-bg1/60 p-6 text-center text-muted">
              Select or create a room plan to start editing.
            </div>
          )}

          {error ? <div className="rounded-xl border border-spicy/45 bg-spicy/10 px-3 py-2 text-sm text-spicy">{error}</div> : null}
          {success ? <div className="rounded-xl border border-sage/45 bg-sage/10 px-3 py-2 text-sm text-sage">{success}</div> : null}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminRoomPlansPage;
