import { describe, expect, it } from 'vitest';
import {
  detectAllCycles,
  GraphRequestNode,
  selectDisjointCycles,
} from '../services/cycleDetector';
import { PolicyConfigInput, RoomContext, StudentContext } from '../services/policyValidator';

const policy: PolicyConfigInput = {
  sameGenderOnly: true,
  sameYearOnly: false,
  allowAcNonAcSwap: false,
  requireAcEligibility: true,
  requireSameBedCount: false,
  maxSwapsPerSemester: 2,
  cooldownDays: 14,
  maxCycleLength: 5,
  acceptanceTimeoutHours: 48,
  blockedWindowStart: null,
  blockedWindowEnd: null,
  exchangeDeadline: null,
};

function makeNode(
  idx: number,
  options: {
    roomId: string;
    roomNumber: string;
    desiredRoomId?: string | null;
    desiredRoomType?: 'AC' | 'NON_AC' | 'ANY';
    roomType?: 'AC' | 'NON_AC';
    acEligible?: boolean;
    createdAtOffsetMs?: number;
  }
): GraphRequestNode {
  const roomType = options.roomType ?? 'AC';
  const student: StudentContext = {
    id: `stu-${idx}`,
    gender: 'MALE',
    year: 3,
    acEligible: options.acEligible ?? true,
    isRestricted: false,
    swapsThisSemester: 0,
    lastSwapAt: null,
    hasActiveRequest: false,
  };
  const currentRoom: RoomContext = {
    id: options.roomId,
    roomNumber: options.roomNumber,
    hostelId: 'h-1',
    blockId: 'b-1',
    floor: 1,
    type: roomType,
    bedCount: 2,
    capacity: 2,
    gender: 'MALE',
    status: 'AVAILABLE',
    occupantYears: [3],
  };

  return {
    requestId: `req-${String(idx).padStart(2, '0')}`,
    requestCode: `EX-${1000 + idx}`,
    studentId: student.id,
    studentName: `Student ${idx}`,
    student,
    currentRoom,
    currentBedId: `bed-${idx}`,
    currentBedLabel: 'B1',
    desiredRoomId: options.desiredRoomId ?? null,
    desiredRoomType: options.desiredRoomType ?? 'ANY',
    createdAt: new Date(1700000000000 + (options.createdAtOffsetMs ?? idx * 1000)),
  };
}

