import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import { GlassToast, useGlassToast } from '../components/ui/liquid-glass';
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
import type { BorderSamplePoint } from '../utils/roomPlanGeometry';
import { findNearestBorderPoint, snapWindowItemToBorder, snapWindowUsingCurrentPosition } from '../utils/roomPlanWindowSnap';
import {
  buildSnapPoints,
  clearBorderOverlay,
  detectEdges,
  drawContourPreview,
  drawBorder,
  findContours,
  loadBorderPoints,
  pickContourByPoint,
  simplifyPath,
  type BorderGuidePoint,
  type DetectedContour,
} from '../utils/roomPlanEdgeOverlay';
import { resolveAssetUrl } from '../services/api';

type DragMode = 'free' | 'window';

type DragState = {
  itemId: number;
  offsetX: number;
  offsetY: number;
  mode: DragMode;
} | null;

const DEFAULT_ITEM_SIZE: Record<RoomPlanItemType, { width: number; height: number; seats?: number }> = {
  table: { width: 120, height: 120, seats: 4 },
  table_circle: { width: 120, height: 120, seats: 4 },
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

const getApiErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as AxiosError<{ message?: string; errors?: Record<string, string[]> }>).response;
    const firstValidationError = response?.data?.errors
      ? Object.values(response.data.errors)[0]?.[0]
      : null;

    if (firstValidationError) return firstValidationError;
    if (response?.data?.message) return response.data.message;
  }

  return fallback;
};

const ROOM_PLAN_BORDER_POINTS_KEY_PREFIX = 'room-plan-border-points:';

const getRoomPlanBorderPointsStorageKey = (roomPlanId: number): string => (
  `${ROOM_PLAN_BORDER_POINTS_KEY_PREFIX}${roomPlanId}`
);

const parsePersistedBorderPoints = (value: string): BorderGuidePoint[] | null => {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return null;

    const points = parsed.filter((entry): entry is BorderGuidePoint => (
      typeof entry === 'object'
      && entry !== null
      && typeof (entry as { x?: unknown }).x === 'number'
      && Number.isFinite((entry as { x: number }).x)
      && typeof (entry as { y?: unknown }).y === 'number'
      && Number.isFinite((entry as { y: number }).y)
    ));

    return points.length >= 3 ? points : null;
  } catch {
    return null;
  }
};

const primaryButtonClass = 'rounded-xl border border-gold/45 bg-gold/20 px-3 py-2 text-sm font-semibold text-gold2 transition hover:border-gold/65 disabled:cursor-not-allowed disabled:opacity-60';
const neutralButtonClass = 'rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text transition hover:border-gold/35 disabled:cursor-not-allowed disabled:opacity-60';
const dangerButtonClass = 'rounded-xl border border-spicy/45 bg-spicy/10 px-3 py-2 text-sm text-spicy transition hover:border-spicy/65 disabled:cursor-not-allowed disabled:opacity-60';

