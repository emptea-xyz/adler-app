import React, { useEffect, useMemo, useState } from 'react';
import { Dimensions, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useQueries, useQuery } from '@tanstack/react-query';
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    cancelAnimation,
} from 'react-native-reanimated';
import { ThemedText } from '@/components/base/ThemedText';
import { Skeleton } from '@/components/ui/Skeleton';
import { SolanaIcon } from '@/components/ui/SolanaIcon';
import { useTheme } from '@/contexts/ThemeContext';
import {
    listOpenPublicBounties,
    listRecentSettledPublic,
} from '@/lib/services/bountyService';
import { getProfile } from '@/lib/services/profileService';
import { qk } from '@/lib/constants/queryKeys';
import { lamportsToSol } from '@/lib/solana/connection';
import { formatSol } from '@/lib/utils/formatNumber';
import { haptic } from '@/lib/utils/haptic';
import { TailwindColors } from '@/constants/TailwindColors';

const TICKER_HEIGHT = 40;
const PIXELS_PER_SECOND = 36;
const DOT_SIZE = 6;
const POST_LIMIT = 12;
const SETTLE_LIMIT = 12;
const MAX_EVENTS = 20;

type ActivityEvent =
    | {
          kind: 'post';
          bountyId: string;
          actorId: string;
          amountLamports: number;
          timestamp: number;
      }
    | {
          kind: 'settle';
          bountyId: string;
          actorId: string;
          amountLamports: number;
          timestamp: number;
      };

export function LiveActivityTicker() {
    const { theme } = useTheme();

    const postsQuery = useQuery({
        queryKey: qk.bounties.ticker(),
        queryFn: () => listOpenPublicBounties(POST_LIMIT),
        staleTime: 30_000,
    });
    const settledQuery = useQuery({
        queryKey: qk.bounties.recentSettled(),
        queryFn: () => listRecentSettledPublic(SETTLE_LIMIT),
        staleTime: 30_000,
    });

    const events = useMemo<ActivityEvent[]>(() => {
        const out: ActivityEvent[] = [];
        for (const b of postsQuery.data ?? []) {
            out.push({
                kind: 'post',
                bountyId: b.id,
                actorId: b.posterId,
                amountLamports: b.bountyLamports,
                timestamp: b.createdAt,
            });
        }
        for (const b of settledQuery.data ?? []) {
            if (!b.winnerId || !b.settledAt) continue;
            out.push({
                kind: 'settle',
                bountyId: b.id,
                actorId: b.winnerId,
                amountLamports: b.bountyLamports,
                timestamp: b.settledAt,
            });
        }
        return out.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_EVENTS);
    }, [postsQuery.data, settledQuery.data]);

    const actorIds = useMemo(() => {
        const seen = new Set<string>();
        for (const e of events) if (e.actorId) seen.add(e.actorId);
        return Array.from(seen);
    }, [events]);

    const profileQueries = useQueries({
        queries: actorIds.map((uid) => ({
            queryKey: qk.profiles.detail(uid),
            queryFn: () => getProfile(uid),
            staleTime: 5 * 60_000,
        })),
    });
    const profilesByUid = useMemo(() => {
        const map: Record<string, { name: string | null } | undefined> = {};
        for (let i = 0; i < actorIds.length; i++) {
            const data = profileQueries[i]?.data;
            map[actorIds[i]] = {
                name: data?.username || data?.displayName || null,
            };
        }
        return map;
    }, [actorIds, profileQueries]);

    const isLoading = postsQuery.isLoading && settledQuery.isLoading;

    if (isLoading) {
        return (
            <View
                style={{
                    height: TICKER_HEIGHT,
                    paddingHorizontal: 8,
                    justifyContent: 'center',
                }}
            >
                <Skeleton height={20} width="60%" />
            </View>
        );
    }

    // Reserve TICKER_HEIGHT even when empty so the underlying FlatList
    // doesn't jump up when posts/settles arrive after a cold load.
    if (events.length === 0) {
        return <View style={{ height: TICKER_HEIGHT }} />;
    }

    return (
        <View
            style={{
                height: TICKER_HEIGHT,
                borderTopWidth: 1,
                borderBottomWidth: 1,
                borderColor: theme[100],
                backgroundColor: theme[50],
                overflow: 'hidden',
                justifyContent: 'center',
            }}
        >
            <Marquee>
                {events.map((event, i) => (
                    <TickerItem
                        key={`${event.kind}-${event.bountyId}-${i}`}
                        event={event}
                        actorName={profilesByUid[event.actorId]?.name ?? null}
                    />
                ))}
            </Marquee>
        </View>
    );
}

function Marquee({ children }: { children: React.ReactNode }) {
    const screenWidth = Dimensions.get('window').width;
    const [contentWidth, setContentWidth] = useState(0);
    const translateX = useSharedValue(0);

    useEffect(() => {
        if (contentWidth <= 0) return;
        translateX.value = 0;
        translateX.value = withRepeat(
            withTiming(-contentWidth, {
                duration: (contentWidth / PIXELS_PER_SECOND) * 1000,
                easing: Easing.linear,
            }),
            -1,
            false,
        );
        return () => cancelAnimation(translateX);
    }, [contentWidth, translateX]);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
    }));

    const shouldAnimate = contentWidth > screenWidth;

    return (
        <Animated.View
            style={[
                {
                    flexDirection: 'row',
                    alignItems: 'center',
                },
                shouldAnimate ? animatedStyle : null,
            ]}
        >
            <View
                style={{ flexDirection: 'row', alignItems: 'center' }}
                onLayout={(e) => setContentWidth(e.nativeEvent.layout.width)}
            >
                {children}
            </View>
            {shouldAnimate ? (
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {children}
                </View>
            ) : null}
        </Animated.View>
    );
}

function TickerItem({
    event,
    actorName,
}: {
    event: ActivityEvent;
    actorName: string | null;
}) {
    const { theme } = useTheme();
    const isPost = event.kind === 'post';
    const dotColor = isPost ? TailwindColors.lime[500] : TailwindColors.sky[500];
    const verb = isPost ? 'posted' : 'won';
    const displayName = actorName ? `@${actorName}` : 'someone';
    const sol = formatSol(lamportsToSol(event.amountLamports));

    return (
        <Pressable
            onPress={() => {
                haptic('light');
                router.push(`/bounty/${event.bountyId}`);
            }}
            style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: 8,
                gap: 8,
            }}
        >
            <View
                style={{
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    borderRadius: DOT_SIZE / 2,
                    backgroundColor: dotColor,
                }}
            />
            <ThemedText
                type="body-sm-semibold"
                style={{ color: theme[950] }}
                numberOfLines={1}
            >
                {displayName}
            </ThemedText>
            <ThemedText type="body-sm" style={{ color: theme[500] }} numberOfLines={1}>
                {verb}
            </ThemedText>
            <SolanaIcon size={11} color={theme[700]} />
            <ThemedText
                type="body-sm-semibold"
                style={{ color: theme[800] }}
                numberOfLines={1}
            >
                {sol} SOL
            </ThemedText>
        </Pressable>
    );
}
