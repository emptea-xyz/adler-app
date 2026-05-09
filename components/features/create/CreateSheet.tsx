import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard } from 'react-native';
import { ChevronLeft } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import Animated, { FadeIn } from 'react-native-reanimated';
import { BottomSheet } from '@/components/ui/BottomSheet';
import { useUser } from '@/contexts/UserContext';
import { createService, createGig } from '@/lib/services/listingsService';
import {
  deleteListingMedia,
  uploadListingMedia,
} from '@/lib/services/listingMediaUploadService';
import { compressImageForUpload } from '@/lib/services/imageUploadService';
import { qk, FEED_KEYS } from '@/lib/constants/queryKeys';
import { haptic } from '@/lib/utils/haptic';
import { parseSolAmount } from '@/lib/utils/formatNumber';
import { viewModeFor } from '@/lib/utils/role';
import type { ListingCategory } from '@/types/marketplace';
import {
  CreateFormStep,
  validatePackageForm,
  type FormState,
  type FormSetters,
} from './CreateFormStep';
import { CreateCategoryStep } from './CreateCategoryStep';
import { CreateConfirmStep } from './CreateConfirmStep';
import {
  CreateProgressStep,
  type PublishTask,
  type PublishTaskStatus,
} from './CreateProgressStep';
import { CreateResultStep } from './CreateResultStep';

type Step = 'form' | 'category' | 'confirm' | 'progress' | 'success' | 'error';

const STEP_HEIGHT: Record<Step, number> = {
  form: 720,
  category: 520,
  confirm: 460,
  progress: 380,
  success: 320,
  error: 360,
};

interface Props {
  visible: boolean;
  onClose: () => void;
}

