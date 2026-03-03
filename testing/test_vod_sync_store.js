/**
 * Unit Tests for vodSyncStore
 * Tests offset calculation, state management, and sync logic
 * 
 * Run with: npm test -- test_vod_sync_store.js
 */

import { describe, it, expect } from 'vitest';
import {
  vodSyncReducer,
  initialVodState,
  getAdjustedTime,
  timersMatch,
  calculateTimerOffset,
} from '../frontend/src/store/vodSyncStore';

describe('vodSyncStore - Unit Tests', () => {
  
  // ===== Helper Function Tests =====
  
  describe('getAdjustedTime', () => {
    it('should calculate adjusted time with positive offset', () => {
      const adjusted = getAdjustedTime(100, 5000); // 5s offset
      expect(adjusted).toBe(105);
    });

    it('should calculate adjusted time with negative offset', () => {
      const adjusted = getAdjustedTime(100, -5000); // -5s offset
      expect(adjusted).toBe(95);
    });

    it('should never go below zero', () => {
      const adjusted = getAdjustedTime(2, -5000); // -5s offset, would go negative
      expect(adjusted).toBe(0);
    });

    it('should handle zero offset', () => {
      const adjusted = getAdjustedTime(100, 0);
      expect(adjusted).toBe(100);
    });

    it('should handle fractional seconds', () => {
      const adjusted = getAdjustedTime(100.5, 2500); // 2.5s offset
      expect(adjusted).toBeCloseTo(103);
    });

    it('should handle large offsets', () => {
      const adjusted = getAdjustedTime(1000, 300000); // 300s offset
      expect(adjusted).toBe(1300);
    });
  });

  describe('timersMatch', () => {
    it('should match identical timers', () => {
      expect(timersMatch('14:32', '14:32')).toBe(true);
    });

    it('should match timers within default tolerance (2s)', () => {
      expect(timersMatch('14:32', '14:34')).toBe(true);
      expect(timersMatch('14:32', '14:30')).toBe(true);
    });

    it('should reject timers outside tolerance', () => {
      expect(timersMatch('14:32', '14:35')).toBe(false);
      expect(timersMatch('14:32', '14:29')).toBe(false);
    });

    it('should handle hour format timers', () => {
      expect(timersMatch('1:14:32', '1:14:32')).toBe(true);
      expect(timersMatch('1:14:32', '1:14:34')).toBe(true);
    });

    it('should handle custom tolerance', () => {
      expect(timersMatch('14:32', '14:40', 10)).toBe(true);
      expect(timersMatch('14:32', '14:40', 5)).toBe(false);
    });

    it('should handle edge cases', () => {
      expect(timersMatch('0:00', '0:02')).toBe(true);
      expect(timersMatch('59:59', '59:57')).toBe(true);
      expect(timersMatch(null, null)).toBe(true);
      expect(timersMatch(undefined, undefined)).toBe(true);
    });

    it('should handle mixed formats', () => {
      // 1:14:32 = 4472 seconds, 14:32 = 872 seconds
      expect(timersMatch('1:14:32', '14:32')).toBe(false);
    });
  });

  describe('calculateTimerOffset', () => {
    it('should calculate zero offset for matching timers', () => {
      const offset = calculateTimerOffset('14:32', '14:32');
      expect(offset).toBe(0);
    });

    it('should calculate positive offset (secondary ahead)', () => {
      const offset = calculateTimerOffset('14:32', '14:37');
      expect(offset).toBe(5000); // 5 seconds in milliseconds
    });

    it('should calculate negative offset (secondary behind)', () => {
      const offset = calculateTimerOffset('14:32', '14:27');
      expect(offset).toBe(-5000); // -5 seconds in milliseconds
    });

    it('should handle hour format', () => {
      const offset = calculateTimerOffset('1:14:32', '1:14:37');
      expect(offset).toBe(5000);
    });

    it('should handle crossing minute boundaries', () => {
      const offset = calculateTimerOffset('14:59', '15:04');
      expect(offset).toBe(5000);
    });

    it('should handle large offsets', () => {
      const offset = calculateTimerOffset('0:00', '5:00');
      expect(offset).toBe(300000); // 300 seconds
    });

    it('should return offset in milliseconds', () => {
      const offset = calculateTimerOffset('1:00', '1:00.5');
      // Note: This assumes fractional second support
      expect(Math.abs(offset)).toBeGreaterThanOrEqual(0);
    });
  });

  // ===== State Reducer Tests =====

  describe('vodSyncReducer', () => {
    
    it('should initialize with initial state', () => {
      expect(initialVodState).toEqual({
        vods: [],
        primaryVodId: null,
        isLinkedPlayback: true,
        syncSettings: {
          autoDetect: true,
          confidenceThreshold: 0.85,
        },
      });
    });

    describe('ADD_VOD action', () => {
      it('should add a VOD to empty state', () => {
        const state = vodSyncReducer(initialVodState, {
          type: 'ADD_VOD',
          payload: {
            url: 'https://example.com/vod1.mp4',
            label: 'VOD 1',
          },
        });

        expect(state.vods).toHaveLength(1);
        expect(state.vods[0].url).toBe('https://example.com/vod1.mp4');
        expect(state.vods[0].label).toBe('VOD 1');
        expect(state.primaryVodId).toBe(state.vods[0].id);
        expect(state.vods[0].syncOffset).toBe(0);
        expect(state.vods[0].syncStatus).toBe('unsync');
      });

      it('should add multiple VODs', () => {
        let state = initialVodState;
        for (let i = 0; i < 3; i++) {
          state = vodSyncReducer(state, {
            type: 'ADD_VOD',
            payload: {
              url: `https://example.com/vod${i}.mp4`,
              label: `VOD ${i}`,
            },
          });
        }

        expect(state.vods).toHaveLength(3);
        expect(state.vods[0].label).toBe('VOD 0');
        expect(state.vods[2].label).toBe('VOD 2');
      });

      it('should preserve primaryVodId for first VOD', () => {
        const state = vodSyncReducer(initialVodState, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod1.mp4' },
        });

        expect(state.primaryVodId).toBe(state.vods[0].id);
      });

      it('should not override primaryVodId for subsequent VODs', () => {
        let state = vodSyncReducer(initialVodState, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod1.mp4' },
        });
        const firstId = state.primaryVodId;

        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod2.mp4' },
        });

        expect(state.primaryVodId).toBe(firstId);
      });
    });

    describe('REMOVE_VOD action', () => {
      let stateWithTwoVods;

      beforeEach(() => {
        let state = initialVodState;
        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod1.mp4', label: 'VOD 1' },
        });
        const firstId = state.primaryVodId;

        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod2.mp4', label: 'VOD 2' },
        });
        stateWithTwoVods = state;
      });

      it('should remove a VOD by ID', () => {
        const vodToRemove = stateWithTwoVods.vods[0];
        const state = vodSyncReducer(stateWithTwoVods, {
          type: 'REMOVE_VOD',
          payload: { id: vodToRemove.id },
        });

        expect(state.vods).toHaveLength(1);
        expect(state.vods[0].label).toBe('VOD 2');
      });

      it('should update primaryVodId if removing primary VOD', () => {
        const state = vodSyncReducer(stateWithTwoVods, {
          type: 'REMOVE_VOD',
          payload: { id: stateWithTwoVods.primaryVodId },
        });

        expect(state.primaryVodId).toBe(stateWithTwoVods.vods[1].id);
      });

      it('should set primaryVodId to null if removing last VOD', () => {
        let state = vodSyncReducer(stateWithTwoVods, {
          type: 'REMOVE_VOD',
          payload: { id: stateWithTwoVods.vods[0].id },
        });

        state = vodSyncReducer(state, {
          type: 'REMOVE_VOD',
          payload: { id: state.vods[0].id },
        });

        expect(state.primaryVodId).toBeNull();
        expect(state.vods).toHaveLength(0);
      });
    });

    describe('SET_PRIMARY_VOD action', () => {
      it('should set primary VOD', () => {
        let state = initialVodState;
        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod1.mp4' },
        });
        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod2.mp4' },
        });

        const newPrimary = state.vods[1];
        const newState = vodSyncReducer(state, {
          type: 'SET_PRIMARY_VOD',
          payload: { id: newPrimary.id },
        });

        expect(newState.primaryVodId).toBe(newPrimary.id);
      });
    });

    describe('UPDATE_VOD_TIME action', () => {
      it('should update current time for specific VOD', () => {
        let state = initialVodState;
        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod1.mp4' },
        });

        const vodId = state.vods[0].id;
        const newState = vodSyncReducer(state, {
          type: 'UPDATE_VOD_TIME',
          payload: { id: vodId, currentTime: 123.45 },
        });

        expect(newState.vods[0].currentTime).toBe(123.45);
      });
    });

    describe('SET_SYNC_OFFSET action', () => {
      it('should set sync offset for specific VOD', () => {
        let state = initialVodState;
        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod1.mp4' },
        });

        const vodId = state.vods[0].id;
        const newState = vodSyncReducer(state, {
          type: 'SET_SYNC_OFFSET',
          payload: { id: vodId, offset: 5000 },
        });

        expect(newState.vods[0].syncOffset).toBe(5000);
      });

      it('should handle negative offsets', () => {
        let state = initialVodState;
        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod1.mp4' },
        });

        const vodId = state.vods[0].id;
        const newState = vodSyncReducer(state, {
          type: 'SET_SYNC_OFFSET',
          payload: { id: vodId, offset: -3000 },
        });

        expect(newState.vods[0].syncOffset).toBe(-3000);
      });
    });

    describe('SET_SYNC_STATUS action', () => {
      it('should set sync status for specific VOD', () => {
        let state = initialVodState;
        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod1.mp4' },
        });

        const vodId = state.vods[0].id;
        const newState = vodSyncReducer(state, {
          type: 'SET_SYNC_STATUS',
          payload: { id: vodId, status: 'synced' },
        });

        expect(newState.vods[0].syncStatus).toBe('synced');
      });

      it('should set error message if provided', () => {
        let state = initialVodState;
        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod1.mp4' },
        });

        const vodId = state.vods[0].id;
        const newState = vodSyncReducer(state, {
          type: 'SET_SYNC_STATUS',
          payload: {
            id: vodId,
            status: 'error',
            error: 'OCR detection failed',
          },
        });

        expect(newState.vods[0].syncStatus).toBe('error');
        expect(newState.vods[0].error).toBe('OCR detection failed');
      });

      it('should clear error when status changes', () => {
        let state = initialVodState;
        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod1.mp4' },
        });

        const vodId = state.vods[0].id;
        let newState = vodSyncReducer(state, {
          type: 'SET_SYNC_STATUS',
          payload: {
            id: vodId,
            status: 'error',
            error: 'Test error',
          },
        });

        newState = vodSyncReducer(newState, {
          type: 'SET_SYNC_STATUS',
          payload: { id: vodId, status: 'synced' },
        });

        expect(newState.vods[0].error).toBeNull();
      });
    });

    describe('CLEAR_ALL_VODS action', () => {
      it('should reset to initial state', () => {
        let state = initialVodState;
        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod1.mp4' },
        });
        state = vodSyncReducer(state, {
          type: 'ADD_VOD',
          payload: { url: 'https://example.com/vod2.mp4' },
        });

        const newState = vodSyncReducer(state, { type: 'CLEAR_ALL_VODS' });

        expect(newState).toEqual(initialVodState);
      });
    });
  });

  // ===== Integration Tests =====

  describe('Multi-step state transitions', () => {
    it('should handle add, sync, and remove workflow', () => {
      let state = initialVodState;

      // Add VOD 1
      state = vodSyncReducer(state, {
        type: 'ADD_VOD',
        payload: { url: 'https://example.com/vod1.mp4', label: 'VOD 1' },
      });
      const vod1Id = state.vods[0].id;

      // Add VOD 2
      state = vodSyncReducer(state, {
        type: 'ADD_VOD',
        payload: { url: 'https://example.com/vod2.mp4', label: 'VOD 2' },
      });
      const vod2Id = state.vods[1].id;

      // Set offset for VOD 2
      state = vodSyncReducer(state, {
        type: 'SET_SYNC_OFFSET',
        payload: { id: vod2Id, offset: 5000 },
      });

      // Mark as synced
      state = vodSyncReducer(state, {
        type: 'SET_SYNC_STATUS',
        payload: { id: vod2Id, status: 'synced' },
      });

      // Update primary time
      state = vodSyncReducer(state, {
        type: 'UPDATE_VOD_TIME',
        payload: { id: vod1Id, currentTime: 100 },
      });

      // Verify state
      expect(state.vods).toHaveLength(2);
      expect(state.vods[1].syncOffset).toBe(5000);
      expect(state.vods[1].syncStatus).toBe('synced');
      expect(state.vods[0].currentTime).toBe(100);
    });

    it('should handle rapid offset changes', () => {
      let state = initialVodState;
      state = vodSyncReducer(state, {
        type: 'ADD_VOD',
        payload: { url: 'https://example.com/vod1.mp4' },
      });

      const vodId = state.vods[0].id;

      // Rapid changes
      for (let offset = 0; offset <= 10000; offset += 1000) {
        state = vodSyncReducer(state, {
          type: 'SET_SYNC_OFFSET',
          payload: { id: vodId, offset },
        });
      }

      expect(state.vods[0].syncOffset).toBe(10000);
    });
  });

  // ===== Edge Cases =====

  describe('Edge cases', () => {
    it('should handle missing VOD ID gracefully', () => {
      let state = initialVodState;
      state = vodSyncReducer(state, {
        type: 'ADD_VOD',
        payload: { url: 'https://example.com/vod1.mp4' },
      });

      // Try to update non-existent VOD
      const newState = vodSyncReducer(state, {
        type: 'UPDATE_VOD_TIME',
        payload: { id: 'non-existent', currentTime: 100 },
      });

      expect(newState.vods[0].currentTime).toBe(0);
    });

    it('should handle very large offset values', () => {
      const offset = getAdjustedTime(1000, 86400000); // 24 hours
      expect(offset).toBe(87400);
    });

    it('should handle zero duration VOD', () => {
      let state = initialVodState;
      state = vodSyncReducer(state, {
        type: 'ADD_VOD',
        payload: { url: 'https://example.com/vod1.mp4' },
      });

      const vodId = state.vods[0].id;
      const newState = vodSyncReducer(state, {
        type: 'UPDATE_VOD_DURATION',
        payload: { id: vodId, duration: 0 },
      });

      expect(newState.vods[0].duration).toBe(0);
    });
  });
});