const AdminRoomPlansPage: React.FC = () => {
  const { t } = useTranslation();
  const { toast, showToast, dismiss } = useGlassToast(4200);
  const roomRef = useRef<HTMLDivElement | null>(null);
  const borderOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const borderInputRef = useRef<HTMLInputElement | null>(null);
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
  const [borderPoints, setBorderPoints] = useState<BorderSamplePoint[]>([]);
  const [snapWarning, setSnapWarning] = useState<string | null>(null);
  const [uploadedBorderPoints, setUploadedBorderPoints] = useState<BorderGuidePoint[]>([]);
  const [showBorderOverlay, setShowBorderOverlay] = useState(true);
  const [imageNaturalSize, setImageNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [edgeThreshold, setEdgeThreshold] = useState(34);
  const [simplifyTolerance, setSimplifyTolerance] = useState(3);
  const [showContours, setShowContours] = useState(true);
  const [detectedContours, setDetectedContours] = useState<DetectedContour[]>([]);
  const [selectedContourId, setSelectedContourId] = useState<string | null>(null);
  const windowDragSnapIndexRef = useRef<number | null>(null);

  const [newPlanName, setNewPlanName] = useState('Main Room');
  const [newPlanWidth, setNewPlanWidth] = useState(1200);
  const [newPlanHeight, setNewPlanHeight] = useState(900);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === selectedItemId) ?? null,
    [items, selectedItemId]
  );

  const selectedType = pendingType;
  const selectedPlanBackgroundImageUrl = resolveAssetUrl(selectedPlan?.background_image_url);
  const itemGroupLabels = useMemo(() => ({
    Tables: t('roomPlansPage.itemGroups.tables'),
    Structure: t('roomPlansPage.itemGroups.structure'),
    Furniture: t('roomPlansPage.itemGroups.furniture'),
  }), [t]);
  const itemTypeLabels = useMemo<Record<RoomPlanItemType, string>>(() => ({
    table: t('roomPlansPage.itemTypes.table'),
    table_circle: t('roomPlansPage.itemTypes.tableCircle'),
    window: t('roomPlansPage.itemTypes.window'),
    counter: t('roomPlansPage.itemTypes.counter'),
    bar: t('roomPlansPage.itemTypes.bar'),
    kitchen: t('roomPlansPage.itemTypes.kitchen'),
    cashier: t('roomPlansPage.itemTypes.cashier'),
    fridge: t('roomPlansPage.itemTypes.fridge'),
    sofa: t('roomPlansPage.itemTypes.sofa'),
    plant: t('roomPlansPage.itemTypes.plant'),
    wc: t('roomPlansPage.itemTypes.wc'),
  }), [t]);
  const typeLabel = useCallback((type: RoomPlanItemType): string => itemTypeLabels[type] ?? type, [itemTypeLabels]);

  const constrainItemToPlan = useCallback((item: RoomPlanItem, preferredSnapIndex: number | null = null): RoomPlanItem => {
    if (!selectedPlan) return item;

    if (item.type === 'window') {
      const snapped = snapWindowUsingCurrentPosition(
        {
          ...item,
          container: 'wrapper',
          rotation: item.rotation,
        },
        borderPoints,
        selectedPlan.width,
        selectedPlan.height,
        preferredSnapIndex
      );
      return snapped.item;
    }

    return clampRoomPlanItem(
      {
        ...item,
        container: item.container,
      },
      selectedPlan.width,
      selectedPlan.height
    );
  }, [borderPoints, selectedPlan]);

  const constrainItemsWithWindowSnap = useCallback((sourceItems: RoomPlanItem[]): RoomPlanItem[] => {
    if (!selectedPlan) return sourceItems;

    let changed = false;
    const constrained = sourceItems.map((item) => {
      if (item.type !== 'window') return item;
      const next = constrainItemToPlan(item);

      const hasChanged = (
        Math.abs(next.x - item.x) > 0.01
        || Math.abs(next.y - item.y) > 0.01
        || Math.abs(next.rotation - item.rotation) > 0.01
        || next.container !== item.container
      );

      if (hasChanged) {
        changed = true;
        return next;
      }

      return item;
    });

    return changed ? constrained : sourceItems;
  }, [constrainItemToPlan, selectedPlan]);

  const loadRoomPlans = useCallback(async () => {
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
    } catch (loadError: unknown) {
      setError(getApiErrorMessage(loadError, t('roomPlansPage.failedLoad')));
    } finally {
      setLoading(false);
    }
  }, [selectedPlanId, t]);

  useEffect(() => {
    void loadRoomPlans();
  }, [loadRoomPlans]);

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
      } catch (loadError: unknown) {
        setError(getApiErrorMessage(loadError, t('roomPlansPage.failedLoadSelected')));
      }
    };

    void loadPlan();
  }, [selectedPlanId, t]);

  useEffect(() => {
    if (error) {
      showToast(error, 'tertiary', 4800);
    }
  }, [error, showToast]);

  useEffect(() => {
    if (success) {
      showToast(success, 'secondary', 3600);
    }
  }, [showToast, success]);

  useEffect(() => {
    if (!selectedPlan) {
      setBorderPoints([]);
      setSnapWarning(null);
      setUploadedBorderPoints([]);
      setImageNaturalSize(null);
      setDetectedContours([]);
      setSelectedContourId(null);
      return;
    }

    const storageKey = getRoomPlanBorderPointsStorageKey(selectedPlan.id);
    const persistedValue = window.localStorage.getItem(storageKey);
    const persistedPoints = persistedValue ? parsePersistedBorderPoints(persistedValue) : null;

    if (persistedPoints) {
      const snapTrack = buildSnapPoints(persistedPoints, 8);
      if (snapTrack.length > 0) {
        setUploadedBorderPoints(persistedPoints);
        setBorderPoints(snapTrack);
        setSnapWarning(null);
        return;
      }
    }

    setUploadedBorderPoints([]);
    setBorderPoints([]);
    setSnapWarning(t('roomPlansPage.noUploadedBorderPath'));
  }, [selectedPlan, t]);

  useEffect(() => {
    if (!selectedPlan) return;

    const storageKey = getRoomPlanBorderPointsStorageKey(selectedPlan.id);

    if (uploadedBorderPoints.length < 3) {
      window.localStorage.removeItem(storageKey);
      return;
    }

    window.localStorage.setItem(storageKey, JSON.stringify(uploadedBorderPoints));
  }, [selectedPlan, uploadedBorderPoints]);

  useEffect(() => {
    if (!selectedPlan || !roomRef.current || !borderOverlayRef.current) return;
    borderOverlayRef.current.width = selectedPlan.width;
    borderOverlayRef.current.height = selectedPlan.height;
  }, [selectedPlan]);

  useEffect(() => {
    if (!selectedPlan) return;

    setItems((current) => constrainItemsWithWindowSnap(current));
  }, [constrainItemsWithWindowSnap, selectedPlan]);

  useEffect(() => {
    if (!dragState || !selectedPlan || !roomRef.current) {
      return;
    }

    const handleMove = (event: MouseEvent) => {
      const rect = roomRef.current?.getBoundingClientRect();
      if (!rect) return;

      setItems((current) => current.map((item) => {
        if (item.id !== dragState.itemId) return item;

        if (dragState.mode === 'window') {
          const anchor = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          };

          if (!borderPoints.length) {
            const fallbackWindow = {
              ...item,
              x: event.clientX - rect.left - dragState.offsetX,
              y: event.clientY - rect.top - dragState.offsetY,
              container: 'wrapper' as const,
            };
            return clampRoomPlanItem(fallbackWindow, selectedPlan.width, selectedPlan.height);
          }

          const snapped = snapWindowItemToBorder(
            item,
            borderPoints,
            selectedPlan.width,
            selectedPlan.height,
            anchor,
            windowDragSnapIndexRef.current
          );

          windowDragSnapIndexRef.current = snapped.snapIndex >= 0
            ? snapped.snapIndex
            : windowDragSnapIndexRef.current;

          return snapped.item;
        }

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
      windowDragSnapIndexRef.current = null;
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);

    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [borderPoints, dragState, selectedPlan]);

  const handleCreatePlan = async () => {
    setError(null);
    setSuccess(null);

    if (!newPlanName.trim()) {
      setError(t('roomPlansPage.planNameRequired'));
      return;
    }

    try {
      const plan = await createRoomPlan({
        name: newPlanName.trim(),
        width: Number(newPlanWidth),
        height: Number(newPlanHeight),
      });
      setSuccess(t('roomPlansPage.created'));
      await loadRoomPlans();
      setSelectedPlanId(plan.id);
    } catch (createError: unknown) {
      setError(getApiErrorMessage(createError, t('roomPlansPage.failedCreate')));
    }
  };

  const handleUploadBorderFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !selectedPlan) return;

    try {
      const rawPoints = await loadBorderPoints(file);
      const originalWidth = imageNaturalSize?.width ?? selectedPlan.width;
      const originalHeight = imageNaturalSize?.height ?? selectedPlan.height;
      if (originalWidth <= 0 || originalHeight <= 0) {
        setError(t('roomPlansPage.couldNotResolveImageSize'));
        return;
      }

      const scaledPoints = rawPoints.map((point) => ({
        x: point.x * (selectedPlan.width / originalWidth),
        y: point.y * (selectedPlan.height / originalHeight),
      }));

      const snapTrack = buildSnapPoints(scaledPoints, 8);
      if (!snapTrack.length) {
        setError(t('roomPlansPage.borderPointsCouldNotGenerateSnapPath'));
        return;
      }

      setUploadedBorderPoints(scaledPoints);
      setBorderPoints(snapTrack);
      setSnapWarning(null);
      setSuccess(t('roomPlansPage.borderLoaded', { count: scaledPoints.length }));
    } catch (uploadError: unknown) {
      const message = uploadError instanceof Error ? uploadError.message : t('roomPlansPage.failedParseBorderJson');
      setError(message);
    } finally {
      if (borderInputRef.current) borderInputRef.current.value = '';
    }
  }, [imageNaturalSize?.height, imageNaturalSize?.width, selectedPlan, t]);

  const handleClearBorder = useCallback(() => {
    if (borderOverlayRef.current) clearBorderOverlay(borderOverlayRef.current);
    if (selectedPlan) {
      window.localStorage.removeItem(getRoomPlanBorderPointsStorageKey(selectedPlan.id));
    }
    setUploadedBorderPoints([]);
    setBorderPoints([]);
    setSnapWarning(t('roomPlansPage.noUploadedBorderPath'));
    setDetectedContours([]);
    setSelectedContourId(null);
  }, [selectedPlan, t]);

  useEffect(() => {
    if (!borderOverlayRef.current || !selectedPlan) return;
    const selectedRaw = detectedContours.find((contour) => contour.id === selectedContourId)?.points ?? null;
    const selectedSimplified = selectedRaw ? simplifyPath(selectedRaw, simplifyTolerance) : null;

    if (detectedContours.length > 0) {
      drawContourPreview(borderOverlayRef.current, detectedContours, selectedContourId, selectedSimplified, showContours);
      return;
    }

    if (!showBorderOverlay || uploadedBorderPoints.length < 2) {
      clearBorderOverlay(borderOverlayRef.current);
      return;
    }
    drawBorder(borderOverlayRef.current, uploadedBorderPoints, true);
  }, [detectedContours, selectedContourId, selectedPlan, showBorderOverlay, showContours, simplifyTolerance, uploadedBorderPoints]);

  const runContourDetection = useCallback(async () => {
    if (!selectedPlan || !selectedPlanBackgroundImageUrl || !borderOverlayRef.current) {
      setError(t('roomPlansPage.uploadBackgroundBeforeDetection'));
      return;
    }

    try {
      const image = new Image();
      image.crossOrigin = 'anonymous';
      image.src = selectedPlanBackgroundImageUrl;
      await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(t('roomPlansPage.failedLoadImage')));
      });

      const width = Math.max(1, selectedPlan.width);
      const height = Math.max(1, selectedPlan.height);
      const offscreen = document.createElement('canvas');
      offscreen.width = width;
      offscreen.height = height;
      const context = offscreen.getContext('2d', { willReadFrequently: true });
      if (!context) {
        setError(t('roomPlansPage.detectionUnavailable'));
        return;
      }

      context.clearRect(0, 0, width, height);
      context.drawImage(image, 0, 0, width, height);
      const imageData = context.getImageData(0, 0, width, height);
      const edgeMask = detectEdges(imageData, edgeThreshold);
      const contours = findContours(edgeMask, Math.max(80, Math.round((width * height) * 0.0003)));
      if (!contours.length) {
        setDetectedContours([]);
        setSelectedContourId(null);
        clearBorderOverlay(borderOverlayRef.current);
        setError(t('roomPlansPage.noValidContours'));
        return;
      }

      const selected = contours[0];
      setDetectedContours(contours);
      setSelectedContourId(selected.id);
      setSuccess(t('roomPlansPage.detectedContours', { count: contours.length }));
    } catch {
      setError(t('roomPlansPage.failedDetectContours'));
    }
  }, [edgeThreshold, selectedPlan, selectedPlanBackgroundImageUrl, t]);

  const exportSelectedContour = useCallback(() => {
    const selectedRaw = detectedContours.find((contour) => contour.id === selectedContourId)?.points;
    if (!selectedRaw || selectedRaw.length < 3) {
      setError(t('roomPlansPage.noSelectedContour'));
      return;
    }

    const simplified = simplifyPath(selectedRaw, simplifyTolerance);
    if (simplified.length < 3) {
      setError(t('roomPlansPage.selectedContourTooSmall'));
      return;
    }

    const payload = JSON.stringify(simplified.map((point) => ({ x: point.x, y: point.y })), null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'points.json';
    anchor.click();
    URL.revokeObjectURL(url);

    setUploadedBorderPoints(simplified);
    setBorderPoints(buildSnapPoints(simplified, 8));
    setSnapWarning(null);
    setSuccess(t('roomPlansPage.exportedSelectedContour', { count: simplified.length }));
  }, [detectedContours, selectedContourId, simplifyTolerance, t]);

  const handleClearDetection = useCallback(() => {
    setDetectedContours([]);
    setSelectedContourId(null);
    if (borderOverlayRef.current) clearBorderOverlay(borderOverlayRef.current);
  }, []);

  const handleSelectContourAtClick = useCallback((event: React.MouseEvent<HTMLCanvasElement>) => {
    if (!detectedContours.length || !showContours) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const point = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const nextContourId = pickContourByPoint(detectedContours, point, 18);
    if (nextContourId) {
      setSelectedContourId(nextContourId);
      setSuccess(t('roomPlansPage.contourSelected'));
    }
  }, [detectedContours, showContours, t]);

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
      setSuccess(t('roomPlansPage.updatedDetails'));
      await loadRoomPlans();
    } catch (updateError: unknown) {
      setError(getApiErrorMessage(updateError, t('roomPlansPage.failedUpdateDetails')));
    }
  };

  const handleDeletePlan = async () => {
    if (!selectedPlan) return;
    const confirmed = window.confirm(t('roomPlansPage.confirmDelete', { name: selectedPlan.name }));
    if (!confirmed) return;

    try {
      await deleteRoomPlan(selectedPlan.id);
      setSuccess(t('roomPlansPage.deleted'));
      await loadRoomPlans();
    } catch (deleteError: unknown) {
      setError(getApiErrorMessage(deleteError, t('roomPlansPage.failedDelete')));
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
      setSuccess(t('roomPlansPage.backgroundUploaded'));
    } catch (uploadError: unknown) {
      setError(getApiErrorMessage(uploadError, t('roomPlansPage.failedUploadBackground')));
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
      seats: selectedType === 'table' || selectedType === 'table_circle' ? size.seats ?? 2 : null,
      z_index: nextZIndex(items),
      container: selectedType === 'window' ? 'wrapper' : 'room',
      is_active: true,
    };

    const constrainedItem = constrainItemToPlan(nextItem);

    setItems((current) => [...current, constrainedItem]);
    setSelectedItemId(constrainedItem.id);
  };

  const handleSelectItemType = (nextType: RoomPlanItemType) => {
    setPendingType(nextType);
  };

  const patchSelectedItem = (patch: Partial<RoomPlanItem>) => {
    if (!selectedPlan || !selectedItem) return;

    const isWindow = selectedItem.type === 'window';
    const safePatch: Partial<RoomPlanItem> = isWindow
      ? {
          ...patch,
          rotation: selectedItem.rotation,
          container: 'wrapper',
        }
      : patch;

    setItems((current) => current.map((item) => {
      if (item.id !== selectedItem.id) return item;
      return constrainItemToPlan({ ...item, ...safePatch });
    }));
  };

  const handleDuplicateSelected = () => {
    if (!selectedPlan || !selectedItem) return;

    const duplicate: RoomPlanItem = constrainItemToPlan(
      {
        ...selectedItem,
        id: -Math.floor(Math.random() * 1_000_000_000),
        label: `${selectedItem.label} ${t('roomPlansPage.copySuffix')}`,
        x: selectedItem.x + 24,
        y: selectedItem.y + 24,
        z_index: nextZIndex(items),
        container: selectedItem.type === 'window' ? 'wrapper' : selectedItem.container,
      }
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
      const normalizedItems = items.map((item) => constrainItemToPlan(item));
      const savedItems = await saveRoomPlanItemsBulk(selectedPlan.id, normalizedItems);
      setItems(savedItems.sort((left, right) => left.z_index - right.z_index));
      setSuccess(t('roomPlansPage.savedLayout'));
      await loadRoomPlans();
    } catch (saveError: unknown) {
      setError(getApiErrorMessage(saveError, t('roomPlansPage.failedSaveLayout')));
    } finally {
      setSaving(false);
    }
  };

  const sortedItems = useMemo(
    () => [...items].sort((left, right) => left.z_index - right.z_index),
    [items]
  );

  return (
    <DashboardLayout title={t('roomPlansPage.pageTitle')}>
      <div className="space-y-5">
        <div className="grid gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted2">{t('roomPlansPage.createRoomPlan')}</h2>
            <div className="mt-3 space-y-2">
              <input
                value={newPlanName}
                onChange={(event) => setNewPlanName(event.target.value)}
                placeholder={t('roomPlansPage.planNamePlaceholder')}
                className="w-full rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
              />
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={newPlanWidth}
                  onChange={(event) => setNewPlanWidth(Number(event.target.value))}
                  placeholder={t('roomPlansPage.width')}
                  className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                />
                <input
                  type="number"
                  value={newPlanHeight}
                  onChange={(event) => setNewPlanHeight(Number(event.target.value))}
                  placeholder={t('roomPlansPage.height')}
                  className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                />
              </div>
              <button
                type="button"
                onClick={handleCreatePlan}
                className={`w-full ${primaryButtonClass}`}
              >
                {t('roomPlansPage.createPlan')}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
            <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted2">{t('roomPlansPage.savedPlans')}</h2>
            {loading ? (
              <p className="mt-3 text-sm text-muted">{t('roomPlansPage.loadingPlans')}</p>
            ) : roomPlans.length === 0 ? (
              <p className="mt-3 text-sm text-muted">{t('roomPlansPage.noPlans')}</p>
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
                    <div className="text-xs text-muted">{t('roomPlansPage.planSummary', { width: plan.width, height: plan.height, count: plan.items_count ?? 0 })}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedPlan ? (
            <div className="rounded-2xl border border-stroke bg-bg1/60 p-4">
              <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted2">{t('roomPlansPage.selectedPlan')}</h2>
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
                  className={`w-full ${neutralButtonClass}`}
                >
                  {t('roomPlansPage.updatePlanDetails')}
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className={`w-full ${neutralButtonClass}`}
                >
                  {uploading ? t('roomPlansPage.uploadingImage') : t('roomPlansPage.uploadBackgroundImage')}
                </button>
                <button
                  type="button"
                  onClick={handleDeletePlan}
                  className={`w-full ${dangerButtonClass}`}
                >
                  {t('roomPlansPage.deletePlan')}
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
                      <optgroup key={group.label} label={itemGroupLabels[group.label as keyof typeof itemGroupLabels] ?? group.label}>
                        {group.options.map((option) => (
                          <option key={option.value} value={option.value}>{itemTypeLabels[option.value] ?? option.label}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>

                  <button
                    type="button"
                    onClick={handleAddItem}
                    className={primaryButtonClass}
                  >
                    {t('roomPlansPage.addItem')}
                  </button>

                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    disabled={!selectedItem}
                    className={neutralButtonClass}
                  >
                    {t('roomPlansPage.duplicate')}
                  </button>

                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    disabled={!selectedItem}
                    className={dangerButtonClass}
                  >
                    {t('roomPlansPage.delete')}
                  </button>
                </div>

                {selectedItem ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                    <input
                      value={selectedItem.label}
                      onChange={(event) => patchSelectedItem({ label: event.target.value })}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                      placeholder={t('roomPlansPage.label')}
                    />
                    <input
                      type="number"
                      value={selectedItem.width}
                      onChange={(event) => patchSelectedItem({ width: Number(event.target.value) })}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                      placeholder={t('roomPlansPage.width')}
                    />
                    <input
                      type="number"
                      value={selectedItem.height}
                      onChange={(event) => patchSelectedItem({ height: Number(event.target.value) })}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                      placeholder={t('roomPlansPage.height')}
                    />
                    <input
                      type="number"
                      value={selectedItem.rotation}
                      onChange={(event) => {
                        if (selectedItem.type === 'window') {
                          patchSelectedItem({});
                          return;
                        }
                        patchSelectedItem({ rotation: Number(event.target.value) });
                      }}
                      disabled={selectedItem.type === 'window'}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                      placeholder={t('roomPlansPage.rotation')}
                    />
                    <input
                      type="number"
                      value={selectedItem.z_index}
                      onChange={(event) => patchSelectedItem({ z_index: Number(event.target.value) })}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                      placeholder={t('roomPlansPage.zIndex')}
                    />
                    <select
                      value={selectedItem.container}
                      onChange={(event) => patchSelectedItem({ container: event.target.value as RoomPlanItem['container'] })}
                      disabled={selectedItem.type === 'window'}
                      className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                    >
                      <option value="room">{t('roomPlansPage.containerOptions.room')}</option>
                      <option value="wrapper">{t('roomPlansPage.containerOptions.wrapper')}</option>
                    </select>
                    {selectedItem.type === 'table' || selectedItem.type === 'table_circle' ? (
                      <input
                        type="number"
                        value={selectedItem.seats ?? 2}
                        onChange={(event) => patchSelectedItem({ seats: Number(event.target.value) })}
                        className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-sm text-text"
                        placeholder={t('roomPlansPage.seats')}
                      />
                    ) : null}
                    <div className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-xs text-muted">
                      {selectedItem.type === 'window'
                        ? t('roomPlansPage.windowHint')
                        : t('roomPlansPage.dragHint')}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-muted">{t('roomPlansPage.selectItemHint')}</p>
                )}
              </div>

              <div className="rounded-2xl border border-stroke bg-bg0/50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted2">{t('roomPlansPage.layoutCanvas')}</h3>
                    <p className="text-xs text-muted">
                      {t('roomPlansPage.layoutCanvasHint', { width: selectedPlan.width, height: selectedPlan.height })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSaveLayout}
                    disabled={saving}
                    className={`${primaryButtonClass} px-4`}
                  >
                    {saving ? t('adminDashboard.saving') : t('roomPlansPage.saveLayout')}
                  </button>
                </div>
                <div className="mb-3 space-y-2">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void runContourDetection()}
                      className={primaryButtonClass}
                    >
                      {t('roomPlansPage.detectEdges')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowContours((current) => !current)}
                      className={neutralButtonClass}
                    >
                      {showContours ? t('roomPlansPage.hideContours') : t('roomPlansPage.showContours')}
                    </button>
                    <button
                      type="button"
                      onClick={() => borderInputRef.current?.click()}
                      className={neutralButtonClass}
                    >
                      {t('roomPlansPage.uploadBorder')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowBorderOverlay((current) => !current)}
                      className={neutralButtonClass}
                    >
                      {showBorderOverlay ? t('roomPlansPage.hideBorder') : t('roomPlansPage.showBorder')}
                    </button>
                    <button
                      type="button"
                      onClick={exportSelectedContour}
                      disabled={!selectedContourId}
                      className={primaryButtonClass}
                    >
                      {t('roomPlansPage.exportSelectedContour')}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearBorder}
                      disabled={uploadedBorderPoints.length === 0}
                      className={dangerButtonClass}
                    >
                      {t('roomPlansPage.clearBorder')}
                    </button>
                    <button
                      type="button"
                      onClick={handleClearDetection}
                      disabled={detectedContours.length === 0}
                      className={dangerButtonClass}
                    >
                      {t('roomPlansPage.clearDetection')}
                    </button>
                  </div>
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-xs text-muted">
                      {t('roomPlansPage.simplify', { value: simplifyTolerance })}
                      <input
                        type="range"
                        min={1}
                        max={14}
                        value={simplifyTolerance}
                        onChange={(event) => setSimplifyTolerance(Number(event.target.value))}
                        className="mt-1 w-full"
                      />
                    </label>
                    <label className="rounded-xl border border-stroke bg-bg1 px-3 py-2 text-xs text-muted">
                      {t('roomPlansPage.edgeThreshold', { value: edgeThreshold })}
                      <input
                        type="range"
                        min={8}
                        max={96}
                        value={edgeThreshold}
                        onChange={(event) => setEdgeThreshold(Number(event.target.value))}
                        className="mt-1 w-full"
                      />
                    </label>
                  </div>
                  <input
                    ref={borderInputRef}
                    id="borderInput"
                    type="file"
                    accept="application/json"
                    onChange={(event) => void handleUploadBorderFile(event)}
                    className="hidden"
                  />
                </div>
                {uploadedBorderPoints.length > 0 ? (
                  <div className="mb-3 rounded-xl border border-gold/35 bg-gold/10 px-3 py-2 text-xs text-gold2">
                    {t('roomPlansPage.borderLoadedInline', { count: uploadedBorderPoints.length })}
                  </div>
                ) : null}
                {detectedContours.length > 0 ? (
                  <div className="mb-3 rounded-xl border border-stroke bg-bg1 px-3 py-2 text-xs text-muted">
                    {t('roomPlansPage.contoursInline', { count: detectedContours.length })}
                  </div>
                ) : null}
                {snapWarning ? (
                  <div className="mb-3 rounded-xl border border-amber-500/45 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
                    {snapWarning}
                  </div>
                ) : null}

                <div className="overflow-auto rounded-xl border border-stroke bg-bg1/30 p-3">
                  <div
                    ref={roomRef}
                    className="relative overflow-hidden rounded-lg border border-stroke"
                    style={{
                      width: selectedPlan.width,
                      height: selectedPlan.height,
                      backgroundColor: 'rgba(8, 10, 20, 0.35)',
                    }}
                  >
                    {selectedPlanBackgroundImageUrl ? (
                      <img
                        src={selectedPlanBackgroundImageUrl}
                        alt=""
                        onLoad={(event) => {
                          const image = event.currentTarget;
                          setImageNaturalSize({
                            width: image.naturalWidth,
                            height: image.naturalHeight,
                          });
                        }}
                        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
                        style={{ objectFit: 'fill' }}
                        draggable={false}
                      />
                    ) : null}
                    <canvas
                      ref={borderOverlayRef}
                      onMouseDown={handleSelectContourAtClick}
                      className={`absolute inset-0 h-full w-full ${showBorderOverlay ? 'opacity-100' : 'opacity-0'} ${detectedContours.length > 0 ? 'pointer-events-auto' : 'pointer-events-none'}`}
                      style={{ zIndex: 5 }}
                    />
                    {sortedItems.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        data-room-item="1"
                        onMouseDown={(event) => {
                          const rect = roomRef.current?.getBoundingClientRect();
                          if (!rect) return;

                          event.preventDefault();
                          setSelectedItemId(item.id);
                          const mode: DragMode = item.type === 'window' && borderPoints.length > 0 ? 'window' : 'free';

                          if (mode === 'window') {
                            const currentCenter = {
                              x: item.x + item.width / 2,
                              y: item.y + item.height / 2,
                            };
                            windowDragSnapIndexRef.current = findNearestBorderPoint(currentCenter, borderPoints)?.index ?? null;
                          } else {
                            windowDragSnapIndexRef.current = null;
                          }

                          setDragState({
                            itemId: item.id,
                            offsetX: event.clientX - rect.left - item.x,
                            offsetY: event.clientY - rect.top - item.y,
                            mode,
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
                          zIndex: item.z_index + 10,
                          padding: 6,
                          borderRadius: item.type === 'table_circle' ? '999px' : '10px',
                        }}
                      >
                        <div className="pointer-events-none text-[11px] font-semibold uppercase tracking-[0.08em]">{item.label}</div>
                        <div className="pointer-events-none text-[10px] text-muted">
                          {typeLabel(item.type)}{item.type === 'table' || item.type === 'table_circle' ? ` • ${t('roomPlansPage.seatsCount', { count: item.seats ?? 0 })}` : ''}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-stroke bg-bg1/60 p-6 text-center text-muted">
              {t('roomPlansPage.selectOrCreateHint')}
            </div>
          )}

          {error ? <div className="rounded-xl border border-spicy/45 bg-spicy/10 px-3 py-2 text-sm text-spicy">{error}</div> : null}
          {success ? <div className="rounded-xl border border-sage/45 bg-sage/10 px-3 py-2 text-sm text-sage">{success}</div> : null}
        </div>
      </div>
      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default AdminRoomPlansPage;
