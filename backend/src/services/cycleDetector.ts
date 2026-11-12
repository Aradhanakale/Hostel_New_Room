import { DesiredRoomType } from '@prisma/client';
import {
  canStudentMoveIntoRoom,
  PolicyConfigInput,
  RoomContext,
  StudentContext,
} from './policyValidator';

export interface GraphRequestNode {
  requestId: string;
  requestCode: string;
  studentId: string;
  studentName: string;
  student: StudentContext;
  currentRoom: RoomContext;
  currentBedId: string;
  currentBedLabel: string;
  desiredRoomId?: string | null;
  desiredHostelId?: string | null;
  desiredBlockId?: string | null;
  desiredFloor?: number | null;
  desiredRoomType: DesiredRoomType;
  desiredBedCount?: number | null;
  createdAt: Date;
}

export interface DetectedCycle {
  nodes: GraphRequestNode[];
  length: number;
  type: 'DIRECT' | 'CHAIN';
  specificityScore: number;
  oldestRequestMs: number;
  avgCreatedAtMs: number;
  canonicalKey: string;
}

/**
 * Determines whether node `from` wants to move into `to.currentRoom` and is legally allowed to.
 */
export function matchesDesireAndPolicy(
  from: GraphRequestNode,
  to: GraphRequestNode,
  policy: PolicyConfigInput
): boolean {
  if (from.requestId === to.requestId || from.studentId === to.studentId) {
    return false;
  }
  const target = to.currentRoom;

  // Specific room requested
  if (from.desiredRoomId) {
    if (target.id !== from.desiredRoomId) return false;
  } else {
    // Preference-based matching
    if (from.desiredHostelId && target.hostelId !== from.desiredHostelId) return false;
    if (from.desiredBlockId && target.blockId !== from.desiredBlockId) return false;
    if (
      from.desiredFloor !== null &&
      from.desiredFloor !== undefined &&
      target.floor !== from.desiredFloor
    ) {
      return false;
    }
    if (from.desiredRoomType !== 'ANY' && target.type !== from.desiredRoomType) {
      return false;
    }
    if (
      from.desiredBedCount !== null &&
      from.desiredBedCount !== undefined &&
      target.bedCount !== from.desiredBedCount
    ) {
      return false;
    }
  }

  // Policy check for this student moving into target room
  const policyRes = canStudentMoveIntoRoom({
    student: from.student,
    currentRoom: from.currentRoom,
    targetRoom: target,
    policy,
  });

  return policyRes.allowed;
}

/**
 * Rotates cycle nodes so the lexicographically smallest requestId is first,
 * guaranteeing a unique canonical representation for any directed cycle.
 */
export function canonicalizeCycle(nodes: GraphRequestNode[]): {
  rotated: GraphRequestNode[];
  key: string;
} {
  let minIdx = 0;
  for (let i = 1; i < nodes.length; i++) {
    if (nodes[i].requestId < nodes[minIdx].requestId) {
      minIdx = i;
    }
  }
  const rotated = [...nodes.slice(minIdx), ...nodes.slice(0, minIdx)];
  const key = rotated.map((n) => n.requestId).join('->');
  return { rotated, key };
}

/**
 * Builds directed graph and discovers all simple directed cycles of length 2..maxLength.
 * Uses bounded DFS from ordered start nodes (Johnson-style canonical pruning:
 * only visits nodes >= startNode index to prevent exploring identical rotations).
 */
