import { ChangeResult, ChangeDetails, FieldChange } from './types';

export class ChangeDetector {
  hasChanged(previousData: any, currentData: any): ChangeResult {
    const timestamp = new Date();
    const changedFields: string[] = [];
    let isRestock = false;

    // Simple deep comparison
    this.compareObjects(previousData, currentData, '', changedFields);

    // Check for restock (new roasting date indicates restocked coffee)
    if (changedFields.includes('roastingDate') && 
        previousData?.roastingDate && 
        currentData?.roastingDate &&
        currentData.roastingDate > previousData.roastingDate) {
      isRestock = true;
    }

    return {
      hasChanged: changedFields.length > 0,
      changedFields,
      isRestock,
      timestamp
    };
  }

  getChangeDetails(previousData: any, currentData: any): ChangeDetails {
    const timestamp = new Date();
    const changes: FieldChange[] = [];

    this.getDetailedChanges(previousData, currentData, '', changes);

    return {
      changes,
      timestamp
    };
  }

  private compareObjects(obj1: any, obj2: any, prefix: string, changedFields: string[]): void {
    // Get all unique keys from both objects
    const keys = new Set([
      ...Object.keys(obj1 || {}),
      ...Object.keys(obj2 || {})
    ]);

    for (const key of keys) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];

      if (typeof val1 === 'object' && val1 !== null && 
          typeof val2 === 'object' && val2 !== null) {
        // Recursively compare nested objects
        this.compareObjects(val1, val2, fieldPath, changedFields);
      } else if (val1 !== val2) {
        changedFields.push(fieldPath);
      }
    }
  }

  private getDetailedChanges(obj1: any, obj2: any, prefix: string, changes: FieldChange[]): void {
    const keys = new Set([
      ...Object.keys(obj1 || {}),
      ...Object.keys(obj2 || {})
    ]);

    for (const key of keys) {
      const fieldPath = prefix ? `${prefix}.${key}` : key;
      const val1 = obj1?.[key];
      const val2 = obj2?.[key];

      if (typeof val1 === 'object' && val1 !== null && 
          typeof val2 === 'object' && val2 !== null) {
        // Recursively get changes for nested objects
        this.getDetailedChanges(val1, val2, fieldPath, changes);
      } else if (val1 !== val2) {
        let changeType: 'added' | 'removed' | 'modified';
        
        if (val1 === undefined && val2 !== undefined) {
          changeType = 'added';
        } else if (val1 !== undefined && val2 === undefined) {
          changeType = 'removed';
        } else {
          changeType = 'modified';
        }

        changes.push({
          field: fieldPath,
          previousValue: val1,
          currentValue: val2,
          changeType
        });
      }
    }
  }
}