export function CreateSheet({ visible, onClose }: Props) {
  const { profile } = useUser();
  const router = useRouter();
  const queryClient = useQueryClient();

  const isCreator = viewModeFor(profile) === 'creator';
  const listingKind = isCreator ? 'service' : 'gig';

  const [step, setStep] = useState<Step>('form');

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('general');
  const [requirements, setRequirements] = useState('');
  const [coverUri, setCoverUri] = useState<string | null>(null);
  const [mediaUris, setMediaUris] = useState<string[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  // Publish-flow state
  const [tasks, setTasks] = useState<PublishTask[]>([]);
  const [resultId, setResultId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Track storage paths we've uploaded so we can delete orphans on failure.
  const uploadedPathsRef = useRef<string[]>([]);

  // Reset everything when the sheet is dismissed.
  useEffect(() => {
    if (!visible) {
      setStep('form');
      setTitle('');
      setDescription('');
      setAmount('');
      setRequirements('');
      setCategory('general');
      setCoverUri(null);
      setMediaUris([]);
      setSubmitAttempted(false);
      setTasks([]);
      setResultId(null);
      setErrorMsg(null);
      uploadedPathsRef.current = [];
    }
  }, [visible]);

  const formState = useMemo<FormState>(
    () => ({ title, description, amount, category, requirements, coverUri, mediaUris }),
    [title, description, amount, category, requirements, coverUri, mediaUris],
  );
  const formSetters = useMemo<FormSetters>(
    () => ({
      setTitle,
      setDescription,
      setAmount,
      setRequirements,
      setCoverUri,
      setMediaUris,
    }),
    [],
  );

  const walletReady = !!profile?.walletAddress;

  const handleSubmitTap = useCallback(() => {
    setSubmitAttempted(true);
    const { valid } = validatePackageForm(formState, { isCreator, walletReady });
    if (!valid) return;
    Keyboard.dismiss();
    haptic('light');
    setStep('confirm');
  }, [formState, isCreator, walletReady]);

  const handleConfirm = useCallback(async () => {
    haptic('medium');
    Keyboard.dismiss();

    const parsedAmount = parseSolAmount(amount);
    if (parsedAmount === null) {
      setErrorMsg('Invalid amount');
      setStep('error');
      return;
    }

    if (!profile) {
      setErrorMsg('Profile is not loaded');
      setStep('error');
      return;
    }

    const totalUploads = isCreator ? (coverUri ? 1 : 0) + mediaUris.length : 0;
    const initial: PublishTask[] = [
      { id: 'validate', label: 'Validating', status: 'running' },
      ...(totalUploads > 0
        ? [{ id: 'upload', label: `Uploading media (0/${totalUploads})`, status: 'pending' as PublishTaskStatus }]
        : []),
      { id: 'create', label: isCreator ? 'Saving service' : 'Saving gig', status: 'pending' },
      { id: 'publish', label: 'Publishing', status: 'pending' },
    ];
    setTasks(initial);
    setStep('progress');

    const updateTask = (id: string, patch: Partial<PublishTask>) => {
      setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    };
    const failTask = (id: string, message: string) => {
      setTasks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, status: 'failed' } : t)),
      );
      setErrorMsg(message);
      setStep('error');
    };

    try {
      // 1. Validate
      updateTask('validate', { status: 'done' });

      const collectedMediaUrls: string[] = [];

      // 2. Uploads (services only — gigs don't carry listing media in v1)
      if (totalUploads > 0) {
        updateTask('upload', { status: 'running', label: `Uploading media (0/${totalUploads})` });
        let done = 0;
        const tick = () => {
          done += 1;
          updateTask('upload', { label: `Uploading media (${done}/${totalUploads})` });
        };

        try {
          const allUris = [...(coverUri ? [coverUri] : []), ...mediaUris];
          for (const uri of allUris) {
            const compressedUri = await compressImageForUpload(uri, 1600);
            const result = await uploadListingMedia({
              kind: listingKind,
              uid: profile.id,
              uri: compressedUri,
              contentType: 'image/jpeg',
            });
            uploadedPathsRef.current.push(result.path);
            collectedMediaUrls.push(result.url);
            tick();
          }
          updateTask('upload', { status: 'done' });
        } catch (err: any) {
          failTask('upload', err?.message ?? 'Upload failed');
          return;
        }
      }

      // 3. Save listing
      updateTask('create', { status: 'running' });
      let id: string;
      try {
        if (isCreator) {
          id = await createService({
            title: title.trim(),
            description: description.trim(),
            category: category as ListingCategory,
            priceSol: parsedAmount,
            ownerHandle: profile.username,
            ownerDisplayName: profile.displayName,
            ownerAvatarUrl: profile.avatarUrl,
            mediaUrls: collectedMediaUrls,
          });
        } else {
          id = await createGig({
            title: title.trim(),
            description: description.trim(),
            category: category as ListingCategory,
            budgetSol: parsedAmount,
            requirements: requirements.trim(),
            ownerHandle: profile.username,
            ownerDisplayName: profile.displayName,
            ownerAvatarUrl: profile.avatarUrl,
            mediaUrls: [],
          });
        }
        updateTask('create', { status: 'done' });
      } catch (err: any) {
        failTask('create', err?.message ?? 'Could not save listing');
        return;
      }

      // 4. Publish (cache invalidation)
      updateTask('publish', { status: 'running' });
      try {
        queryClient.invalidateQueries({ queryKey: FEED_KEYS.browse() });
        if (profile?.id) {
          queryClient.invalidateQueries({
            queryKey: qk.listings.byOwner(listingKind, profile.id),
          });
        }
        updateTask('publish', { status: 'done' });
      } catch (err: any) {
        failTask('publish', err?.message ?? 'Failed to publish');
        return;
      }

      setResultId(id);
      haptic('heavy');
      setStep('success');
    } catch (err: any) {
      setErrorMsg(err?.message ?? 'Something went wrong');
      setStep('error');
    }
  }, [
    amount,
    category,
    coverUri,
    description,
    isCreator,
    listingKind,
    mediaUris,
    profile,
    queryClient,
    requirements,
    title,
  ]);

  const handleRetry = useCallback(() => {
    // Clean up orphaned uploads from the failed attempt before re-trying.
    const orphans = uploadedPathsRef.current;
    uploadedPathsRef.current = [];
    if (orphans.length > 0) {
      void Promise.all(orphans.map((path) => deleteListingMedia(path)));
    }
    setErrorMsg(null);
    setTasks([]);
    setStep('form');
  }, []);

  const handleViewResult = useCallback(
    (close: () => void) => {
      if (!resultId) return;
      const path = isCreator ? `/service/${resultId}` : `/gig/${resultId}`;
      close();
      router.push(path as any);
    },
    [resultId, isCreator, router],
  );

  const sheetTitle: Record<Step, string> = {
    form: isCreator ? 'List a service' : 'Post a gig',
    category: 'Category',
    confirm: 'Review',
    progress: 'Publishing…',
    success: 'Done',
    error: 'Couldn’t publish',
  };

  const dismissible = step !== 'progress';
  const leftAction =
    step === 'category' || step === 'confirm'
      ? {
          icon: ChevronLeft,
          onPress: () => setStep('form'),
          accessibilityLabel: 'Back to form',
        }
      : undefined;

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={sheetTitle[step]}
      height={STEP_HEIGHT[step]}
      keyboardAware
      dismissible={dismissible}
      leftAction={leftAction}
    >
      {({ close }) => (
        <Animated.View key={step} entering={FadeIn.duration(140)} style={{ flex: 1 }}>
          {step === 'form' ? (
            <CreateFormStep
              isCreator={isCreator}
              state={formState}
              setters={formSetters}
              walletReady={walletReady}
              submitAttempted={submitAttempted}
              onPickCategory={() => setStep('category')}
              onSubmit={handleSubmitTap}
            />
          ) : step === 'category' ? (
            <CreateCategoryStep
              value={category}
              onSelect={(id) => {
                setCategory(id);
                setStep('form');
              }}
            />
          ) : step === 'confirm' ? (
            <CreateConfirmStep
              kind={isCreator ? 'package' : 'gig'}
              title={title.trim()}
              amountSol={parseSolAmount(amount) ?? 0}
              category={category}
              coverUri={isCreator ? coverUri : null}
              galleryCount={isCreator ? mediaUris.length : 0}
              onConfirm={handleConfirm}
              onCancel={() => setStep('form')}
            />
          ) : step === 'progress' ? (
            <CreateProgressStep tasks={tasks} />
          ) : step === 'success' ? (
            <CreateResultStep
              variant="success"
              kind={isCreator ? 'package' : 'gig'}
              onView={() => handleViewResult(close)}
              onDone={() => close()}
            />
          ) : (
            <CreateResultStep
              variant="error"
              message={errorMsg ?? 'Please try again.'}
              onRetry={handleRetry}
              onCancel={() => close()}
            />
          )}
        </Animated.View>
      )}
    </BottomSheet>
  );
}