describe('Cycle Detection Engine', () => {
  it('detects a direct 2-way swap (A <-> B)', () => {
    const a = makeNode(1, { roomId: 'r1', roomNumber: '101', desiredRoomId: 'r2' });
    const b = makeNode(2, { roomId: 'r2', roomNumber: '102', desiredRoomId: 'r1' });

    const cycles = detectAllCycles([a, b], policy);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].length).toBe(2);
    expect(cycles[0].type).toBe('DIRECT');
    expect(cycles[0].nodes.map((n) => n.requestId)).toEqual(['req-01', 'req-02']);
  });

  it('detects a 3-way circular swap (A -> B -> C -> A)', () => {
    const a = makeNode(1, { roomId: 'r1', roomNumber: '101', desiredRoomId: 'r2' });
    const b = makeNode(2, { roomId: 'r2', roomNumber: '205', desiredRoomId: 'r3' });
    const c = makeNode(3, { roomId: 'r3', roomNumber: '310', desiredRoomId: 'r1' });

    const cycles = detectAllCycles([a, b, c], policy);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].length).toBe(3);
    expect(cycles[0].type).toBe('CHAIN');
    expect(cycles[0].nodes.map((n) => n.currentRoom.roomNumber)).toEqual(['101', '205', '310']);
  });

  it('detects a 5-way circular swap (A -> B -> C -> D -> E -> A)', () => {
    const nodes = [
      makeNode(1, { roomId: 'r1', roomNumber: '101', desiredRoomId: 'r2' }),
      makeNode(2, { roomId: 'r2', roomNumber: '102', desiredRoomId: 'r3' }),
      makeNode(3, { roomId: 'r3', roomNumber: '103', desiredRoomId: 'r4' }),
      makeNode(4, { roomId: 'r4', roomNumber: '104', desiredRoomId: 'r5' }),
      makeNode(5, { roomId: 'r5', roomNumber: '105', desiredRoomId: 'r1' }),
    ];

    const cycles = detectAllCycles(nodes, policy, 5);
    expect(cycles).toHaveLength(1);
    expect(cycles[0].length).toBe(5);
    expect(cycles[0].type).toBe('CHAIN');
  });

  it('ranks shorter cycles first and selects disjoint cycles without conflict', () => {
    // Overlapping graph:
    // Direct cycle: 1 <-> 2
    // 3-way cycle: 1 -> 2 -> 3 -> 1
    // Independent 2-way cycle: 4 <-> 5
    const n1 = makeNode(1, { roomId: 'r1', roomNumber: '101', desiredRoomId: 'r2' });
    const n2 = makeNode(2, { roomId: 'r2', roomNumber: '102', desiredRoomType: 'AC' }); // Matches r1 AND r3
    const n3 = makeNode(3, { roomId: 'r3', roomNumber: '103', desiredRoomId: 'r1' });
    const n4 = makeNode(4, { roomId: 'r4', roomNumber: '104', desiredRoomId: 'r5' });
    const n5 = makeNode(5, { roomId: 'r5', roomNumber: '105', desiredRoomId: 'r4' });

    const allCycles = detectAllCycles([n1, n2, n3, n4, n5], policy);
    // Should find both 2-cycles and the 3-cycle
    expect(allCycles.length).toBeGreaterThanOrEqual(3);
    // Shortest cycles come first
    expect(allCycles[0].length).toBe(2);

    const selected = selectDisjointCycles(allCycles);
    // Disjoint selection locks (1,2) and (4,5); 3-cycle (1,2,3) is excluded due to overlap
    expect(selected).toHaveLength(2);
    const allLockedReqIds = selected.flatMap((c) => c.nodes.map((n) => n.requestId));
    expect(new Set(allLockedReqIds).size).toBe(allLockedReqIds.length);
    expect(allLockedReqIds).not.toContain('req-03');
  });

  it('prevents cycles when AC compatibility fails under STRICT policy', () => {
    const a = makeNode(1, {
      roomId: 'r1',
      roomNumber: '101',
      roomType: 'NON_AC',
      desiredRoomId: 'r2',
      acEligible: false,
    });
    const b = makeNode(2, {
      roomId: 'r2',
      roomNumber: '205',
      roomType: 'AC',
      desiredRoomId: 'r1',
      acEligible: true,
    });

    const cycles = detectAllCycles([a, b], policy);
    expect(cycles).toHaveLength(0);
  });

  it('recovers remaining participants when mid-chain rejection removes one node', () => {
    // Initially: 1 -> 2 -> 3 -> 1 AND 2 -> 4 -> 2
    // Suppose 3 rejects (or is cancelled) and removed from pool: 2 <-> 4 still forms!
    const n1 = makeNode(1, { roomId: 'r1', roomNumber: '101', desiredRoomId: 'r3' });
    const n2 = makeNode(2, { roomId: 'r2', roomNumber: '102', desiredRoomType: 'AC' });
    const n4 = makeNode(4, { roomId: 'r4', roomNumber: '104', desiredRoomId: 'r2' });

    // Pool without rejected n3
    const recoveredCycles = detectAllCycles([n1, n2, n4], policy);
    expect(recoveredCycles).toHaveLength(1);
    expect(recoveredCycles[0].length).toBe(2);
    expect(recoveredCycles[0].nodes.map((n) => n.requestId).sort()).toEqual(['req-02', 'req-04']);
  });

  it('ranks competing cycles of equal length by oldest request timestamp first', () => {
    // n2 (newer) and n4 (older) both want r1; n1 wants ANY AC
    const n1 = makeNode(1, {
      roomId: 'r1',
      roomNumber: '101',
      desiredRoomType: 'AC',
      createdAtOffsetMs: 5000,
    });
    const n2 = makeNode(2, {
      roomId: 'r2',
      roomNumber: '102',
      desiredRoomId: 'r1',
      createdAtOffsetMs: 9000,
    });
    const n4 = makeNode(4, {
      roomId: 'r4',
      roomNumber: '104',
      desiredRoomId: 'r1',
      createdAtOffsetMs: 1000, // Oldest!
    });

    const ranked = detectAllCycles([n1, n2, n4], policy);
    expect(ranked).toHaveLength(2);
    const selected = selectDisjointCycles(ranked);
    expect(selected).toHaveLength(1);
    expect(selected[0].nodes.map((n) => n.requestId).sort()).toEqual(['req-01', 'req-04']);
  });
});
