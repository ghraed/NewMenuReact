import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DashboardLayout from '../components/Admin/DashboardLayout';
import {
  GlassCard,
  GlassToast,
  LiquidButton,
  useGlassToast,
} from '../components/ui/liquid-glass';
import api, { resolveAssetUrl } from '../services/api';
import type { IngredientLibraryItem } from '../types';

type DirectoryFile = File & {
  webkitRelativePath?: string;
};

const IMAGE_EXTENSION_PATTERN = /\.(jpe?g|png|webp|heic|heif)$/i;

const getErrorMessage = (error: unknown, fallback: string): string => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const response = (error as { response?: { data?: { message?: string } } }).response;
    if (response?.data?.message) return response.data.message;
  }

  return fallback;
};

const deriveIngredientName = (fileName: string, fallbackLabel: string): string => {
  const baseName = fileName.replace(/\.[^.]+$/, '');
  const withSpaces = baseName.replace(/-/g, ' ');

  return withSpaces.replace(/\s+/g, ' ').trim() || fallbackLabel;
};

const isSupportedImage = (file: File): boolean => (
  file.type.startsWith('image/') || IMAGE_EXTENSION_PATTERN.test(file.name)
);

const formatBytes = (bytes?: number | null, unknownLabel = 'Unknown size'): string => {
  if (!bytes || bytes <= 0) return unknownLabel;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const IngredientLibraryPage: React.FC = () => {
  const { t } = useTranslation();
  const folderInputRef = useRef<HTMLInputElement | null>(null);
  const [ingredients, setIngredients] = useState<IngredientLibraryItem[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<DirectoryFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast, showToast, dismiss } = useGlassToast();

  const fetchIngredients = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await api.get('/ingredients');
      setIngredients(Array.isArray(response.data) ? response.data : []);
    } catch (err: unknown) {
      setError(getErrorMessage(err, t('ingredientLibrary.failedLoad')));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIngredients();
  }, [fetchIngredients]);

  useEffect(() => {
    if (!folderInputRef.current) return;

    folderInputRef.current.setAttribute('webkitdirectory', '');
    folderInputRef.current.setAttribute('directory', '');
  }, []);

  const clearSelectedFiles = useCallback(() => {
    setSelectedFiles([]);

    if (folderInputRef.current) {
      folderInputRef.current.value = '';
    }
  }, []);

  const pendingIngredients = useMemo(
    () => selectedFiles.map((file) => ({
      file,
      derivedName: deriveIngredientName(file.name, t('ingredientLibrary.unnamedIngredient')),
      relativePath: file.webkitRelativePath || file.name,
    })),
    [selectedFiles, t]
  );

  const handleChooseFolder = () => {
    folderInputRef.current?.click();
  };

  const handleFileSelection = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []) as DirectoryFile[];
    const imageFiles = files.filter(isSupportedImage);
    const skippedCount = files.length - imageFiles.length;

    setSelectedFiles(imageFiles);

    if (imageFiles.length === 0) {
      showToast(
        skippedCount > 0 ? t('ingredientLibrary.noSupportedImages') : t('ingredientLibrary.noFolderSelected'),
        'tertiary',
        3200
      );
      return;
    }

    if (skippedCount > 0) {
      showToast(t('ingredientLibrary.loadedAndSkipped', { loaded: imageFiles.length, skipped: skippedCount }), 'secondary', 3200);
      return;
    }

    showToast(t('ingredientLibrary.loadedOnly', { count: imageFiles.length }), 'secondary');
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      showToast(t('ingredientLibrary.chooseFolderFirst'), 'tertiary');
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      selectedFiles.forEach((file) => {
        formData.append('images[]', file);
      });

      const response = await api.post('/ingredients/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setIngredients(Array.isArray(response.data?.ingredients) ? response.data.ingredients : []);
      clearSelectedFiles();
      showToast(t('ingredientLibrary.uploaded', { count: response.data?.uploaded_count ?? selectedFiles.length }), 'secondary');
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('ingredientLibrary.failedUpload'));
      setError(message);
      showToast(message, 'tertiary', 3200);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAll = async () => {
    if (ingredients.length === 0) {
      showToast(t('ingredientLibrary.alreadyEmpty'), 'tertiary');
      return;
    }

    const confirmed = window.confirm(
      `Delete all ${ingredients.length} ingredient images and their database records?`
    );

    if (!confirmed) return;

    setDeleting(true);
    setError(null);

    try {
      const response = await api.delete('/ingredients');
      setIngredients([]);
      clearSelectedFiles();
      showToast(t('ingredientLibrary.deleted', { count: response.data?.deleted_count ?? 0 }), 'secondary');
    } catch (err: unknown) {
      const message = getErrorMessage(err, t('ingredientLibrary.failedClear'));
      setError(message);
      showToast(message, 'tertiary', 3200);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <DashboardLayout title={t('ingredientLibrary.pageTitle')}>
      <input
        ref={folderInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleFileSelection}
        className="hidden"
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="text-xl font-semibold text-text">{t('ingredientLibrary.heading')}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Pick a folder of ingredient images and we will upload every supported image inside it. Each ingredient
            label is generated from the filename, so <span className="font-medium text-text">fresh-mint-leaves.png</span>{' '}
            becomes <span className="font-medium text-text">fresh mint leaves</span>.
          </p>
        </div>

        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <LiquidButton tone="tertiary" onClick={fetchIngredients} disabled={loading}>
            {loading ? t('common.loading') : t('ingredientLibrary.refresh')}
          </LiquidButton>
          <LiquidButton tone="secondary" onClick={handleDeleteAll} disabled={deleting || uploading}>
            {deleting ? t('ingredientLibrary.deleting') : t('ingredientLibrary.deleteAll')}
          </LiquidButton>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl2 border border-spicy/40 bg-spicy/12 p-4 text-sm text-spicy">
          {error}
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <GlassCard className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold2/85">{t('ingredientLibrary.folderImport')}</p>
              <h3 className="mt-2 text-lg font-semibold text-text">{t('ingredientLibrary.chooseLocalFolder')}</h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-muted">
                {t('ingredientLibrary.folderHelp')}
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <LiquidButton tone="tertiary" onClick={handleChooseFolder} disabled={uploading || deleting}>
                {t('ingredientLibrary.chooseFolder')}
              </LiquidButton>
              <LiquidButton tone="primary" onClick={handleUpload} disabled={uploading || deleting || selectedFiles.length === 0}>
                {uploading ? t('ingredientLibrary.uploading') : t('ingredientLibrary.uploadFolderImages')}
              </LiquidButton>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-white/12 bg-black/10 p-4 text-sm text-muted">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-text">{t('ingredientLibrary.filesReady', { count: selectedFiles.length })}</p>
              {selectedFiles.length > 0 && (
                <button
                  type="button"
                  onClick={clearSelectedFiles}
                  className="text-sm font-medium text-gold2 transition hover:text-gold"
                >
                  {t('ingredientLibrary.clearSelection')}
                </button>
              )}
            </div>
            <p className="mt-1 leading-6 text-muted">
              {t('ingredientLibrary.supportedTypes')}
            </p>
          </div>

          <div className="mt-5 max-h-[460px] space-y-3 overflow-y-auto pr-1">
            {pendingIngredients.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-white/15 bg-white/5 px-4 py-10 text-center">
                <p className="text-base font-medium text-text">{t('ingredientLibrary.noFolderSelectedYet')}</p>
                <p className="mt-2 text-sm leading-6 text-muted">
                  {t('ingredientLibrary.noFolderSelectedDescription')}
                </p>
              </div>
            ) : (
              pendingIngredients.map((item) => (
                <div
                  key={`${item.relativePath}-${item.file.lastModified}`}
                  className="rounded-[28px] border border-white/12 bg-white/6 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-text">{item.derivedName}</p>
                      <p className="mt-1 break-all text-xs leading-5 text-muted">{item.relativePath}</p>
                    </div>
                    <span className="shrink-0 rounded-full border border-white/12 bg-white/10 px-3 py-1 text-xs font-medium text-muted2">
                      {formatBytes(item.file.size, t('ingredientLibrary.unknownSize'))}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </GlassCard>

        <GlassCard className="p-5 sm:p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold2/85">{t('ingredientLibrary.summaryEyebrow')}</p>
          <h3 className="mt-2 text-lg font-semibold text-text">{t('ingredientLibrary.summaryTitle')}</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Ingredients are stored once per restaurant. Uploading a file with the same generated name replaces the old
            image, so the library stays clean while you iterate.
          </p>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[28px] border border-white/12 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted2">{t('ingredientLibrary.savedIngredients')}</p>
              <p className="mt-2 text-3xl font-semibold text-text">{ingredients.length}</p>
            </div>
            <div className="rounded-[28px] border border-white/12 bg-white/6 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-muted2">{t('ingredientLibrary.importRule')}</p>
              <p className="mt-2 text-sm leading-6 text-text">{t('ingredientLibrary.importRuleDescription')}</p>
            </div>
          </div>

          <div className="mt-5 rounded-[28px] border border-gold/18 bg-gold/8 p-4">
            <p className="text-sm font-medium text-text">{t('ingredientLibrary.nextStepTitle')}</p>
            <p className="mt-2 text-sm leading-6 text-muted">
              Once you are happy with this library, we can connect dish records to selected ingredients and reuse the
              same images in the dish detail page and animated ingredient story.
            </p>
          </div>
        </GlassCard>
      </div>

      <GlassCard className="mt-6 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gold2/85">{t('ingredientLibrary.galleryEyebrow')}</p>
            <h3 className="mt-2 text-lg font-semibold text-text">{t('ingredientLibrary.galleryTitle')}</h3>
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-muted">{t('ingredientLibrary.loading')}</div>
        ) : ingredients.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto max-w-md rounded-[28px] border border-dashed border-white/15 bg-white/5 px-6 py-10">
              <p className="text-lg font-semibold text-text">{t('ingredientLibrary.emptyTitle')}</p>
              <p className="mt-2 text-sm leading-6 text-muted">
                {t('ingredientLibrary.emptyDescription')}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {ingredients.map((ingredient) => (
              <div
                key={ingredient.id}
                className="overflow-hidden rounded-[30px] border border-white/12 bg-white/6"
              >
                <div className="aspect-[4/3] bg-black/15">
                  {resolveAssetUrl(ingredient.file_url) ? (
                    <img
                      src={resolveAssetUrl(ingredient.file_url)}
                      alt={ingredient.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-sm text-muted">{t('ingredientLibrary.imageUnavailable')}</div>
                  )}
                </div>

                <div className="space-y-2 p-4">
                  <p className="text-base font-semibold text-text">{ingredient.name}</p>
                  <p className="break-all text-xs leading-5 text-muted">
                    {ingredient.source_file_name || t('ingredientLibrary.originalFilenameUnavailable')}
                  </p>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted2">{formatBytes(ingredient.file_size, t('ingredientLibrary.unknownSize'))}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      <GlassToast toast={toast} onClose={dismiss} />
    </DashboardLayout>
  );
};

export default IngredientLibraryPage;
