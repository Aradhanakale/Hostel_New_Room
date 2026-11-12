import { describe, expect, it } from 'vitest';
import {
  evaluateExchangeRequestPolicy,
  PolicyConfigInput,
  RoomContext,
  StudentContext,
} from '../services/policyValidator';

const basePolicy: PolicyConfigInput = {
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
  exchangeDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
};

const baseStudent: StudentContext = {
  id: 'stu-1',
  gender: 'MALE',
  year: 3,
  acEligible: true,
  isRestricted: false,
  swapsThisSemester: 0,
  lastSwapAt: null,
  hasActiveRequest: false,
};

const room101Ac: RoomContext = {
  id: 'room-101',
  roomNumber: 'A-101',
  hostelId: 'h-1',
  blockId: 'b-1',
  floor: 1,
  type: 'AC',
  bedCount: 2,
  capacity: 2,
  gender: 'MALE',
  status: 'AVAILABLE',
  occupantYears: [3],
};

const room205Ac: RoomContext = {
  id: 'room-205',
  roomNumber: 'A-205',
  hostelId: 'h-1',
  blockId: 'b-1',
  floor: 2,
  type: 'AC',
  bedCount: 2,
  capacity: 2,
  gender: 'MALE',
  status: 'AVAILABLE',
  occupantYears: [3],
};

const room102NonAc: RoomContext = {
  id: 'room-102',
  roomNumber: 'A-102',
  hostelId: 'h-1',
  blockId: 'b-1',
  floor: 1,
  type: 'NON_AC',
  bedCount: 2,
  capacity: 2,
  gender: 'MALE',
  status: 'AVAILABLE',
  occupantYears: [2],
};

