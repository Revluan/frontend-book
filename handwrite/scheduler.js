class Scheduler {
    constructor(concurrencyLimit) {
        this.concurrencyLimit = concurrencyLimit;
        this.runningTasks = 0;
        this.taskQueue = [];
    }

    add(task) {
        return new Promise((resolve, reject) => {
            const wrappedTask = async () => {
                try {
                    const result = await task();
                    resolve(result);
                } catch (error) {
                    reject(error);
                } finally {
                    this.runningTasks--;
                }
            }

            if (this.runningTasks < this.concurrencyLimit) {
                this.runningTasks++;
                wrappedTask();
            } else {
                this.taskQueue.push(wrappedTask);
                this._processQueue();
            }
        })
    }

    _processQueue() {
        if (this.taskQueue.length > 0 && this.runningTasks < this.concurrencyLimit) {
            this.runningTasks++;
            const nextTask = this.taskQueue.shift();
            nextTask();
        }
    }
}