export function detectAllCycles(
  requests: GraphRequestNode[],
  policy: PolicyConfigInput,
  maxLengthOverride?: number
): DetectedCycle[] {
  const maxLength = Math.max(2, Math.min(maxLengthOverride ?? policy.maxCycleLength ?? 5, 8));
  if (requests.length < 2) return [];

  // Sort deterministically by requestId for Johnson-style canonical start-node pruning
  const sorted = [...requests].sort((a, b) => a.requestId.localeCompare(b.requestId));
  const idToIndex = new Map<string, number>();
  sorted.forEach((r, idx) => idToIndex.set(r.requestId, idx));

  // Build adjacency list
  const adj: number[][] = sorted.map(() => []);
  for (let i = 0; i < sorted.length; i++) {
    for (let j = 0; j < sorted.length; j++) {
      if (i !== j && matchesDesireAndPolicy(sorted[i], sorted[j], policy)) {
        adj[i].push(j);
      }
    }
  }

  const seenKeys = new Set<string>();
  const cycles: DetectedCycle[] = [];
  const MAX_CYCLES_COLLECTED = 500;

  for (let startIdx = 0; startIdx < sorted.length; startIdx++) {
    const path: number[] = [startIdx];
    const inPath = new Set<number>([startIdx]);
    const usedStudents = new Set<string>([sorted[startIdx].studentId]);

    const dfs = (currentIdx: number) => {
      if (cycles.length >= MAX_CYCLES_COLLECTED) return;

      for (const nextIdx of adj[currentIdx]) {
        // Canonical pruning: only traverse nodes with index >= startIdx
        if (nextIdx < startIdx) continue;

        if (nextIdx === startIdx && path.length >= 2) {
          const cycleNodes = path.map((idx) => sorted[idx]);
          const { rotated, key } = canonicalizeCycle(cycleNodes);
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            const oldestRequestMs = Math.min(...rotated.map((n) => n.createdAt.getTime()));
            const avgCreatedAtMs =
              rotated.reduce((sum, n) => sum + n.createdAt.getTime(), 0) / rotated.length;
            const specificityScore = rotated.filter((n) => Boolean(n.desiredRoomId)).length;

            cycles.push({
              nodes: rotated,
              length: rotated.length,
              type: rotated.length === 2 ? 'DIRECT' : 'CHAIN',
              specificityScore,
              oldestRequestMs,
              avgCreatedAtMs,
              canonicalKey: key,
            });
          }
          continue;
        }

        if (
          path.length < maxLength &&
          !inPath.has(nextIdx) &&
          !usedStudents.has(sorted[nextIdx].studentId)
        ) {
          path.push(nextIdx);
          inPath.add(nextIdx);
          usedStudents.add(sorted[nextIdx].studentId);
          dfs(nextIdx);
          usedStudents.delete(sorted[nextIdx].studentId);
          inPath.delete(nextIdx);
          path.pop();
        }
      }
    };

    dfs(startIdx);
  }

  return rankCycles(cycles);
}

/**
 * Ranks cycles:
 * 1. Shorter length first (direct 2-way swaps before 3-way, etc.)
 * 2. Higher count of explicit room targets (specificity)
 * 3. Oldest request timestamp first (FIFO fairness)
 */
export function rankCycles(cycles: DetectedCycle[]): DetectedCycle[] {
  return [...cycles].sort((a, b) => {
    if (a.length !== b.length) return a.length - b.length;
    if (a.specificityScore !== b.specificityScore) {
      return b.specificityScore - a.specificityScore;
    }
    if (a.oldestRequestMs !== b.oldestRequestMs) {
      return a.oldestRequestMs - b.oldestRequestMs;
    }
    return a.avgCreatedAtMs - b.avgCreatedAtMs;
  });
}

/**
 * Greedily locks non-overlapping (disjoint) cycles from ranked list so no request or student
 * joins more than one cycle at a time.
 */
export function selectDisjointCycles(rankedCycles: DetectedCycle[]): DetectedCycle[] {
  const lockedRequests = new Set<string>();
  const lockedStudents = new Set<string>();
  const selected: DetectedCycle[] = [];

  for (const cycle of rankedCycles) {
    const hasConflict = cycle.nodes.some(
      (n) => lockedRequests.has(n.requestId) || lockedStudents.has(n.studentId)
    );
    if (!hasConflict) {
      selected.push(cycle);
      for (const n of cycle.nodes) {
        lockedRequests.add(n.requestId);
        lockedStudents.add(n.studentId);
      }
    }
  }

  return selected;
}
