import { ChangeDetector } from '../../change-detector';
import { ChangeResult } from '../../types';

describe('ChangeDetector', () => {
  let changeDetector: ChangeDetector;

  beforeEach(() => {
    changeDetector = new ChangeDetector();
  });

  describe('hasChanged', () => {
    it('should detect when roasting date changes', () => {
      const previousData = { roastingDate: '2024-01-15' };
      const currentData = { roastingDate: '2024-01-20' };
      
      const result = changeDetector.hasChanged(previousData, currentData);
      
      expect(result.hasChanged).toBe(true);
      expect(result.changedFields).toContain('roastingDate');
    });

    it('should not detect change when roasting date is same', () => {
      const previousData = { roastingDate: '2024-01-15' };
      const currentData = { roastingDate: '2024-01-15' };
      
      const result = changeDetector.hasChanged(previousData, currentData);
      
      expect(result.hasChanged).toBe(false);
      expect(result.changedFields).toHaveLength(0);
    });

    it('should detect multiple field changes', () => {
      const previousData = { roastingDate: '2024-01-15', price: 120 };
      const currentData = { roastingDate: '2024-01-20', price: 135 };
      
      const result = changeDetector.hasChanged(previousData, currentData);
      
      expect(result.hasChanged).toBe(true);
      expect(result.changedFields).toContain('roastingDate');
      expect(result.changedFields).toContain('price');
    });

    it('should handle null/undefined values', () => {
      const previousData = { roastingDate: null };
      const currentData = { roastingDate: '2024-01-20' };
      
      const result = changeDetector.hasChanged(previousData, currentData);
      
      expect(result.hasChanged).toBe(true);
      expect(result.changedFields).toContain('roastingDate');
    });

    it('should handle missing fields', () => {
      const previousData = { roastingDate: '2024-01-15' };
      const currentData = {}; // Missing roastingDate
      
      const result = changeDetector.hasChanged(previousData, currentData);
      
      expect(result.hasChanged).toBe(true);
      expect(result.changedFields).toContain('roastingDate');
    });

    it('should handle nested object changes', () => {
      const previousData = { product: { name: 'Coffee A', roastingDate: '2024-01-15' } };
      const currentData = { product: { name: 'Coffee A', roastingDate: '2024-01-20' } };
      
      const result = changeDetector.hasChanged(previousData, currentData);
      
      expect(result.hasChanged).toBe(true);
      expect(result.changedFields).toContain('product.roastingDate');
    });
  });

  describe('getChangeDetails', () => {
    it('should provide detailed change information', () => {
      const previousData = { roastingDate: '2024-01-15', price: 120 };
      const currentData = { roastingDate: '2024-01-20', price: 135 };
      
      const result = changeDetector.getChangeDetails(previousData, currentData);
      
      expect(result.changes).toHaveLength(2);
      expect(result.changes[0]).toEqual({
        field: 'roastingDate',
        previousValue: '2024-01-15',
        currentValue: '2024-01-20',
        changeType: 'modified'
      });
      expect(result.changes[1]).toEqual({
        field: 'price',
        previousValue: 120,
        currentValue: 135,
        changeType: 'modified'
      });
    });

    it('should detect added fields', () => {
      const previousData = { roastingDate: '2024-01-15' };
      const currentData = { roastingDate: '2024-01-15', price: 120 };
      
      const result = changeDetector.getChangeDetails(previousData, currentData);
      
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toEqual({
        field: 'price',
        previousValue: undefined,
        currentValue: 120,
        changeType: 'added'
      });
    });

    it('should detect removed fields', () => {
      const previousData = { roastingDate: '2024-01-15', price: 120 };
      const currentData = { roastingDate: '2024-01-15' };
      
      const result = changeDetector.getChangeDetails(previousData, currentData);
      
      expect(result.changes).toHaveLength(1);
      expect(result.changes[0]).toEqual({
        field: 'price',
        previousValue: 120,
        currentValue: undefined,
        changeType: 'removed'
      });
    });
  });

  describe('specific monitoring scenarios', () => {
    it('should detect coffee restock (new roasting date)', () => {
      const previousData = { 
        roastingDate: '2024-01-15',
        inStock: true,
        price: 120
      };
      const currentData = { 
        roastingDate: '2024-01-20', // New roasting date = restocked
        inStock: true,
        price: 120
      };
      
      const result = changeDetector.hasChanged(previousData, currentData);
      
      expect(result.hasChanged).toBe(true);
      expect(result.changedFields).toContain('roastingDate');
      expect(result.isRestock).toBe(true);
    });

    it('should detect when product goes out of stock', () => {
      const previousData = { inStock: true };
      const currentData = { inStock: false };
      
      const result = changeDetector.hasChanged(previousData, currentData);
      
      expect(result.hasChanged).toBe(true);
      expect(result.changedFields).toContain('inStock');
    });

    it('should detect price changes', () => {
      const previousData = { price: 120 };
      const currentData = { price: 135 };
      
      const result = changeDetector.hasChanged(previousData, currentData);
      
      expect(result.hasChanged).toBe(true);
      expect(result.changedFields).toContain('price');
    });
  });
});