describe('Policy Validator', () => {
  it('passes all checks for a valid AC-to-AC request', () => {
    const res = evaluateExchangeRequestPolicy({
      student: baseStudent,
      currentRoom: room101Ac,
      targetRoom: room205Ac,
      criteria: {
        desiredRoomId: room205Ac.id,
        desiredRoomType: 'AC',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      policy: basePolicy,
    });

    expect(res.passed).toBe(true);
    expect(res.checks.every((c) => c.passed)).toBe(true);
  });

  it('blocks Non-AC to AC swap when allowAcNonAcSwap is false', () => {
    const res = evaluateExchangeRequestPolicy({
      student: baseStudent,
      currentRoom: room102NonAc,
      targetRoom: room205Ac,
      criteria: {
        desiredRoomId: room205Ac.id,
        desiredRoomType: 'AC',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      policy: basePolicy,
    });

    expect(res.passed).toBe(false);
    const acCheck = res.checks.find((c) => c.code === 'AC_ELIGIBILITY_AND_TYPE');
    expect(acCheck?.passed).toBe(false);
    expect(acCheck?.message).toContain('prohibits NON_AC ↔ AC');
  });

  it('blocks Non-AC to AC upgrade when student lacks acEligible even if cross-type is allowed', () => {
    const res = evaluateExchangeRequestPolicy({
      student: { ...baseStudent, acEligible: false },
      currentRoom: room102NonAc,
      targetRoom: room205Ac,
      criteria: {
        desiredRoomId: room205Ac.id,
        desiredRoomType: 'AC',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      policy: { ...basePolicy, allowAcNonAcSwap: true, requireAcEligibility: true },
    });

    expect(res.passed).toBe(false);
    const acCheck = res.checks.find((c) => c.code === 'AC_ELIGIBILITY_AND_TYPE');
    expect(acCheck?.passed).toBe(false);
    expect(acCheck?.message).toContain('AC fee/eligibility');
  });

  it('allows Non-AC to AC upgrade when allowAcNonAcSwap is true and student is acEligible', () => {
    const res = evaluateExchangeRequestPolicy({
      student: { ...baseStudent, acEligible: true },
      currentRoom: room102NonAc,
      targetRoom: room205Ac,
      criteria: {
        desiredRoomId: room205Ac.id,
        desiredRoomType: 'AC',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      policy: { ...basePolicy, allowAcNonAcSwap: true, requireAcEligibility: true },
    });

    expect(res.passed).toBe(true);
  });

  it('blocks swap across different genders when sameGenderOnly is enabled', () => {
    const femaleRoom: RoomContext = { ...room205Ac, id: 'r-f', gender: 'FEMALE' };
    const res = evaluateExchangeRequestPolicy({
      student: baseStudent,
      currentRoom: room101Ac,
      targetRoom: femaleRoom,
      criteria: {
        desiredRoomId: femaleRoom.id,
        desiredRoomType: 'AC',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      policy: basePolicy,
    });

    expect(res.passed).toBe(false);
    expect(res.checks.find((c) => c.code === 'SAME_GENDER_BLOCK')?.passed).toBe(false);
  });

  it('enforces optional sameYearOnly rule', () => {
    const year2Room: RoomContext = { ...room205Ac, occupantYears: [2] };
    const res = evaluateExchangeRequestPolicy({
      student: baseStudent, // Year 3
      currentRoom: room101Ac,
      targetRoom: year2Room,
      criteria: {
        desiredRoomId: year2Room.id,
        desiredRoomType: 'AC',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      policy: { ...basePolicy, sameYearOnly: true },
    });

    expect(res.passed).toBe(false);
    expect(res.checks.find((c) => c.code === 'SAME_YEAR_RULE')?.passed).toBe(false);
  });

  it('enforces max swaps per semester and cooldown period', () => {
    const now = new Date('2026-11-12T10:00:00Z');
    const recentSwap = new Date('2026-11-08T10:00:00Z'); // 4 days ago (< 14 days)

    const res = evaluateExchangeRequestPolicy({
      student: {
        ...baseStudent,
        swapsThisSemester: 2,
        lastSwapAt: recentSwap,
      },
      currentRoom: room101Ac,
      targetRoom: room205Ac,
      criteria: {
        desiredRoomId: room205Ac.id,
        desiredRoomType: 'AC',
        expiresAt: new Date('2026-12-01T10:00:00Z'),
      },
      policy: basePolicy,
      now,
    });

    expect(res.passed).toBe(false);
    expect(res.checks.find((c) => c.code === 'MAX_SWAPS_SEMESTER')?.passed).toBe(false);
    expect(res.checks.find((c) => c.code === 'COOLDOWN_PERIOD')?.passed).toBe(false);
  });

  it('blocks requests during blocked swap windows and prevents pending duplicates', () => {
    const now = new Date('2026-11-12T10:00:00Z');
    const res = evaluateExchangeRequestPolicy({
      student: { ...baseStudent, hasActiveRequest: true, isRestricted: true },
      currentRoom: room101Ac,
      targetRoom: room205Ac,
      criteria: {
        desiredRoomId: room205Ac.id,
        desiredRoomType: 'AC',
        expiresAt: new Date('2026-12-01T10:00:00Z'),
      },
      policy: {
        ...basePolicy,
        blockedWindowStart: new Date('2026-11-10T00:00:00Z'),
        blockedWindowEnd: new Date('2026-11-15T00:00:00Z'),
      },
      now,
    });

    expect(res.passed).toBe(false);
    expect(res.checks.find((c) => c.code === 'EXCHANGE_WINDOW_OPEN')?.passed).toBe(false);
    expect(res.checks.find((c) => c.code === 'NO_PENDING_DUPLICATE')?.passed).toBe(false);
    expect(res.checks.find((c) => c.code === 'STUDENT_NOT_RESTRICTED')?.passed).toBe(false);
  });

  it('enforces bed count compatibility when requireSameBedCount is true', () => {
    const threeBedAc: RoomContext = { ...room205Ac, bedCount: 3, capacity: 3 };
    const res = evaluateExchangeRequestPolicy({
      student: baseStudent,
      currentRoom: room101Ac,
      targetRoom: threeBedAc,
      criteria: {
        desiredRoomId: threeBedAc.id,
        desiredRoomType: 'AC',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      policy: { ...basePolicy, requireSameBedCount: true },
    });

    expect(res.passed).toBe(false);
    expect(res.checks.find((c) => c.code === 'BED_COUNT_COMPATIBILITY')?.passed).toBe(false);
  });
});
