// State Manager for Flow AI Media Downloader
// Provides centralized state management with persistence and recovery

const StateManager = {
    STORAGE_KEY: 'flowai_state',
    BATCH_KEY: 'flowai_active_batch',
    MAX_AGE_HOURS: 24,

    /**
     * Save current state to storage
     * @param {Object} state - State object to save
     */
    async save(state) {
        try {
            const data = {
                ...state,
                timestamp: Date.now(),
                version: '5.1.0'
            };
            await chrome.storage.local.set({ [this.STORAGE_KEY]: data });
            return true;
        } catch (e) {
            console.error('[StateManager] Save failed:', e);
            return false;
        }
    },

    /**
     * Load state from storage
     * @returns {Object|null} Saved state or null
     */
    async load() {
        try {
            const data = await chrome.storage.local.get(this.STORAGE_KEY);
            return data[this.STORAGE_KEY] || null;
        } catch (e) {
            console.error('[StateManager] Load failed:', e);
            return null;
        }
    },

    /**
     * Save batch progress with atomic update
     * @param {Object} batch - Batch state object
     */
    async saveBatchProgress(batch) {
        try {
            const batchData = {
                ...batch,
                lastUpdate: Date.now(),
                version: '5.1.0'
            };
            await chrome.storage.local.set({ [this.BATCH_KEY]: batchData });

            // Also update main state
            const state = await this.load() || {};
            state.activeBatch = batchData;
            await this.save(state);

            return true;
        } catch (e) {
            console.error('[StateManager] Batch save failed:', e);
            return false;
        }
    },

    /**
     * Get batch progress
     * @returns {Object|null} Batch state or null
     */
    async getBatchProgress() {
        try {
            const data = await chrome.storage.local.get(this.BATCH_KEY);
            return data[this.BATCH_KEY] || null;
        } catch (e) {
            console.error('[StateManager] Batch load failed:', e);
            return null;
        }
    },

    /**
     * Check if there's a recoverable batch
     * @returns {Object|null} Recoverable batch or null
     */
    async getRecoverableBatch() {
        const batch = await this.getBatchProgress();
        if (!batch) return null;

        // Check if batch is still valid (less than MAX_AGE hours old)
        const maxAge = this.MAX_AGE_HOURS * 60 * 60 * 1000;
        if (Date.now() - batch.lastUpdate > maxAge) {
            console.log('[StateManager] Batch expired, clearing');
            await this.clearBatch();
            return null;
        }

        // Check if batch was interrupted (isRunning but no recent update)
        if (batch.isRunning) {
            const staleThreshold = 5 * 60 * 1000; // 5 minutes
            if (Date.now() - batch.lastUpdate > staleThreshold) {
                // Mark as interrupted, not running
                batch.isRunning = false;
                batch.wasInterrupted = true;
                await this.saveBatchProgress(batch);
            }
        }

        return batch;
    },

    /**
     * Clear batch state
     */
    async clearBatch() {
        try {
            await chrome.storage.local.remove(this.BATCH_KEY);

            // Also clear from main state
            const state = await this.load() || {};
            delete state.activeBatch;
            await this.save(state);

            return true;
        } catch (e) {
            console.error('[StateManager] Clear batch failed:', e);
            return false;
        }
    },

    /**
     * Update batch status atomically
     * @param {Object} updates - Fields to update
     */
    async updateBatch(updates) {
        const batch = await this.getBatchProgress();
        if (!batch) return false;

        const updated = {
            ...batch,
            ...updates,
            lastUpdate: Date.now()
        };

        return await this.saveBatchProgress(updated);
    },

    /**
     * Create a checkpoint for rollback
     * @param {string} checkpointId - Unique checkpoint ID
     * @param {Object} data - Data to checkpoint
     */
    async createCheckpoint(checkpointId, data) {
        try {
            const key = `flowai_checkpoint_${checkpointId}`;
            await chrome.storage.local.set({
                [key]: {
                    data,
                    timestamp: Date.now()
                }
            });
            return true;
        } catch (e) {
            console.error('[StateManager] Checkpoint failed:', e);
            return false;
        }
    },

    /**
     * Restore from checkpoint
     * @param {string} checkpointId - Checkpoint to restore
     * @returns {Object|null} Checkpoint data or null
     */
    async restoreCheckpoint(checkpointId) {
        try {
            const key = `flowai_checkpoint_${checkpointId}`;
            const data = await chrome.storage.local.get(key);
            return data[key]?.data || null;
        } catch (e) {
            console.error('[StateManager] Restore checkpoint failed:', e);
            return null;
        }
    },

    /**
     * Clear old checkpoints
     */
    async cleanupCheckpoints() {
        try {
            const all = await chrome.storage.local.get(null);
            const maxAge = 24 * 60 * 60 * 1000; // 24 hours
            const now = Date.now();
            const keysToRemove = [];

            for (const [key, value] of Object.entries(all)) {
                if (key.startsWith('flowai_checkpoint_') && value.timestamp) {
                    if (now - value.timestamp > maxAge) {
                        keysToRemove.push(key);
                    }
                }
            }

            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
                console.log(`[StateManager] Cleaned ${keysToRemove.length} old checkpoints`);
            }
        } catch (e) {
            console.error('[StateManager] Cleanup failed:', e);
        }
    },

    /**
     * Get operation statistics
     * @returns {Object} Statistics object
     */
    async getStats() {
        const state = await this.load() || {};
        return {
            totalOperations: state.totalOperations || 0,
            totalDownloads: state.totalDownloads || 0,
            totalErrors: state.totalErrors || 0,
            lastOperation: state.lastOperation || null
        };
    },

    /**
     * Update operation statistics
     * @param {Object} stats - Stats to update
     */
    async updateStats(stats) {
        const state = await this.load() || {};
        state.totalOperations = (state.totalOperations || 0) + (stats.operations || 0);
        state.totalDownloads = (state.totalDownloads || 0) + (stats.downloads || 0);
        state.totalErrors = (state.totalErrors || 0) + (stats.errors || 0);
        state.lastOperation = Date.now();
        await this.save(state);
    }
};

// Export for use in other scripts
if (typeof window !== 'undefined') {
    window.StateManager = StateManager;
}
