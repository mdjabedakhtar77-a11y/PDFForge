const ProcessingJob = require('../models/ProcessingJob');

// In-memory progress tracking for active background jobs
const activeJobs = new Map();

class JobQueueService {
  static async createJob({ userId = null, toolName, inputFileId = null }) {
    const job = await ProcessingJob.create({
      user_id: userId,
      tool_name: toolName,
      status: 'QUEUED',
      input_file_id: inputFileId
    });

    const jobState = {
      id: job.id,
      userId,
      toolName,
      status: 'QUEUED',
      progress: 5,
      result: null,
      error: null,
      createdAt: new Date()
    };
    activeJobs.set(job.id, jobState);
    return jobState;
  }

  static getJob(jobId) {
    if (activeJobs.has(jobId)) {
      return activeJobs.get(jobId);
    }
    return null;
  }

  static updateJobProgress(jobId, progressPercent, message = null) {
    const jobState = activeJobs.get(jobId);
    if (jobState) {
      jobState.status = 'PROCESSING';
      jobState.progress = Math.min(99, Math.max(jobState.progress, progressPercent));
      if (message) jobState.message = message;
    }
  }

  static async completeJob(jobId, result) {
    const jobState = activeJobs.get(jobId);
    if (jobState) {
      jobState.status = 'COMPLETED';
      jobState.progress = 100;
      jobState.result = result;
      jobState.completedAt = new Date();
    }
    await ProcessingJob.updateStatus(jobId, {
      status: 'COMPLETED',
      output_file_id: result.id
    });
  }

  static async failJob(jobId, errorMsg) {
    const jobState = activeJobs.get(jobId);
    if (jobState) {
      jobState.status = 'FAILED';
      jobState.error = errorMsg;
      jobState.completedAt = new Date();
    }
    await ProcessingJob.updateStatus(jobId, {
      status: 'FAILED',
      error_message: errorMsg
    });
  }

  /**
   * Execute an asynchronous task without blocking the HTTP request
   */
  static runAsync(jobId, taskFn) {
    setImmediate(async () => {
      try {
        this.updateJobProgress(jobId, 15, 'Starting processing...');
        const result = await taskFn((progress, msg) => {
          this.updateJobProgress(jobId, progress, msg);
        });
        await this.completeJob(jobId, result);
      } catch (err) {
        console.error(`[JobQueueService] Job ${jobId} failed:`, err);
        await this.failJob(jobId, err.message);
      }
    });
  }
}

module.exports = JobQueueService;
