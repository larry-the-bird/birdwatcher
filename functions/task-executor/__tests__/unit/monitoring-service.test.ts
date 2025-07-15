import { MonitoringService } from '../../monitoring-service';
import { ChangeDetector } from '../../change-detector';

// Mock the database and change detector
jest.mock('../../change-detector');
const mockChangeDetector = jest.mocked(ChangeDetector);

// Mock database
const mockDb = {
  select: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  from: jest.fn(),
  where: jest.fn(),
  orderBy: jest.fn(),
  limit: jest.fn(),
  values: jest.fn()
};

describe('MonitoringService', () => {
  let monitoringService: MonitoringService;
  let changeDetector: jest.Mocked<ChangeDetector>;

  beforeEach(() => {
    jest.clearAllMocks();
    changeDetector = new mockChangeDetector() as jest.Mocked<ChangeDetector>;
    monitoringService = new MonitoringService(mockDb as any, changeDetector);
  });

  describe('storeExecutionData', () => {
    it('should store execution data for monitoring', async () => {
      const executionData = {
        taskId: 'task-123',
        url: 'https://example.com/coffee',
        extractedData: { roastingDate: '2024-01-20', price: 120 },
        executionId: 'exec-456'
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined)
      });

      await monitoringService.storeExecutionData(executionData);

      expect(mockDb.insert).toHaveBeenCalledWith(expect.anything()); // monitoring_data table
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        taskId: 'task-123',
        url: 'https://example.com/coffee',
        extractedData: { roastingDate: '2024-01-20', price: 120 },
        executionId: 'exec-456',
        timestamp: expect.any(Date)
      });
    });
  });

  describe('getLastExecutionData', () => {
    it('should retrieve last execution data for a task', async () => {
      const expectedData = {
        taskId: 'task-123',
        url: 'https://example.com/coffee',
        extractedData: { roastingDate: '2024-01-15', price: 115 },
        timestamp: new Date('2024-01-15T10:00:00Z'),
        executionId: 'exec-previous'
      };

      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.orderBy.mockReturnValue(mockDb);
      mockDb.limit.mockReturnValue(mockDb);
      mockDb.limit.mockResolvedValue([expectedData]);

      const result = await monitoringService.getLastExecutionData('task-123');

      expect(result).toEqual(expectedData);
      expect(mockDb.where).toHaveBeenCalled();
      expect(mockDb.orderBy).toHaveBeenCalled();
      expect(mockDb.limit).toHaveBeenCalledWith(1);
    });

    it('should return null when no previous data exists', async () => {
      mockDb.select.mockReturnValue(mockDb);
      mockDb.from.mockReturnValue(mockDb);
      mockDb.where.mockReturnValue(mockDb);
      mockDb.orderBy.mockReturnValue(mockDb);
      mockDb.limit.mockReturnValue(mockDb);
      mockDb.limit.mockResolvedValue([]);

      const result = await monitoringService.getLastExecutionData('task-123');

      expect(result).toBeNull();
    });
  });

  describe('processMonitoring', () => {
    it('should detect and store changes when data differs', async () => {
      const taskId = 'task-123';
      const currentData = { roastingDate: '2024-01-20', price: 120 };
      const previousData = {
        taskId: 'task-123',
        extractedData: { roastingDate: '2024-01-15', price: 115 },
        timestamp: new Date('2024-01-15T10:00:00Z'),
        executionId: 'exec-previous'
      };

      // Mock getting previous data
      jest.spyOn(monitoringService, 'getLastExecutionData').mockResolvedValue(previousData);
      
      // Mock change detection
      changeDetector.hasChanged.mockReturnValue({
        hasChanged: true,
        changedFields: ['roastingDate', 'price'],
        isRestock: true,
        timestamp: new Date()
      });

      // Mock storing changes
      jest.spyOn(monitoringService, 'storeChanges').mockResolvedValue(undefined);

      const result = await monitoringService.processMonitoring(taskId, currentData, 'exec-current');

      expect(monitoringService.getLastExecutionData).toHaveBeenCalledWith(taskId);
      expect(changeDetector.hasChanged).toHaveBeenCalledWith(
        previousData.extractedData,
        currentData
      );
      expect(monitoringService.storeChanges).toHaveBeenCalledWith(
        taskId,
        expect.objectContaining({
          hasChanged: true,
          changedFields: ['roastingDate', 'price'],
          isRestock: true
        }),
        'exec-current'
      );
      expect(result.hasChanges).toBe(true);
      expect(result.isRestock).toBe(true);
    });

    it('should not store changes when no changes detected', async () => {
      const taskId = 'task-123';
      const currentData = { roastingDate: '2024-01-15', price: 115 };
      const previousData = {
        taskId: 'task-123',
        extractedData: { roastingDate: '2024-01-15', price: 115 },
        timestamp: new Date('2024-01-15T10:00:00Z'),
        executionId: 'exec-previous'
      };

      jest.spyOn(monitoringService, 'getLastExecutionData').mockResolvedValue(previousData);
      
      changeDetector.hasChanged.mockReturnValue({
        hasChanged: false,
        changedFields: [],
        timestamp: new Date()
      });

      jest.spyOn(monitoringService, 'storeChanges').mockResolvedValue(undefined);

      const result = await monitoringService.processMonitoring(taskId, currentData, 'exec-current');

      expect(result.hasChanges).toBe(false);
      expect(monitoringService.storeChanges).not.toHaveBeenCalled();
    });

    it('should handle first execution (no previous data)', async () => {
      const taskId = 'task-123';
      const currentData = { roastingDate: '2024-01-20', price: 120 };

      jest.spyOn(monitoringService, 'getLastExecutionData').mockResolvedValue(null);
      jest.spyOn(monitoringService, 'storeChanges').mockResolvedValue(undefined);

      const result = await monitoringService.processMonitoring(taskId, currentData, 'exec-first');

      expect(result.hasChanges).toBe(false);
      expect(result.isFirstExecution).toBe(true);
      expect(changeDetector.hasChanged).not.toHaveBeenCalled();
    });
  });

  describe('storeChanges', () => {
    it('should store detected changes', async () => {
      const changeResult = {
        hasChanged: true,
        changedFields: ['roastingDate'],
        isRestock: true,
        timestamp: new Date()
      };

      mockDb.insert.mockReturnValue({
        values: jest.fn().mockResolvedValue(undefined)
      });

      await monitoringService.storeChanges('task-123', changeResult, 'exec-456');

      expect(mockDb.insert).toHaveBeenCalledWith(expect.anything()); // changes table
      expect(mockDb.insert().values).toHaveBeenCalledWith({
        taskId: 'task-123',
        executionId: 'exec-456',
        changedFields: ['roastingDate'],
        isRestock: true,
        detectedAt: expect.any(Date)
      });
    });
  });
});